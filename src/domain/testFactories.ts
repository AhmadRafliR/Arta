import type { Hutang, Jenis, TipeDompet, Tx, Wallet } from './types';

export const W = (id: string, saldo: number, tipe: TipeDompet = 'harian'): Wallet => ({
  id,
  nama: id,
  tipe,
  saldo_awal: saldo,
  tanggal_saldo_awal: '2026-11-01',
  target: null,
  diarsip: false,
});

export const T = (
  jenis: Jenis,
  nominal: number,
  wallet: string | null,
  tujuan: string | null = null,
  tanggal = '2026-11-19',
): Tx => ({
  id: `${jenis}-${nominal}-${wallet}-${tujuan}-${tanggal}`,
  tanggal,
  jenis,
  kategori: null,
  nominal,
  wallet_id: wallet,
  wallet_tujuan_id: tujuan,
  debt_id: null,
  porsi_bunga: null,
  porsi_pokok: null,
  catatan: null,
  transkrip: null,
  sumber: 'manual',
});

/** Hutang berbunga flat 2%/bulan, pokok 1.000.000, belum dibayar, tanpa jadwal. */
export const buatHutang = (over: Partial<Hutang> = {}): Hutang => ({
  id: 'h1',
  pemberi: 'Kredivo',
  tipe: 'berbunga',
  tanggal_mulai: '2026-11-01',
  pokok_awal: 1_000_000,
  nominal_cicilan: null,
  tenor_bulan: null,
  bunga_persen_bulanan: 2,
  metode: 'flat',
  diarsip: false,
  sisa_pokok: 1_000_000,
  total_bunga: 0,
  total_bayar: 0,
  jumlah_tagihan: 0,
  tagihan_lunas: 0,
  jatuh_tempo_berikutnya: null,
  nominal_berikutnya: null,
  jatuh_tempo_terakhir: null,
  bayar_terakhir: null,
  ...over,
});
