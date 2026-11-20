// Penyusun ekspor: ambil data (RLS), susun XLSX/CSV, lalu bagikan.
import { hariIni, ZONA_BAWAAN } from '@/lib/tanggal';
import { ambilSemua, type FilterTanggal } from './ambil';
import { simpanDanBagikan } from './bagikan';
import { buatCsv, MIME_CSV } from './csv';
import { barisSumber, SUMBER_EKSPOR, SUMBER_TRANSAKSI, type KonteksEkspor, type SumberEkspor } from './sumber';
import { buatXlsx, MIME_XLSX } from './xlsx';

export type FormatEkspor = 'xlsx' | 'csv';
export type RentangEkspor = 'semua' | 'tahun' | 'bulan';

const p2 = (n: number) => String(n).padStart(2, '0');

function hariTerakhir(y: number, m: number): number {
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** Rentang inklusif 'YYYY-MM-DD' menurut tanggal hari ini di `zona`; `null` = semua. */
export function batasRentang(
  rentang: RentangEkspor,
  zona: string = ZONA_BAWAAN,
  now: Date = new Date(),
): { dari: string; sampai: string } | null {
  if (rentang === 'semua') return null;
  const [y, m] = hariIni(zona, now).split('-').map(Number);
  if (rentang === 'tahun') return { dari: `${y}-01-01`, sampai: `${y}-12-31` };
  return { dari: `${y}-${p2(m)}-01`, sampai: `${y}-${p2(m)}-${p2(hariTerakhir(y, m))}` };
}

export function namaBerkas(format: FormatEkspor, zona: string = ZONA_BAWAAN, now: Date = new Date()): string {
  return `arta-ekspor-${hariIni(zona, now)}.${format}`;
}

async function ambilSumber(s: SumberEkspor, batas: { dari: string; sampai: string } | null) {
  const filter: FilterTanggal | undefined =
    batas && s.filterTanggal ? { kolom: s.filterTanggal, ...batas } : undefined;
  return ambilSemua(s.tabel, s.select, s.urut, filter);
}

async function konteks(): Promise<KonteksEkspor> {
  const dompet = await ambilSemua('wallets', 'id,nama', { kolom: 'id', naik: true });
  return { namaDompet: new Map(dompet.map((d) => [String(d.id), String(d.nama ?? '')])) };
}

/** Susun isi berkas tanpa menyentuh sistem berkas (bisa dites langsung). */
export async function susunEkspor(
  format: FormatEkspor,
  rentang: RentangEkspor,
  zona: string = ZONA_BAWAAN,
  now: Date = new Date(),
): Promise<{ nama: string; isi: string | Uint8Array; mime: string; uti: string }> {
  const batas = batasRentang(rentang, zona, now);
  const nama = namaBerkas(format, zona, now);
  if (format === 'csv') {
    const [ctx, data] = await Promise.all([konteks(), ambilSumber(SUMBER_TRANSAKSI, batas)]);
    return {
      nama,
      isi: buatCsv(barisSumber(SUMBER_TRANSAKSI, data, ctx)),
      mime: MIME_CSV,
      uti: 'public.comma-separated-values-text',
    };
  }
  const [ctx, semua] = await Promise.all([konteks(), Promise.all(SUMBER_EKSPOR.map((s) => ambilSumber(s, batas)))]);
  const sheet = SUMBER_EKSPOR.map((s, i) => ({ nama: s.judul, baris: barisSumber(s, semua[i], ctx) }));
  return { nama, isi: buatXlsx(sheet), mime: MIME_XLSX, uti: 'org.openxmlformats.spreadsheetml.sheet' };
}

export async function jalankanEkspor(format: FormatEkspor, rentang: RentangEkspor, zona?: string): Promise<void> {
  const b = await susunEkspor(format, rentang, zona);
  await simpanDanBagikan(b.nama, b.isi, b.mime, b.uti);
}
