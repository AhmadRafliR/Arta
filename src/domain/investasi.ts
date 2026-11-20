import type { BalanceTx } from './balances';
import type { Wallet } from './types';

export type RingkasAset = {
  id: string;
  nama: string;
  nilai: number;
  modal: number;
  untung: number;
  persen: number | null;
};

const persen1 = (untung: number, modal: number) => (modal > 0 ? Math.round((untung / modal) * 1000) / 10 : null);

/** Modal = saldo_awal + transfer masuk - transfer keluar + hutang_baru - hutang_bayar. */
export function ringkasAset(wallet: Wallet, nilai: number, txs: BalanceTx[]): RingkasAset {
  let modal = wallet.saldo_awal;
  for (const t of txs) {
    if (t.jenis === 'transfer') {
      if (t.wallet_tujuan_id === wallet.id) modal += t.nominal;
      if (t.wallet_id === wallet.id) modal -= t.nominal;
    } else if (t.wallet_id === wallet.id) {
      if (t.jenis === 'hutang_baru') modal += t.nominal;
      else if (t.jenis === 'hutang_bayar') modal -= t.nominal;
    }
  }
  const untung = nilai - modal;
  return { id: wallet.id, nama: wallet.nama, nilai, modal, untung, persen: persen1(untung, modal) };
}

export function ringkasInvestasi(
  wallets: Wallet[],
  balances: Record<string, number>,
  txs: BalanceTx[],
): { aset: RingkasAset[]; totalNilai: number; totalModal: number; totalUntung: number; persen: number | null } {
  const aset = wallets
    .filter((w) => w.tipe === 'investasi' && !w.diarsip)
    .map((w) => ringkasAset(w, balances[w.id] ?? 0, txs));
  const totalNilai = aset.reduce((s, a) => s + a.nilai, 0);
  const totalModal = aset.reduce((s, a) => s + a.modal, 0);
  const totalUntung = totalNilai - totalModal;
  return { aset, totalNilai, totalModal, totalUntung, persen: persen1(totalUntung, totalModal) };
}
