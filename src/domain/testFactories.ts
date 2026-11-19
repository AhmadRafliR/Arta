import type { Jenis, TipeDompet, Tx, Wallet } from './types';

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
