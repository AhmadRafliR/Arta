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

/** Rata-rata pengeluaran 3 bulan kalender penuh sebelum bulanIni; bulan tanpa pengeluaran tidak ikut. Null bila tak ada. */
export function rataPengeluaran(txs: Pick<Tx, 'tanggal' | 'jenis' | 'nominal'>[], bulanIni: string): number | null {
  const bulanTiga = [geserBulan(bulanIni, -1), geserBulan(bulanIni, -2), geserBulan(bulanIni, -3)];
  const perBulan = bulanTiga
    .map((b) =>
      txs.filter((t) => t.jenis === 'pengeluaran' && t.tanggal.slice(0, 7) === b).reduce((s, t) => s + t.nominal, 0),
    )
    .filter((n) => n > 0);
  if (perBulan.length === 0) return null;
  return perBulan.reduce((s, n) => s + n, 0) / perBulan.length;
}

export type MutasiDarurat = {
  id: string;
  tanggal: string;
  arah: 'masuk' | 'keluar';
  nominal: number;
  /** Nama dompet di seberang (transfer); null bila bukan transfer. */
  lawan: string | null;
  catatan: string | null;
};

/**
 * Mutasi satu dompet dana darurat, terbaru dulu: transfer masuk/keluar, pemasukan/pengeluaran langsung,
 * penyesuaian (nominal bertanda), hutang baru/bayar. Nominal selalu positif; arah menyatakan tandanya.
 */
export function mutasiDarurat(
  txs: (Pick<Tx, 'id' | 'tanggal' | 'jenis' | 'nominal' | 'wallet_id' | 'wallet_tujuan_id'> & { catatan?: string | null })[],
  walletId: string,
  namaDompet: Record<string, string>,
): MutasiDarurat[] {
  const hasil: MutasiDarurat[] = [];
  for (const t of txs) {
    const buat = (arah: 'masuk' | 'keluar', lawanId: string | null, nominal = t.nominal) =>
      hasil.push({
        id: t.id,
        tanggal: t.tanggal,
        arah,
        nominal,
        lawan: lawanId !== null ? (namaDompet[lawanId] ?? null) : null,
        catatan: t.catatan ?? null,
      });
    if (t.jenis === 'transfer') {
      if (t.wallet_tujuan_id === walletId) buat('masuk', t.wallet_id);
      else if (t.wallet_id === walletId) buat('keluar', t.wallet_tujuan_id);
    } else if (t.wallet_id === walletId) {
      if (t.jenis === 'pemasukan' || t.jenis === 'hutang_baru') buat('masuk', null);
      else if (t.jenis === 'pengeluaran' || t.jenis === 'hutang_bayar') buat('keluar', null);
      else if (t.jenis === 'penyesuaian') buat(t.nominal >= 0 ? 'masuk' : 'keluar', null, Math.abs(t.nominal));
    }
  }
  return hasil.sort((a, b) => (a.tanggal === b.tanggal ? b.id.localeCompare(a.id) : a.tanggal < b.tanggal ? 1 : -1));
}

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

  const rata = rataPengeluaran(txs, bulanIni);
  const cakupanBulan = rata !== null ? Math.round((total / rata) * 10) / 10 : null;
  return { dompet, total, totalTarget, persen, cakupanBulan };
}
