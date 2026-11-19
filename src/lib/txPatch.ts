import type { NewTx } from '@/data/transactions';
import type { Tx } from '@/domain/types';

export type NilaiForm = Pick<NewTx, 'tanggal' | 'jenis' | 'kategori' | 'nominal' | 'wallet_id' | 'wallet_tujuan_id' | 'catatan'>;

/**
 * Hanya kolom yang berubah. Bila jenis berubah, kategori dan wallet_tujuan_id selalu ikut dikirim
 * (constraint: wallet_tujuan_id terisi tepat bila jenis = transfer).
 */
export function buatPatch(awal: Tx, baru: NilaiForm): Partial<Omit<NewTx, 'id'>> {
  const patch: Partial<Omit<NewTx, 'id'>> = {};
  const jenisBerubah = baru.jenis !== awal.jenis;
  if (baru.tanggal !== awal.tanggal) patch.tanggal = baru.tanggal;
  if (jenisBerubah) patch.jenis = baru.jenis;
  if (jenisBerubah || baru.kategori !== awal.kategori) patch.kategori = baru.kategori;
  if (baru.nominal !== awal.nominal) patch.nominal = baru.nominal;
  if (baru.wallet_id !== awal.wallet_id) patch.wallet_id = baru.wallet_id;
  if (jenisBerubah || baru.wallet_tujuan_id !== awal.wallet_tujuan_id) patch.wallet_tujuan_id = baru.wallet_tujuan_id;
  if (baru.catatan !== awal.catatan) patch.catatan = baru.catatan;
  return patch;
}
