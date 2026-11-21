import type { Tx } from './types';

export type IrisanPengeluaran = {
  kunci: string;
  nama: string;
  nominal: number;
  persen: number;
  /** true untuk irisan "Lainnya" (kategori kosong + sisa di luar 5 terbesar). */
  lainnya: boolean;
};

export type DataDiagramPengeluaran = { total: number; irisan: IrisanPengeluaran[] };

export const MAKS_IRISAN_BERNAMA = 5;
const KUNCI_LAINNYA = 'lainnya';

function kapital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Persen bulat yang jumlahnya tepat 100 (largest remainder). */
export function persenBulat(nominal: number[]): number[] {
  const total = nominal.reduce((a, b) => a + b, 0);
  if (total <= 0) return nominal.map(() => 0);
  const mentah = nominal.map((n) => (n / total) * 100);
  const hasil = mentah.map(Math.floor);
  let sisa = 100 - hasil.reduce((a, b) => a + b, 0);
  const urut = mentah
    .map((m, i) => ({ i, frak: m - Math.floor(m) }))
    .sort((a, b) => b.frak - a.frak || a.i - b.i);
  for (let k = 0; sisa > 0 && k < urut.length; k++, sisa--) hasil[urut[k].i] += 1;
  return hasil;
}

/**
 * Pengeluaran bulan `bulan` ('YYYY-MM') per kategori, nominal turun. Definisi pengeluaran sama dengan
 * `monthSummary`. Maksimal 5 irisan bernama; kategori kosong dan sisanya menjadi "Lainnya" (terakhir).
 */
export function diagramPengeluaran(txs: Tx[], bulan: string): DataDiagramPengeluaran {
  const kelompok = new Map<string, { nama: string; nominal: number }>();
  let lainnya = 0;
  let total = 0;
  for (const t of txs) {
    if (!t.tanggal.startsWith(`${bulan}-`) || t.jenis !== 'pengeluaran') continue;
    total += t.nominal;
    const asli = (t.kategori ?? '').trim();
    const kunci = asli.toLowerCase();
    if (kunci === '' || kunci === KUNCI_LAINNYA) {
      lainnya += t.nominal;
      continue;
    }
    const ada = kelompok.get(kunci);
    if (ada) ada.nominal += t.nominal;
    else kelompok.set(kunci, { nama: kapital(asli), nominal: t.nominal });
  }
  if (total <= 0) return { total: 0, irisan: [] };

  const urut = [...kelompok.entries()]
    .map(([kunci, v]) => ({ kunci, ...v }))
    .sort((a, b) => b.nominal - a.nominal || a.nama.localeCompare(b.nama));
  const bernama = urut.slice(0, MAKS_IRISAN_BERNAMA);
  for (const sisa of urut.slice(MAKS_IRISAN_BERNAMA)) lainnya += sisa.nominal;

  const daftar: Omit<IrisanPengeluaran, 'persen'>[] = bernama.map((b) => ({ ...b, lainnya: false }));
  if (lainnya > 0) daftar.push({ kunci: KUNCI_LAINNYA, nama: 'Lainnya', nominal: lainnya, lainnya: true });
  const persen = persenBulat(daftar.map((d) => d.nominal));
  return { total, irisan: daftar.map((d, i) => ({ ...d, persen: persen[i] })) };
}
