import { geserBulan } from '@/lib/tanggal';
import type { Hutang } from './types';

export { labelBulan } from '@/lib/tanggal';

/** Total pokok yang dibayar dalam satu bulan ('YYYY-MM'). */
export type PokokBulanan = { bulan: string; pokok: number };

export type RingkasanHutang = {
  totalSisa: number;
  totalAwal: number;
  progres: number; // 0..1
  berikutnya: { hutang: Hutang; tanggal: string; nominal: number } | null;
  bebasPada: string | null; // 'YYYY-MM'
};

// round() numeric Postgres: setengah menjauhi nol.
const bulatkan = (x: number) => Math.sign(x) * Math.round(Math.abs(x));

/**
 * Bunga satu bulan: flat dari pokok awal, efektif dari sisa pokok sebelum bayar.
 * Persen diubah ke basis poin (bilangan bulat) supaya 34,5 tidak terbaca 34,4999….
 */
export function bungaBulanIni(h: Hutang, sisaSebelum: number): number {
  // Sudah lunas: tidak ada bunga (sama dengan hitung_ulang_hutang di server).
  if (h.tipe !== 'berbunga' || !h.bunga_persen_bulanan || sisaSebelum <= 0) return 0;
  const dasar = h.metode === 'efektif' ? sisaSebelum : h.pokok_awal;
  if (dasar <= 0) return 0;
  return bulatkan((dasar * Math.round(h.bunga_persen_bulanan * 100)) / 10000);
}

/**
 * Pratinjau pecahan bunga/pokok (cermin aturan server): pembayaran pertama di bulan
 * kalender membayar bunga lebih dulu, berikutnya seluruhnya pokok.
 */
export function pecahPembayaran(
  h: Hutang,
  nominal: number,
  sudahBayarBulanIni: boolean,
): { bunga: number; pokok: number; lebih: boolean } {
  const bunga = sudahBayarBulanIni ? 0 : Math.min(nominal, bungaBulanIni(h, h.sisa_pokok));
  const pokok = nominal - bunga;
  return { bunga, pokok, lebih: pokok > h.sisa_pokok };
}

// Nomor hari sejak 1970-01-01 dari angka y/m/d (tanpa Date, kebal zona waktu).
function nomorHari(tanggal: string): number {
  const [y0, m, d] = tanggal.split('-').map(Number);
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Selisih hari dari hariIni ke tanggal ('YYYY-MM-DD'); negatif = sudah lewat. */
export function hariMenuju(tanggal: string, hariIni: string): number {
  return nomorHari(tanggal) - nomorHari(hariIni);
}

export function labelJatuhTempo(tanggal: string, hariIni: string): string {
  const n = hariMenuju(tanggal, hariIni);
  if (n === 0) return 'Hari ini';
  if (n === 1) return 'Besok';
  return n > 1 ? `${n} hari lagi` : `Lewat ${-n} hari`;
}

/**
 * Perkiraan bulan bebas hutang ('YYYY-MM'). Ada tagihan belum lunas -> bulan jatuh tempo
 * terakhir; selain itu dari rata-rata pokok 3 bulan terakhir yang ada pembayarannya.
 */
export function perkiraanBebas(h: Hutang, riwayatPokok: PokokBulanan[], hariIni: string): string | null {
  if (h.sisa_pokok <= 0) return null;
  if (h.tagihan_lunas < h.jumlah_tagihan && h.jatuh_tempo_terakhir) return h.jatuh_tempo_terakhir.slice(0, 7);

  const perBulan = new Map<string, number>();
  for (const r of riwayatPokok) perBulan.set(r.bulan, (perBulan.get(r.bulan) ?? 0) + r.pokok);
  const terakhir = [...perBulan]
    .filter(([, pokok]) => pokok > 0)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 3);
  if (terakhir.length === 0) return null;

  const rata = terakhir.reduce((s, [, pokok]) => s + pokok, 0) / terakhir.length;
  return geserBulan(hariIni.slice(0, 7), Math.ceil(h.sisa_pokok / rata));
}

/**
 * Ringkasan tab Hutang dan kartu Beranda (hutang diarsip diabaikan).
 * `riwayatPokok` per id hutang, untuk hutang berbunga tanpa jadwal.
 */
export function ringkasHutang(
  list: Hutang[],
  hariIni: string,
  riwayatPokok: Record<string, PokokBulanan[]> = {},
): RingkasanHutang {
  const aktif = list.filter((h) => !h.diarsip);
  const totalSisa = aktif.reduce((s, h) => s + h.sisa_pokok, 0);
  const totalAwal = aktif.reduce((s, h) => s + h.pokok_awal, 0);
  const progres = totalAwal > 0 ? Math.min(1, Math.max(0, 1 - totalSisa / totalAwal)) : 0;

  const bersisa = aktif.filter((h) => h.sisa_pokok > 0);
  let berikutnya: RingkasanHutang['berikutnya'] = null;
  for (const h of bersisa) {
    const tgl = h.jatuh_tempo_berikutnya;
    if (tgl && (!berikutnya || tgl < berikutnya.tanggal))
      berikutnya = { hutang: h, tanggal: tgl, nominal: h.nominal_berikutnya ?? 0 };
  }

  let bebasPada: string | null = null;
  for (const h of bersisa) {
    const b = perkiraanBebas(h, riwayatPokok[h.id] ?? [], hariIni);
    if (!b) {
      bebasPada = null;
      break;
    }
    if (!bebasPada || b > bebasPada) bebasPada = b;
  }

  return { totalSisa, totalAwal, progres, berikutnya, bebasPada };
}
