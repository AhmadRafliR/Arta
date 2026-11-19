import type { Tx } from './types';

// bulan: 'YYYY-MM'; tanggal transaksi berupa string lokal 'YYYY-MM-DD'.
export function monthSummary(txs: Tx[], bulan: string): { masuk: number; keluar: number; selisih: number } {
  let masuk = 0;
  let keluar = 0;
  for (const t of txs) {
    if (!t.tanggal.startsWith(`${bulan}-`)) continue;
    if (t.jenis === 'pemasukan') masuk += t.nominal;
    else if (t.jenis === 'pengeluaran') keluar += t.nominal;
  }
  return { masuk, keluar, selisih: masuk - keluar };
}
