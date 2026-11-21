// Handler Edge Function `parse`: hanya API web standar (tanpa Deno/Node), dependensi disuntikkan
// agar bisa dites di Jest. Penyambung Deno ada di ../parse/index.ts.
import { buatPrompt, validasiHasil, type Konteks, type HasilParse } from './parsing.ts';

export type Kuota = { bulan: string; terpakai: number; batas: number; pro: boolean };

export type DbPengguna = {
  kuota(): Promise<Kuota>;
  pakaiKuota(): Promise<Kuota & { ok: boolean }>;
  konteks(sekarang: Date): Promise<Konteks>;
};

export type DepsParse = {
  db(token: string): DbPengguna;
  openai: {
    transkripsi(audio: Uint8Array, mime: string): Promise<string>;
    parse(prompt: string, teks: string): Promise<unknown>;
  };
  buatId(): string;
  sekarang(): Date;
};

/** Dilempar DbPengguna bila token ditolak (JWT kedaluwarsa/tidak valid). */
export class GalatSesi extends Error {
  constructor() {
    super('sesi');
    this.name = 'GalatSesi';
  }
}

export const MAKS_AUDIO = 6 * 1024 * 1024;
export const MAKS_TEKS = 500;
const ZONA_BAWAAN = 'Asia/Jakarta';
const MIME_BAWAAN = 'audio/mp4';

const PESAN = {
  unauthorized: 'Sesi habis, masuk lagi.',
  kosong: 'Kirim suara atau teks.',
  audioPanjang: 'Rekaman terlalu panjang.',
  teksPanjang: 'Teks terlalu panjang (maks 500 huruf).',
  kuota: 'Kuota catat AI bulan ini habis.',
  ai: 'AI sedang sibuk, coba lagi sebentar.',
  server: 'Terjadi kesalahan, coba lagi.',
  tidakJelas: 'Suaranya belum terdengar jelas. Coba ulangi lebih dekat ke mic.',
} as const;

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type KodeGalat = 'quota_exceeded' | 'unauthorized' | 'bad_request' | 'ai_gagal' | 'server';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });

const galat = (status: number, kode: KodeGalat, pesan: string, kuota?: Kuota) =>
  json(status, kuota ? { galat: kode, pesan, kuota } : { galat: kode, pesan });

const tanpaOk = ({ bulan, terpakai, batas, pro }: Kuota): Kuota => ({ bulan, terpakai, batas, pro });

/** Tanggal YYYY-MM-DD di zona waktu tertentu; zona kosong/tidak valid → Asia/Jakarta. */
export function tanggalDiZona(sekarang: Date, zona: string | null | undefined): string {
  const fmt = (timeZone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(sekarang);
  try {
    return fmt(zona || ZONA_BAWAAN);
  } catch {
    return fmt(ZONA_BAWAAN);
  }
}

type Masukan = { jenis: 'teks'; teks: string } | { jenis: 'audio'; audio: Uint8Array; mime: string };

// Ukuran hasil decode dihitung dari panjang string agar string raksasa ditolak sebelum di-decode.
export function decodeBase64(s: string): Uint8Array | 'besar' | null {
  let b = s.startsWith('data:') ? s.slice(s.indexOf(',') + 1) : s;
  b = b.replace(/\s+/g, '');
  if (!b || b.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b)) return null;
  const pad = b.endsWith('==') ? 2 : b.endsWith('=') ? 1 : 0;
  if (Math.floor((b.length * 3) / 4) - pad > MAKS_AUDIO) return 'besar';
  let biner: string;
  try {
    biner = atob(b);
  } catch {
    return null;
  }
  if (biner.length > MAKS_AUDIO) return 'besar';
  const out = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) out[i] = biner.charCodeAt(i);
  return out;
}

function bacaMasukan(body: unknown): Masukan | Response {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return galat(400, 'bad_request', PESAN.kosong);
  }
  const { teks, audio_base64, mime } = body as Record<string, unknown>;
  if (typeof audio_base64 === 'string' && audio_base64.trim() !== '') {
    const audio = decodeBase64(audio_base64);
    if (audio === 'besar') return galat(400, 'bad_request', PESAN.audioPanjang);
    if (!audio || audio.length === 0) return galat(400, 'bad_request', PESAN.kosong);
    const m = typeof mime === 'string' && mime.trim() ? mime.trim() : MIME_BAWAAN;
    return { jenis: 'audio', audio, mime: m };
  }
  if (typeof teks === 'string') {
    const t = teks.trim();
    if (t.length > MAKS_TEKS) return galat(400, 'bad_request', PESAN.teksPanjang);
    if (t) return { jenis: 'teks', teks: t };
  }
  return galat(400, 'bad_request', PESAN.kosong);
}

export function tokenDari(req: Request): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get('authorization') ?? '');
  return m ? m[1] : null;
}

// Catat tahap yang gagal saja: jangan pernah mencetak teks/transkrip pengguna atau kunci API.
const catat = (tahap: string) => console.error(`parse: gagal di tahap ${tahap}`);

export function buatHandler(deps: DepsParse): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });
    if (req.method !== 'POST') return galat(400, 'bad_request', PESAN.kosong);

    const token = tokenDari(req);
    if (!token) return galat(401, 'unauthorized', PESAN.unauthorized);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return galat(400, 'bad_request', PESAN.kosong);
    }
    const masukan = bacaMasukan(body);
    if (masukan instanceof Response) return masukan;

    const db = deps.db(token);

    // Cek kuota dulu: habis → 402 tanpa menyentuh OpenAI.
    let kuota: Kuota;
    let konteks: Konteks;
    try {
      kuota = tanpaOk(await db.kuota());
      if (kuota.terpakai >= kuota.batas) return galat(402, 'quota_exceeded', PESAN.kuota, kuota);
      konteks = await db.konteks(deps.sekarang());
    } catch (e) {
      if (e instanceof GalatSesi) return galat(401, 'unauthorized', PESAN.unauthorized);
      catat('db');
      return galat(500, 'server', PESAN.server);
    }

    let transkrip: string;
    let mentah: unknown;
    try {
      transkrip =
        masukan.jenis === 'teks'
          ? masukan.teks
          : (await deps.openai.transkripsi(masukan.audio, masukan.mime)).trim();
      if (!transkrip) {
        return json(200, {
          transkrip: '',
          draf: [],
          koreksi: [],
          tidakDidukung: [],
          butuh_klarifikasi: true,
          pertanyaan: PESAN.tidakJelas,
          kuota,
        });
      }
      mentah = await deps.openai.parse(buatPrompt(konteks), transkrip);
    } catch {
      catat('openai');
      return galat(502, 'ai_gagal', PESAN.ai);
    }

    const hasil: HasilParse = validasiHasil(mentah, konteks, deps.buatId);

    // Kuota +1 hanya bila ada draf/koreksi yang bisa disimpan.
    if (!hasil.butuh_klarifikasi && (hasil.draf.length > 0 || hasil.koreksi.length > 0)) {
      try {
        const pakai = await db.pakaiKuota();
        kuota = tanpaOk(pakai);
        if (!pakai.ok) return galat(402, 'quota_exceeded', PESAN.kuota, kuota);
      } catch (e) {
        if (e instanceof GalatSesi) return galat(401, 'unauthorized', PESAN.unauthorized);
        catat('pakai_kuota');
        return galat(500, 'server', PESAN.server);
      }
    }

    return json(200, { transkrip, ...hasil, kuota });
  };
}
