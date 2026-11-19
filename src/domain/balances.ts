import type { Tx, Wallet } from './types';

// Saldo = saldo_awal + efek SEMUA transaksi pada dompet itu (tanpa filter tanggal).
export function walletBalances(wallets: Wallet[], txs: Tx[]): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const w of wallets) bal[w.id] = w.saldo_awal;
  const tambah = (id: string | null, delta: number) => {
    if (id !== null && id in bal) bal[id] += delta;
  };
  for (const t of txs) {
    switch (t.jenis) {
      case 'pemasukan':
      case 'hutang_baru':
      case 'penyesuaian': // nominal bertanda
        tambah(t.wallet_id, t.nominal);
        break;
      case 'pengeluaran':
      case 'hutang_bayar':
        tambah(t.wallet_id, -t.nominal);
        break;
      case 'transfer':
        tambah(t.wallet_id, -t.nominal);
        tambah(t.wallet_tujuan_id, t.nominal);
        break;
    }
  }
  return bal;
}

// Hanya dompet harian (termasuk yang diarsip).
export function sisaUang(wallets: Wallet[], balances: Record<string, number>): number {
  return wallets.filter((w) => w.tipe === 'harian').reduce((s, w) => s + (balances[w.id] ?? 0), 0);
}

export function kekayaanBersih(balances: Record<string, number>, totalHutang = 0): number {
  return Object.values(balances).reduce((s, v) => s + v, 0) - totalHutang;
}
