import type { Jenis, Tx } from '@/domain/types';

export type FilterTx = { jenis?: Jenis; kategori?: string; walletId?: string };

/** Filter AND. walletId cocok dengan dompet asal atau tujuan (transfer muncul di kedua dompet). */
export function filterTx(txs: Tx[], f: FilterTx): Tx[] {
  return txs.filter(
    (t) =>
      (!f.jenis || t.jenis === f.jenis) &&
      (!f.kategori || t.kategori === f.kategori) &&
      (!f.walletId || t.wallet_id === f.walletId || t.wallet_tujuan_id === f.walletId),
  );
}

export type KelompokHari = { tanggal: string; total: number; items: Tx[] };

/** Kelompokkan per tanggal (terbaru dulu). total = pemasukan - pengeluaran; jenis lain tidak dihitung. */
export function kelompokHarian(txs: Tx[]): KelompokHari[] {
  const peta = new Map<string, KelompokHari>();
  for (const t of txs) {
    let g = peta.get(t.tanggal);
    if (!g) {
      g = { tanggal: t.tanggal, total: 0, items: [] };
      peta.set(t.tanggal, g);
    }
    g.items.push(t);
    if (t.jenis === 'pemasukan') g.total += t.nominal;
    else if (t.jenis === 'pengeluaran') g.total -= t.nominal;
  }
  return [...peta.values()].sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0));
}
