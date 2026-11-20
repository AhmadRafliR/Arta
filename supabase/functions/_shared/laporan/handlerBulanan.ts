// Handler Edge Function `report-monthly` (dipanggil pg_cron tiap jam, header x-cron-secret).
// Mengirim laporan bulan lalu untuk pengguna Pro yang tanggal lokalnya 1–7 (tanggal 1 mulai
// pukul 08.00). Baris report_log diklaim lebih dulu agar eksekusi ganda tidak mengirim dobel.
// Hanya API web standar; dependensi disuntikkan. Penyambung Deno ada di ../../report-monthly/index.ts.
import { buatIsiLaporan, type DataLaporan } from './isi.ts';
import type { PengirimEmail } from './email.ts';
import type { Tandatangan } from './token.ts';
import { bulanSebelum, kirimLaporanKePenerima, type PenerimaLaporan } from './handlerKirim.ts';

export type DepsBulanan = {
  rahasiaCron: string;
  /** Pro aktif + ≥1 penerima terverifikasi. */
  kandidat(): Promise<{ userId: string; zona: string }[]>;
  /** Sisipkan report_log bulanan; null bila sudah ada (23505). */
  klaim(userId: string, bulan: string): Promise<string | null>;
  data(userId: string): Promise<DataLaporan>;
  penerima(userId: string): Promise<PenerimaLaporan[]>;
  selesai(id: string, status: 'terkirim' | 'gagal', jumlah: number): Promise<void>;
  email: PengirimEmail;
  tandatangan: Tandatangan;
  urlVerify: string;
  sekarang(): Date;
  /** Hanya menerima jumlah; bawaan console.log. */
  log?: (baris: string) => void;
};

const ZONA_BAWAAN = 'Asia/Jakarta';

/** Tanggal (YYYY-MM-DD) dan jam lokal (0–23) di zona; zona kosong/tidak valid → Asia/Jakarta. */
export function waktuLokal(sekarang: Date, zona: string | null | undefined): { tanggal: string; jam: number } {
  const ambil = (timeZone: string) => {
    const bagian = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(sekarang);
    const v = (k: string) => bagian.find((p) => p.type === k)?.value ?? '';
    return { tanggal: `${v('year')}-${v('month')}-${v('day')}`, jam: Number(v('hour')) % 24 };
  };
  try {
    return ambil(zona || ZONA_BAWAAN);
  } catch {
    return ambil(ZONA_BAWAAN);
  }
}

/** Keputusan 11: tanggal lokal 1–7, dan bila tanggal 1 jam lokal ≥ 8. */
export function waktunyaKirim(w: { tanggal: string; jam: number }): boolean {
  const hari = Number(w.tanggal.slice(8, 10));
  if (hari < 1 || hari > 7) return false;
  return hari > 1 || w.jam >= 8;
}

function samaKonstan(a: string, b: string): boolean {
  let beda = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) beda |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return beda === 0;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

type Hasil = 'terkirim' | 'dilewati' | 'gagal';

export function buatHandlerBulanan(deps: DepsBulanan): (req: Request) => Promise<Response> {
  const log = deps.log ?? ((b: string) => console.log(b));

  async function proses(userId: string, zona: string, sekarang: Date): Promise<Hasil> {
    const lokal = waktuLokal(sekarang, zona);
    if (!waktunyaKirim(lokal)) return 'dilewati';
    const bulan = bulanSebelum(lokal.tanggal.slice(0, 7));

    // Penerima dicek sebelum klaim: tanpa penerima terverifikasi → dicoba lagi jam berikutnya.
    const penerima = (await deps.penerima(userId)).filter((p) => p.terverifikasi);
    if (penerima.length === 0) return 'dilewati';

    const id = await deps.klaim(userId, bulan);
    if (id === null) return 'dilewati';

    let n = 0;
    try {
      const isi = buatIsiLaporan(await deps.data(userId), bulan);
      n = await kirimLaporanKePenerima({
        isi,
        penerima,
        email: deps.email,
        tandatangan: deps.tandatangan,
        urlVerify: deps.urlVerify,
        sekarang,
      });
    } catch {
      n = 0;
    }
    try {
      await deps.selesai(id, n > 0 ? 'terkirim' : 'gagal', n);
    } catch {
      log('report-monthly: selesai gagal');
    }
    return n > 0 ? 'terkirim' : 'gagal';
  }

  return async (req) => {
    const rahasia = req.headers.get('x-cron-secret') ?? '';
    if (!deps.rahasiaCron || !samaKonstan(rahasia, deps.rahasiaCron)) {
      return json(401, { galat: 'unauthorized' });
    }

    let kandidat: { userId: string; zona: string }[];
    try {
      kandidat = await deps.kandidat();
    } catch {
      log('report-monthly: kandidat 500');
      return json(500, { galat: 'server' });
    }

    const sekarang = deps.sekarang();
    const hitung = { diproses: kandidat.length, terkirim: 0, dilewati: 0, gagal: 0 };
    for (const k of kandidat) {
      try {
        hitung[await proses(k.userId, k.zona, sekarang)] += 1;
      } catch {
        // Galat satu pengguna tidak menghentikan pengguna lain.
        hitung.gagal += 1;
      }
    }
    log(
      `report-monthly: diproses=${hitung.diproses} terkirim=${hitung.terkirim} dilewati=${hitung.dilewati} gagal=${hitung.gagal}`,
    );
    return json(200, hitung);
  };
}
