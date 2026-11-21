// Handler Edge Function `parse-hutang`: membaca screenshot tagihan/cicilan dan mengembalikan DRAF
// hutang untuk dikonfirmasi pengguna. Hanya API web standar; dependensi disuntikkan agar bisa dites
// di Jest. Penyambung Deno ada di ../parse-hutang/index.ts.
import { CORS, decodeBase64, GalatSesi, tokenDari, type Kuota } from './handler.ts';

export type DrafHutang = {
  pemberi: string;
  tipe: 'cicilan_tetap' | 'berbunga';
  nominal_cicilan: number | null;
  tenor_bulan: number | null;
  jatuh_tempo: string | null;
  pokok_awal: number | null;
  bunga_persen_bulanan: number | null;
  sisa_pokok: number | null;
  catatan: string | null;
};

export type DbHutang = {
  kuota(): Promise<Kuota>;
  pakaiKuota(): Promise<Kuota & { ok: boolean }>;
  /** Tanggal hari ini (YYYY-MM-DD) di zona waktu profil pengguna. */
  hariIni(sekarang: Date): Promise<string>;
};

export type DepsHutangGambar = {
  db(token: string): DbHutang;
  ai: { baca(gambar: Uint8Array, mime: string, prompt: string): Promise<unknown> };
  sekarang(): Date;
};

export const MIME_GAMBAR = ['image/jpeg', 'image/png', 'image/webp'] as const;

const PESAN = {
  unauthorized: 'Sesi habis, masuk lagi.',
  kosong: 'Kirim screenshot tagihan.',
  besar: 'Gambar terlalu besar (maks 6 MB).',
  mime: 'Format gambar harus JPG, PNG, atau WEBP.',
  kuota: 'Kuota catat AI bulan ini habis.',
  ai: 'AI sedang sibuk, coba lagi sebentar.',
  server: 'Terjadi kesalahan, coba lagi.',
  bukanTagihan: 'Screenshot ini tidak terlihat seperti tagihan atau cicilan. Coba screenshot halaman detail tagihan.',
} as const;

type KodeGalat = 'quota_exceeded' | 'unauthorized' | 'bad_request' | 'ai_gagal' | 'server';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });

const galat = (status: number, kode: KodeGalat, pesan: string, kuota?: Kuota) =>
  json(status, kuota ? { galat: kode, pesan, kuota } : { galat: kode, pesan });

const tanpaOk = ({ bulan, terpakai, batas, pro }: Kuota): Kuota => ({ bulan, terpakai, batas, pro });

// Bentuk responseSchema native Gemini (tipe huruf besar, nullable).
export const SKEMA = {
  type: 'OBJECT',
  properties: {
    adalah_tagihan: { type: 'BOOLEAN' },
    pemberi: { type: 'STRING', nullable: true },
    tipe: { type: 'STRING', enum: ['cicilan_tetap', 'berbunga'], nullable: true },
    nominal_cicilan: { type: 'INTEGER', nullable: true },
    tenor_bulan: { type: 'INTEGER', nullable: true },
    jatuh_tempo: { type: 'STRING', nullable: true },
    pokok_awal: { type: 'INTEGER', nullable: true },
    bunga_persen_bulanan: { type: 'NUMBER', nullable: true },
    sisa_pokok: { type: 'INTEGER', nullable: true },
    catatan: { type: 'STRING', nullable: true },
  },
  required: [
    'adalah_tagihan',
    'pemberi',
    'tipe',
    'nominal_cicilan',
    'tenor_bulan',
    'jatuh_tempo',
    'pokok_awal',
    'bunga_persen_bulanan',
    'sisa_pokok',
    'catatan',
  ],
} as const;

export function buatPromptHutang(hariIni: string): string {
  return `Kamu membaca SCREENSHOT tagihan, cicilan, atau pinjaman (paylater, kartu kredit, pinjol, cicilan barang, koperasi) milik pengguna di Indonesia, lalu mengisi data hutang untuk dikonfirmasi pengguna.
Hari ini: ${hariIni} (format YYYY-MM-DD). Bila tanggal di gambar tanpa tahun, simpulkan tahunnya agar jatuh tempo berikutnya berada pada atau setelah hari ini.

Aturan:
- adalah_tagihan: false bila gambar bukan tagihan/cicilan/pinjaman atau tidak terbaca; isi semua kolom lain null.
- pemberi: nama penyedia/pemberi pinjaman (misalnya SPayLater, Kredivo, BCA, Akulaku), maksimal 40 huruf.
- tipe: "cicilan_tetap" bila ada cicilan bulanan tetap dan tenor; "berbunga" bila ada bunga persen per bulan dan pokok pinjaman.
- nominal_cicilan: jumlah yang harus dibayar per bulan (rupiah, bilangan bulat). Untuk "tagihan bulan ini" atau "total tagihan" kartu kredit, pakai jumlah tagihan bulan ini. "Minimum pembayaran" bukan cicilan tetap kecuali itu satu-satunya angka.
- tenor_bulan: SISA tenor (jumlah cicilan yang belum dibayar). "Cicilan ke-3 dari 12" berarti sisa 9 bila ke-3 sudah dibayar, atau 10 bila belum. Bila hanya tenor total yang terlihat, pakai tenor total. Isi 1 sampai 60.
- jatuh_tempo: tanggal jatuh tempo BERIKUTNYA yang belum dibayar, format YYYY-MM-DD.
- pokok_awal: jumlah pinjaman awal/pokok (rupiah).
- sisa_pokok: sisa pokok/sisa tagihan yang masih harus dilunasi (rupiah), tidak boleh melebihi pokok_awal.
- bunga_persen_bulanan: bunga persen PER BULAN (bila tertulis per tahun, bagi 12). Maksimal 2 desimal.
- LIMIT / batas kredit / plafon BUKAN hutang: jangan dipakai sebagai pokok atau cicilan.
- Denda/keterlambatan: jangan dimasukkan ke nominal_cicilan; sebut singkat di catatan.
- catatan: info penting lain, maksimal 120 huruf, atau null.
- Nilai yang tidak terlihat jelas: null. Jangan menebak angka. Rupiah selalu bilangan bulat tanpa titik/koma (Rp 1.250.000 = 1250000).`;
}

function teks(v: unknown, maks: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  return t ? Array.from(t).slice(0, maks).join('') : null;
}

function rupiah(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const r = Math.round(v);
  return r > 0 && r <= 1e12 ? r : null;
}

function tenor(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const r = Math.round(v);
  return r >= 1 && r <= 60 ? r : null;
}

function tanggal(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const sah = dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  return sah && y >= 2000 && y <= 2100 ? m[0] : null;
}

function bunga(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) return null;
  return Math.round(v * 100) / 100;
}

/** Validasi hasil AI; null bila bukan tagihan atau tidak ada cicilan/pokok yang bisa dipakai. */
export function validasiDrafHutang(mentah: unknown): DrafHutang | null {
  if (typeof mentah !== 'object' || mentah === null || Array.isArray(mentah)) return null;
  const o = mentah as Record<string, unknown>;
  if (o.adalah_tagihan === false) return null;

  const pemberi = teks(o.pemberi, 40);
  if (!pemberi) return null;

  const nominal_cicilan = rupiah(o.nominal_cicilan);
  const pokok_awal = rupiah(o.pokok_awal);
  if (nominal_cicilan === null && pokok_awal === null) return null;

  const tenor_bulan = tenor(o.tenor_bulan);
  const bunga_persen_bulanan = bunga(o.bunga_persen_bulanan);
  let sisa_pokok = rupiah(o.sisa_pokok);
  if (sisa_pokok !== null && pokok_awal !== null && sisa_pokok > pokok_awal) sisa_pokok = null;

  let tipe: DrafHutang['tipe'];
  if (o.tipe === 'cicilan_tetap' || o.tipe === 'berbunga') tipe = o.tipe;
  else if (nominal_cicilan !== null && tenor_bulan !== null) tipe = 'cicilan_tetap';
  else if (bunga_persen_bulanan !== null && pokok_awal !== null) tipe = 'berbunga';
  else tipe = nominal_cicilan !== null ? 'cicilan_tetap' : 'berbunga';

  return {
    pemberi,
    tipe,
    nominal_cicilan,
    tenor_bulan,
    jatuh_tempo: tanggal(o.jatuh_tempo),
    pokok_awal,
    bunga_persen_bulanan,
    sisa_pokok,
    catatan: teks(o.catatan, 120),
  };
}

type Masukan = { gambar: Uint8Array; mime: string };

function bacaMasukan(body: unknown): Masukan | Response {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return galat(400, 'bad_request', PESAN.kosong);
  }
  const { gambar_base64, mime } = body as Record<string, unknown>;
  if (typeof gambar_base64 !== 'string' || gambar_base64.trim() === '') {
    return galat(400, 'bad_request', PESAN.kosong);
  }
  const m = typeof mime === 'string' ? mime.trim().toLowerCase() : '';
  if (!(MIME_GAMBAR as readonly string[]).includes(m)) return galat(400, 'bad_request', PESAN.mime);
  const gambar = decodeBase64(gambar_base64);
  if (gambar === 'besar') return galat(400, 'bad_request', PESAN.besar);
  if (!gambar || gambar.length === 0) return galat(400, 'bad_request', PESAN.kosong);
  return { gambar, mime: m };
}

// Catat tahap yang gagal saja: jangan pernah mencetak gambar, hasil, atau kunci API.
const catat = (tahap: string) => console.error(`parse-hutang: gagal di tahap ${tahap}`);

export function buatHandlerHutangGambar(deps: DepsHutangGambar): (req: Request) => Promise<Response> {
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

    // Cek kuota dulu: habis → 402 tanpa memanggil AI.
    let kuota: Kuota;
    let hariIni: string;
    try {
      kuota = tanpaOk(await db.kuota());
      if (kuota.terpakai >= kuota.batas) return galat(402, 'quota_exceeded', PESAN.kuota, kuota);
      hariIni = await db.hariIni(deps.sekarang());
    } catch (e) {
      if (e instanceof GalatSesi) return galat(401, 'unauthorized', PESAN.unauthorized);
      catat('db');
      return galat(500, 'server', PESAN.server);
    }

    let mentah: unknown;
    try {
      mentah = await deps.ai.baca(masukan.gambar, masukan.mime, buatPromptHutang(hariIni));
    } catch {
      catat('ai');
      return galat(502, 'ai_gagal', PESAN.ai);
    }

    const draf = validasiDrafHutang(mentah);
    if (!draf) return json(200, { draf: null, pesan: PESAN.bukanTagihan, kuota });

    try {
      const pakai = await db.pakaiKuota();
      kuota = tanpaOk(pakai);
      if (!pakai.ok) return galat(402, 'quota_exceeded', PESAN.kuota, kuota);
    } catch (e) {
      if (e instanceof GalatSesi) return galat(401, 'unauthorized', PESAN.unauthorized);
      catat('pakai_kuota');
      return galat(500, 'server', PESAN.server);
    }

    return json(200, { draf, pesan: null, kuota });
  };
}
