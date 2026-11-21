import {
  KATEGORI_SEMUA,
  kategoriKritis,
  labelKategoriBudget,
  pemakaianBudget,
  peringatanBudget,
  statusBudget,
  type Budget,
} from '../budget';
import type { Jenis } from '../types';

const tx = (id: string, jenis: Jenis, kategori: string | null, nominal: number, tanggal: string) => ({
  id,
  jenis,
  kategori,
  nominal,
  tanggal,
});

describe('statusBudget', () => {
  it('tepi ambang', () => {
    expect(statusBudget(799, 1000)).toBe('aman');
    expect(statusBudget(800, 1000)).toBe('waspada');
    expect(statusBudget(1000, 1000)).toBe('waspada');
    expect(statusBudget(1001, 1000)).toBe('lewat');
    expect(statusBudget(0, 1000)).toBe('aman');
  });
  it('79,9% aman, 80% waspada', () => {
    expect(statusBudget(7990, 10000)).toBe('aman');
    expect(statusBudget(8000, 10000)).toBe('waspada');
  });
});

const budgets: Budget[] = [
  { id: 'b1', kategori: 'makan', batas_bulanan: 800000 },
  { id: 'b2', kategori: 'Rokok', batas_bulanan: 300000 },
];
const txs = [
  tx('1', 'pengeluaran', 'Makan', 320000, '2026-11-03'),
  tx('2', 'pengeluaran', 'rokok', 390000, '2026-11-05'),
  tx('3', 'pengeluaran', 'makan', 50000, '2026-10-30'),
  tx('4', 'pemasukan', 'makan', 1000000, '2026-11-06'),
  tx('5', 'transfer', 'makan', 40000, '2026-11-07'),
];

describe('pemakaianBudget', () => {
  it('menghitung per kategori, urut persen menurun', () => {
    const p = pemakaianBudget(budgets, txs, '2026-11');
    expect(p.map((x) => x.kategori)).toEqual(['Rokok', 'makan']);
    expect(p[1]).toMatchObject({ terpakai: 320000, persen: 40, status: 'aman', sisa: 480000 });
    expect(p[0]).toMatchObject({ terpakai: 390000, persen: 130, status: 'lewat', sisa: -90000 });
  });
  it('budget tanpa pengeluaran terpakai 0', () => {
    const p = pemakaianBudget([{ id: 'x', kategori: 'kuliah', batas_bulanan: 500000 }], txs, '2026-11');
    expect(p[0]).toMatchObject({ terpakai: 0, persen: 0, status: 'aman', sisa: 500000 });
  });
  it('persen dibulatkan ke bawah', () => {
    const p = pemakaianBudget(
      [{ id: 'x', kategori: 'a', batas_bulanan: 10000 }],
      [tx('1', 'pengeluaran', 'a', 7999, '2026-11-01')],
      '2026-11',
    );
    expect(p[0].persen).toBe(79);
    expect(p[0].status).toBe('aman');
  });
  it('urutan sama persen: nama kategori', () => {
    const p = pemakaianBudget(
      [
        { id: 'b', kategori: 'b', batas_bulanan: 100 },
        { id: 'a', kategori: 'a', batas_bulanan: 100 },
      ],
      [],
      '2026-11',
    );
    expect(p.map((x) => x.kategori)).toEqual(['a', 'b']);
  });
});

describe('kategoriKritis', () => {
  it('persen tertinggi, null bila kosong', () => {
    expect(kategoriKritis(pemakaianBudget(budgets, txs, '2026-11'))?.kategori).toBe('Rokok');
    expect(kategoriKritis([])).toBeNull();
  });
});

describe('peringatanBudget', () => {
  const bt: Budget[] = [{ id: 't', kategori: 'transport', batas_bulanan: 300000 }];
  const dasar = [tx('t1', 'pengeluaran', 'Transport ', 264000, '2026-11-02')];

  it('waspada', () => {
    const r = peringatanBudget(bt, dasar, [{ kategori: 'transport', nominal: 10000, tanggal: '2026-11-19' }]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ status: 'waspada', persen: 91 });
    expect(r[0].pesan).toBe('Budget transport jadi 91% (Rp274.000 dari Rp300.000)');
  });
  it('lewat', () => {
    const r = peringatanBudget(bt, dasar, [{ kategori: 'transport', nominal: 50000, tanggal: '2026-11-19' }]);
    expect(r[0].status).toBe('lewat');
    expect(r[0].pesan).toBe('Lewat budget transport Rp14.000');
  });
  it('kategori tanpa budget atau aman -> kosong', () => {
    expect(peringatanBudget(bt, dasar, [{ kategori: 'hobi', nominal: 9999999, tanggal: '2026-11-19' }])).toEqual([]);
    expect(peringatanBudget(bt, [], [{ kategori: 'transport', nominal: 1000, tanggal: '2026-11-19' }])).toEqual([]);
    expect(peringatanBudget(bt, dasar, [{ kategori: null, nominal: 99999999, tanggal: '2026-11-19' }])).toEqual([]);
  });
  it('dua item bersama-sama lewat -> satu peringatan', () => {
    const mk: Budget[] = [{ id: 'm', kategori: 'makan', batas_bulanan: 100000 }];
    const r = peringatanBudget(mk, [], [
      { kategori: 'makan', nominal: 60000, tanggal: '2026-11-10' },
      { kategori: 'Makan', nominal: 50000, tanggal: '2026-11-11' },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].pesan).toBe('Lewat budget makan Rp10.000');
  });
  it('abaikanTxId mengecualikan tx lama', () => {
    const r = peringatanBudget(bt, dasar, [{ kategori: 'transport', nominal: 50000, tanggal: '2026-11-19' }], 't1');
    expect(r).toEqual([]);
  });
  it('item bulan lain tidak dijumlah dengan tx bulan ini', () => {
    const r = peringatanBudget(bt, dasar, [{ kategori: 'transport', nominal: 50000, tanggal: '2026-12-01' }]);
    expect(r).toEqual([]);
  });
});

describe('budget Seluruh kategori', () => {
  const semua: Budget = { id: 's', kategori: KATEGORI_SEMUA, batas_bulanan: 1000000 };

  it('label tidak pernah menampilkan sentinel', () => {
    expect(labelKategoriBudget(KATEGORI_SEMUA)).toBe('Seluruh kategori');
    expect(labelKategoriBudget('makan')).toBe('makan');
  });
  it('terpakai = total semua pengeluaran bulan itu (bukan pemasukan/transfer/bulan lain)', () => {
    const p = pemakaianBudget([semua], txs, '2026-11');
    expect(p[0]).toMatchObject({ terpakai: 710000, persen: 71, status: 'aman', sisa: 290000 });
  });
  it('status waspada dan lewat', () => {
    expect(pemakaianBudget([{ ...semua, batas_bulanan: 800000 }], txs, '2026-11')[0].status).toBe('waspada');
    expect(pemakaianBudget([{ ...semua, batas_bulanan: 700000 }], txs, '2026-11')[0].status).toBe('lewat');
  });
  it('ikut perhitungan kategori kritis dengan label Seluruh kategori', () => {
    const p = pemakaianBudget([{ ...semua, batas_bulanan: 500000 }, ...budgets], txs, '2026-11');
    expect(kategoriKritis(p)?.id).toBe('s');
  });
  it('peringatan: pengeluaran apa pun menambah pemakaian, nominal lama tidak dihitung dua kali', () => {
    const dasar = [tx('a', 'pengeluaran', 'makan', 900000, '2026-11-02')];
    const r = peringatanBudget([semua], dasar, [{ kategori: 'hobi', nominal: 150000, tanggal: '2026-11-19' }]);
    expect(r).toHaveLength(1);
    expect(r[0].kategori).toBe('Seluruh kategori');
    expect(r[0].pesan).toBe('Lewat budget Seluruh kategori Rp50.000');
    expect(peringatanBudget([semua], dasar, [{ kategori: null, nominal: 150000, tanggal: '2026-11-19' }])).toHaveLength(1);
    expect(peringatanBudget([semua], dasar, [{ kategori: 'hobi', nominal: 150000, tanggal: '2026-11-19' }], 'a')).toEqual([]);
  });
});
