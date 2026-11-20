// Daftar sumber ekspor. XLSX = satu sheet per sumber (urutan array ini); CSV = hanya `transaksi`.
import type { Baris, Urut } from './ambil';
import type { Sel } from './xlsx';

export type KonteksEkspor = {
  /** id dompet -> nama (termasuk dompet yang diarsip). */
  namaDompet: Map<string, string>;
};

export type KolomEkspor = { judul: string; nilai: (baris: Baris, ctx: KonteksEkspor) => Sel };

export type SumberEkspor = {
  id: string;
  /** Nama sheet (dibersihkan & dipotong 31 karakter oleh buatXlsx). */
  judul: string;
  tabel: string;
  /** Kolom PostgREST; wajib memuat `id` (pemutus seri paginasi). */
  select: string;
  urut: Urut;
  /** Kolom tanggal yang disaring oleh pilihan rentang (Tahun ini / Bulan ini). Tanpa ini = selalu semua. */
  filterTanggal?: string;
  kolom: KolomEkspor[];
};

const teks = (v: unknown): Sel => (v == null || v === '' ? null : String(v));
/** bigint dari PostgREST datang sebagai number (kadang string); tulis sebagai angka. */
const angka = (v: unknown): Sel => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const label =
  (peta: Record<string, string>) =>
  (v: unknown): Sel =>
    v == null ? null : (peta[String(v)] ?? String(v));
const yaTidak = (v: unknown): Sel => (v === true ? 'Ya' : 'Tidak');
const dompet = (id: unknown, ctx: KonteksEkspor): Sel =>
  typeof id === 'string' ? (ctx.namaDompet.get(id) ?? null) : null;

const labelJenis = label({
  pemasukan: 'Pemasukan',
  pengeluaran: 'Pengeluaran',
  transfer: 'Transfer',
  hutang_baru: 'Hutang baru',
  hutang_bayar: 'Bayar hutang',
  penyesuaian: 'Penyesuaian',
});
const labelSumber = label({ ai: 'AI', manual: 'Manual', import: 'Impor' });
const labelTipe = label({ harian: 'Harian', darurat: 'Darurat', investasi: 'Investasi' });

export const SUMBER_TRANSAKSI: SumberEkspor = {
  id: 'transaksi',
  judul: 'Transaksi',
  tabel: 'transactions',
  select: 'id,tanggal,jenis,kategori,nominal,wallet_id,wallet_tujuan_id,catatan,sumber',
  urut: { kolom: 'tanggal', naik: true },
  filterTanggal: 'tanggal',
  kolom: [
    { judul: 'Tanggal', nilai: (b) => teks(b.tanggal) },
    { judul: 'Jenis', nilai: (b) => labelJenis(b.jenis) },
    { judul: 'Kategori', nilai: (b) => teks(b.kategori) },
    { judul: 'Nominal', nilai: (b) => angka(b.nominal) },
    { judul: 'Dompet', nilai: (b, ctx) => dompet(b.wallet_id, ctx) },
    {
      judul: 'Dompet tujuan',
      nilai: (b, ctx) => (b.jenis === 'transfer' ? dompet(b.wallet_tujuan_id, ctx) : null),
    },
    { judul: 'Catatan', nilai: (b) => teks(b.catatan) },
    { judul: 'Sumber', nilai: (b) => labelSumber(b.sumber) },
  ],
};

export const SUMBER_DOMPET: SumberEkspor = {
  id: 'dompet',
  judul: 'Dompet',
  tabel: 'wallets',
  select: 'id,nama,tipe,saldo_awal,tanggal_saldo_awal,target,diarsip,created_at',
  urut: { kolom: 'created_at', naik: true },
  kolom: [
    { judul: 'Nama', nilai: (b) => teks(b.nama) },
    { judul: 'Tipe', nilai: (b) => labelTipe(b.tipe) },
    { judul: 'Saldo awal', nilai: (b) => angka(b.saldo_awal) },
    { judul: 'Tanggal saldo awal', nilai: (b) => teks(b.tanggal_saldo_awal) },
    { judul: 'Target', nilai: (b) => angka(b.target) },
    { judul: 'Diarsip', nilai: (b) => yaTidak(b.diarsip) },
  ],
};

export const SUMBER_KATEGORI: SumberEkspor = {
  id: 'kategori',
  judul: 'Kategori',
  tabel: 'categories',
  select: 'id,jenis,nama',
  urut: { kolom: 'nama', naik: true },
  kolom: [
    { judul: 'Jenis', nilai: (b) => labelJenis(b.jenis) },
    { judul: 'Nama', nilai: (b) => teks(b.nama) },
  ],
};

export const SUMBER_EKSPOR: SumberEkspor[] = [
  SUMBER_TRANSAKSI,
  SUMBER_DOMPET,
  SUMBER_KATEGORI,
  // Titik tambah Rencana 3: sumber `hutang` (tabel debts) dan `jadwal_hutang` (debt_schedule).
  //   Cukup tambahkan objek SumberEkspor di sini; satu sheet baru otomatis muncul di XLSX.
  //   Pakai `filterTanggal` hanya bila baris memang perlu ikut rentang (mis. jangan untuk daftar hutang).
  // Titik tambah Rencana 4: sumber `budget` (dan penerima laporan bila perlu).
];

/** Header + baris data satu sumber. */
export function barisSumber(s: SumberEkspor, data: Baris[], ctx: KonteksEkspor): Sel[][] {
  return [s.kolom.map((k) => k.judul), ...data.map((b) => s.kolom.map((k) => k.nilai(b, ctx)))];
}
