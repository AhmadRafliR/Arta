import { formatRupiah } from './money';
import type { Tx } from './types';

export type Budget = { id: string; kategori: string; batas_bulanan: number };
export type StatusBudget = 'aman' | 'waspada' | 'lewat';

export type PemakaianBudget = {
  id: string;
  kategori: string;
  batas: number;
  terpakai: number;
  sisa: number; // batas - terpakai, bisa negatif
  persen: number; // bilangan bulat dibulatkan ke bawah
  status: StatusBudget;
};

type TxBudget = Pick<Tx, 'tanggal' | 'jenis' | 'kategori' | 'nominal'>;

/**
 * Sentinel `kategori` untuk budget "Seluruh kategori": satu batas bulanan untuk TOTAL semua
 * pengeluaran. Disimpan sebagai baris `budgets` biasa (indeks unik per pengguna menjamin hanya
 * satu). Kasus kategori pengguna yang kebetulan bernama sama dengan sentinel diabaikan.
 */
export const KATEGORI_SEMUA = '__semua__';
export const LABEL_KATEGORI_SEMUA = 'Seluruh kategori';

const kunci = (k: string | null) => (k ?? '').trim().toLowerCase();

export const adalahBudgetSemua = (kategori: string | null) => kunci(kategori) === KATEGORI_SEMUA;

/** Label tampil: sentinel tidak pernah ditampilkan mentah. */
export const labelKategoriBudget = (kategori: string) =>
  adalahBudgetSemua(kategori) ? LABEL_KATEGORI_SEMUA : kategori;

/** aman < 80%, waspada 80%..100% (termasuk tepat 100%), lewat bila terpakai > batas. */
export function statusBudget(terpakai: number, batas: number): StatusBudget {
  if (terpakai > batas) return 'lewat';
  if (terpakai * 100 >= batas * 80) return 'waspada';
  return 'aman';
}

const persenDari = (terpakai: number, batas: number) =>
  batas > 0 ? Math.floor((terpakai * 100) / batas) : 0;

function terpakaiPerKategoriBulan(txs: TxBudget[], bulan: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txs) {
    if (t.jenis !== 'pengeluaran' || t.tanggal.slice(0, 7) !== bulan) continue;
    const k = kunci(t.kategori);
    m.set(k, (m.get(k) ?? 0) + t.nominal);
  }
  return m;
}

export function pemakaianBudget(budgets: Budget[], txs: TxBudget[], bulan: string): PemakaianBudget[] {
  const terpakaiMap = terpakaiPerKategoriBulan(txs, bulan);
  const hasil = budgets.map((b): PemakaianBudget => {
    const terpakai = adalahBudgetSemua(b.kategori)
      ? [...terpakaiMap.values()].reduce((a, v) => a + v, 0)
      : (terpakaiMap.get(kunci(b.kategori)) ?? 0);
    return {
      id: b.id,
      kategori: b.kategori,
      batas: b.batas_bulanan,
      terpakai,
      sisa: b.batas_bulanan - terpakai,
      persen: persenDari(terpakai, b.batas_bulanan),
      status: statusBudget(terpakai, b.batas_bulanan),
    };
  });
  return hasil.sort((a, b) => b.persen - a.persen || labelKategoriBudget(a.kategori).localeCompare(labelKategoriBudget(b.kategori)));
}

export function kategoriKritis(p: PemakaianBudget[]): PemakaianBudget | null {
  let top: PemakaianBudget | null = null;
  for (const x of p) if (top === null || x.persen > top.persen) top = x;
  return top;
}

export type ItemRencana = { kategori: string | null; nominal: number; tanggal: string };

export type PeringatanBudget = {
  kategori: string;
  status: 'waspada' | 'lewat';
  persen: number;
  terpakai: number;
  batas: number;
  pesan: string;
};

export function peringatanBudget(
  budgets: Budget[],
  txs: Pick<Tx, 'id' | 'tanggal' | 'jenis' | 'kategori' | 'nominal'>[],
  items: ItemRencana[],
  abaikanTxId?: string,
): PeringatanBudget[] {
  const txAktif = abaikanTxId === undefined ? txs : txs.filter((t) => t.id !== abaikanTxId);
  const hasil: PeringatanBudget[] = [];
  for (const b of budgets) {
    const k = kunci(b.kategori);
    const semua = adalahBudgetSemua(b.kategori);
    const label = labelKategoriBudget(b.kategori);
    const perBulan = new Map<string, number>();
    for (const it of items) {
      if (!semua && kunci(it.kategori) !== k) continue;
      const bln = it.tanggal.slice(0, 7);
      perBulan.set(bln, (perBulan.get(bln) ?? 0) + it.nominal);
    }
    for (const [bln, tambahan] of [...perBulan].sort(([a], [c]) => a.localeCompare(c))) {
      const peta = terpakaiPerKategoriBulan(txAktif, bln);
      const lama = semua ? [...peta.values()].reduce((a, v) => a + v, 0) : (peta.get(k) ?? 0);
      const terpakai = lama + tambahan;
      const status = statusBudget(terpakai, b.batas_bulanan);
      if (status === 'aman') continue;
      const persen = persenDari(terpakai, b.batas_bulanan);
      const pesan =
        status === 'lewat'
          ? `Lewat budget ${label} ${formatRupiah(terpakai - b.batas_bulanan)}`
          : `Budget ${label} jadi ${persen}% (${formatRupiah(terpakai)} dari ${formatRupiah(b.batas_bulanan)})`;
      hasil.push({ kategori: label, status, persen, terpakai, batas: b.batas_bulanan, pesan });
    }
  }
  return hasil;
}
