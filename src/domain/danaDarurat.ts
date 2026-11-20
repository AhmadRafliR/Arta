import { geserBulan } from '@/lib/tanggal';
import type { Tx, Wallet } from './types';

export type RingkasDarurat = {
  dompet: { id: string; nama: string; saldo: number; target: number | null; persen: number | null }[];
  total: number;
  totalTarget: number | null;
  persen: number | null;
  cakupanBulan: number | null;
};

const persenDari = (a: number, b: number) => Math.floor((a * 100) / b);

export function ringkasDarurat(
  wallets: Wallet[],
  balances: Record<string, number>,
  txs: Pick<Tx, 'tanggal' | 'jenis' | 'nominal'>[],
  bulanIni: string,
): RingkasDarurat {
  const dompet = wallets
    .filter((w) => w.tipe === 'darurat' && !w.diarsip)
    .map((w) => {
      const saldo = balances[w.id] ?? 0;
      const target = w.target;
      return {
        id: w.id,
        nama: w.nama,
        saldo,
        target,
        persen: target !== null && target > 0 ? persenDari(saldo, target) : null,
      };
    });
  const total = dompet.reduce((s, d) => s + d.saldo, 0);
  const adaTarget = dompet.filter((d) => d.target !== null && d.target > 0);
  const totalTarget = adaTarget.length > 0 ? adaTarget.reduce((s, d) => s + (d.target as number), 0) : null;
  const persen = totalTarget !== null ? persenDari(total, totalTarget) : null;

  // Rata-rata pengeluaran 3 bulan kalender penuh sebelum bulanIni; bulan tanpa pengeluaran tidak ikut.
  const bulanTiga = [geserBulan(bulanIni, -1), geserBulan(bulanIni, -2), geserBulan(bulanIni, -3)];
  const perBulan = bulanTiga
    .map((b) =>
      txs.filter((t) => t.jenis === 'pengeluaran' && t.tanggal.slice(0, 7) === b).reduce((s, t) => s + t.nominal, 0),
    )
    .filter((n) => n > 0);
  let cakupanBulan: number | null = null;
  if (perBulan.length > 0) {
    const rata = perBulan.reduce((s, n) => s + n, 0) / perBulan.length;
    cakupanBulan = Math.round((total / rata) * 10) / 10;
  }
  return { dompet, total, totalTarget, persen, cakupanBulan };
}
