// Handler Edge Function `report-send` (token pengguna): kirim laporan sekarang / kirim email
// verifikasi penerima. Hanya API web standar; dependensi disuntikkan. Penyambung Deno ada di
// ../../report-send/index.ts.
import { CORS, GalatSesi, tanggalDiZona } from '../handler.ts';
import { esc, renderLaporan } from './html.ts';
import { buatIsiLaporan, type DataLaporan, type IsiLaporan } from './isi.ts';
import type { PengirimEmail } from './email.ts';
import { buatToken, MASA_HENTI, MASA_VERIF, type Tandatangan } from './token.ts';

export type PenerimaLaporan = { id: string; email: string; terverifikasi: boolean };

export type DbKirim = {
  /** Lempar GalatSesi bila token ditolak. */
  userId(): Promise<string>;
  pro(): Promise<boolean>;
  /** Nama tampilan pengguna (profiles.nama) untuk email verifikasi. */
  nama(): Promise<string | null>;
  data(): Promise<DataLaporan>;
  penerima(): Promise<PenerimaLaporan[]>;
  mulaiKirim(bulan: string): Promise<string>;
  selesaiKirim(id: string, status: 'terkirim' | 'gagal', jumlah: number): Promise<void>;
  tandaiVerifikasi(recipientId: string): Promise<boolean>;
};

export type DepsKirim = {
  db(token: string): DbKirim;
  email: PengirimEmail;
  tandatangan: Tandatangan;
  urlVerify: string;
  sekarang(): Date;
  /** Hanya menerima kode status/jumlah; bawaan console.log. */
  log?: (baris: string) => void;
};

type KodeGalat =
  | 'unauthorized'
  | 'bad_request'
  | 'bukan_pro'
  | 'tanpa_penerima'
  | 'batas'
  | 'tidak_ditemukan'
  | 'server';

export const PESAN_KIRIM = {
  unauthorized: 'Sesi habis, masuk lagi.',
  badRequest: 'Permintaan tidak valid.',
  bulan: 'Hanya laporan bulan ini atau bulan lalu yang bisa dikirim.',
  bukanPro: 'Laporan email khusus Pro.',
  tanpaPenerima: 'Belum ada penerima terverifikasi.',
  batasKirim: 'Batas kirim laporan 3 kali per hari. Coba lagi besok.',
  batasVerifikasi: 'Tunggu 10 menit sebelum mengirim ulang verifikasi.',
  tidakDitemukan: 'Penerima tidak ditemukan.',
  sudahTerverifikasi: 'Penerima ini sudah terverifikasi.',
  gagalKirim: 'Laporan gagal dikirim, coba lagi.',
  gagalVerifikasi: 'Email verifikasi gagal dikirim, coba lagi nanti.',
  server: 'Terjadi kesalahan, coba lagi.',
} as const;

export const SUBJEK_VERIFIKASI = 'Konfirmasi penerima laporan arta';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });

const galat = (status: number, kode: KodeGalat, pesan: string) => json(status, { galat: kode, pesan });

function tokenDari(req: Request): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get('authorization') ?? '');
  return m ? m[1] : null;
}

const POLA_BULAN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function bulanSebelum(bulan: string): string {
  const [t, b] = bulan.split('-').map(Number);
  return b === 1 ? `${t - 1}-12` : `${t}-${String(b - 1).padStart(2, '0')}`;
}

const pesanGalat = (e: unknown) => (e instanceof Error ? e.message : '');

export const urlDenganToken = (urlVerify: string, token: string) =>
  `${urlVerify}${urlVerify.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;

/**
 * Render dan kirim satu email per penerima terverifikasi (masing-masing dengan tautan berhenti
 * miliknya sendiri). Mengembalikan jumlah email yang berhasil.
 */
export async function kirimLaporanKePenerima(o: {
  isi: IsiLaporan;
  penerima: PenerimaLaporan[];
  email: PengirimEmail;
  tandatangan: Tandatangan;
  urlVerify: string;
  sekarang: Date;
}): Promise<number> {
  const exp = Math.floor(o.sekarang.getTime() / 1000) + MASA_HENTI;
  let n = 0;
  for (const p of o.penerima) {
    if (!p.terverifikasi) continue;
    try {
      const token = await buatToken({ tujuan: 'henti', recipientId: p.id, email: p.email, exp }, o.tandatangan);
      const urlBerhenti = urlDenganToken(o.urlVerify, token);
      const r = renderLaporan(o.isi, { urlBerhenti });
      await o.email.kirim({
        ke: p.email,
        subjek: r.subjek,
        html: r.html,
        teks: r.teks,
        header: {
          'List-Unsubscribe': `<${urlBerhenti}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      n += 1;
    } catch {
      // Satu penerima gagal tidak menghentikan yang lain; detail tidak dicatat (bisa memuat alamat).
    }
  }
  return n;
}

export function renderVerifikasi(nama: string | null, url: string): { html: string; teks: string } {
  const siapa = nama ?? 'Pengguna arta';
  const kalimat = `${siapa} ingin mengirim laporan keuangan bulanan ke alamat email ini lewat arta.`;
  const html =
    `<!doctype html><html lang="id"><body style="margin:0;padding:0;background:#EEF3F5;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F5;padding:24px 0;"><tr><td align="center">` +
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:12px;font-family:Arial,Helvetica,sans-serif;color:#0B424F;">` +
    `<tr><td style="padding:24px;">` +
    `<div style="font-size:20px;font-weight:bold;padding-bottom:12px;">Konfirmasi penerima laporan</div>` +
    `<p style="font-size:14px;line-height:20px;margin:0 0 16px 0;">${esc(kalimat)}</p>` +
    `<p style="font-size:14px;line-height:20px;margin:0 0 20px 0;">Kalau kamu setuju, tekan tombol di bawah. Tautan berlaku 7 hari.</p>` +
    `<a href="${esc(url)}" style="display:inline-block;background:#52C3BF;color:#0B424F;font-weight:bold;font-size:14px;text-decoration:none;padding:12px 20px;border-radius:8px;">Konfirmasi email</a>` +
    `<p style="font-size:12px;line-height:18px;color:#52707A;margin:20px 0 0 0;">Kalau kamu tidak mengenal pengirimnya, abaikan email ini. Kamu tidak akan menerima laporan tanpa konfirmasi.</p>` +
    `</td></tr></table></td></tr></table></body></html>`;
  const teks = [
    'Konfirmasi penerima laporan',
    '',
    kalimat,
    'Kalau kamu setuju, buka tautan ini (berlaku 7 hari):',
    url,
    '',
    'Kalau kamu tidak mengenal pengirimnya, abaikan email ini.',
  ].join('\n');
  return { html, teks };
}

export function buatHandlerKirim(deps: DepsKirim): (req: Request) => Promise<Response> {
  const log = deps.log ?? ((b: string) => console.log(b));

  async function verifikasi(db: DbKirim, recipientId: string): Promise<Response> {
    const daftar = await db.penerima();
    const p = daftar.find((x) => x.id === recipientId);
    if (!p) return galat(404, 'tidak_ditemukan', PESAN_KIRIM.tidakDitemukan);
    if (p.terverifikasi) return galat(409, 'bad_request', PESAN_KIRIM.sudahTerverifikasi);

    let boleh: boolean;
    try {
      boleh = await db.tandaiVerifikasi(p.id);
    } catch (e) {
      const m = pesanGalat(e);
      if (m.includes('sudah terverifikasi')) return galat(409, 'bad_request', PESAN_KIRIM.sudahTerverifikasi);
      if (m.includes('tidak ditemukan')) return galat(404, 'tidak_ditemukan', PESAN_KIRIM.tidakDitemukan);
      throw e;
    }
    if (!boleh) {
      log('report-send: verifikasi 429');
      return galat(429, 'batas', PESAN_KIRIM.batasVerifikasi);
    }

    const nama = await db.nama();
    const exp = Math.floor(deps.sekarang().getTime() / 1000) + MASA_VERIF;
    const token = await buatToken({ tujuan: 'verif', recipientId: p.id, email: p.email, exp }, deps.tandatangan);
    const isi = renderVerifikasi(nama, urlDenganToken(deps.urlVerify, token));
    try {
      await deps.email.kirim({ ke: p.email, subjek: SUBJEK_VERIFIKASI, html: isi.html, teks: isi.teks });
    } catch {
      log('report-send: verifikasi 502');
      return galat(502, 'server', PESAN_KIRIM.gagalVerifikasi);
    }
    log('report-send: verifikasi 200');
    return json(200, { terkirim: true });
  }

  async function kirim(db: DbKirim, bulanMinta: string | undefined): Promise<Response> {
    const [data, daftar] = await Promise.all([db.data(), db.penerima()]);
    const hariIni = tanggalDiZona(deps.sekarang(), data.zona);
    const bulanIni = hariIni.slice(0, 7);
    const bulan = bulanMinta ?? bulanIni;
    if (bulan !== bulanIni && bulan !== bulanSebelum(bulanIni)) {
      return galat(400, 'bad_request', PESAN_KIRIM.bulan);
    }
    const terverifikasi = daftar.filter((p) => p.terverifikasi);
    if (terverifikasi.length === 0) return galat(409, 'tanpa_penerima', PESAN_KIRIM.tanpaPenerima);

    let logId: string;
    try {
      logId = await db.mulaiKirim(bulan);
    } catch (e) {
      if (pesanGalat(e).includes('Batas kirim laporan')) {
        log('report-send: kirim 429');
        return galat(429, 'batas', PESAN_KIRIM.batasKirim);
      }
      throw e;
    }

    let n = 0;
    try {
      const isi = buatIsiLaporan(data, bulan, bulan === bulanIni ? hariIni : undefined);
      n = await kirimLaporanKePenerima({
        isi,
        penerima: terverifikasi,
        email: deps.email,
        tandatangan: deps.tandatangan,
        urlVerify: deps.urlVerify,
        sekarang: deps.sekarang(),
      });
    } catch {
      n = 0;
    }

    try {
      await db.selesaiKirim(logId, n > 0 ? 'terkirim' : 'gagal', n);
    } catch {
      log('report-send: selesai_kirim gagal');
    }
    if (n === 0) {
      log('report-send: kirim 502');
      return galat(502, 'server', PESAN_KIRIM.gagalKirim);
    }
    log(`report-send: kirim 200 jumlah=${n}/${terverifikasi.length}`);
    return json(200, { terkirim: n, bulan });
  }

  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });
    if (req.method !== 'POST') return galat(400, 'bad_request', PESAN_KIRIM.badRequest);

    const token = tokenDari(req);
    if (!token) return galat(401, 'unauthorized', PESAN_KIRIM.unauthorized);

    let body: Record<string, unknown>;
    try {
      const b = await req.json();
      if (typeof b !== 'object' || b === null || Array.isArray(b)) throw new Error('bentuk');
      body = b as Record<string, unknown>;
    } catch {
      return galat(400, 'bad_request', PESAN_KIRIM.badRequest);
    }

    const { aksi, recipient_id, bulan } = body;
    if (aksi === 'verifikasi') {
      if (typeof recipient_id !== 'string' || !recipient_id) {
        return galat(400, 'bad_request', PESAN_KIRIM.badRequest);
      }
    } else if (aksi === 'kirim') {
      if (bulan !== undefined && bulan !== null && (typeof bulan !== 'string' || !POLA_BULAN.test(bulan))) {
        return galat(400, 'bad_request', PESAN_KIRIM.bulan);
      }
    } else {
      return galat(400, 'bad_request', PESAN_KIRIM.badRequest);
    }

    const db = deps.db(token);
    try {
      await db.userId();
      if (!(await db.pro())) {
        log(`report-send: ${aksi} 403`);
        return galat(403, 'bukan_pro', PESAN_KIRIM.bukanPro);
      }
      return aksi === 'verifikasi'
        ? await verifikasi(db, recipient_id as string)
        : await kirim(db, typeof bulan === 'string' ? bulan : undefined);
    } catch (e) {
      if (e instanceof GalatSesi) return galat(401, 'unauthorized', PESAN_KIRIM.unauthorized);
      log(`report-send: ${aksi} 500`);
      return galat(500, 'server', PESAN_KIRIM.server);
    }
  };
}
