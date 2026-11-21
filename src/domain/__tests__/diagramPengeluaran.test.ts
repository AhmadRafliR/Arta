import { diagramPengeluaran, persenBulat } from '../diagramPengeluaran';
import { T } from '../testFactories';
import type { Tx } from '../types';

let n = 0;
const tx = (jenis: Parameters<typeof T>[0], nominal: number, kategori: string | null, tgl = '2026-11-10'): Tx => ({
  ...T(jenis, nominal, 'w1', null, tgl),
  id: `tx-${n++}`,
  kategori,
});

describe('diagramPengeluaran', () => {
  it('kosong tanpa pengeluaran', () => {
    expect(diagramPengeluaran([], '2026-11')).toEqual({ total: 0, irisan: [] });
    expect(diagramPengeluaran([tx('pemasukan', 5000, 'Gaji')], '2026-11').irisan).toEqual([]);
  });

  it('hanya pengeluaran bulan itu', () => {
    const r = diagramPengeluaran(
      [tx('pengeluaran', 1000, 'Makan'), tx('pemasukan', 9000, 'Gaji'), tx('transfer', 500, null), tx('pengeluaran', 700, 'Makan', '2026-10-30')],
      '2026-11',
    );
    expect(r.total).toBe(1000);
    expect(r.irisan).toHaveLength(1);
    expect(r.irisan[0]).toMatchObject({ nama: 'Makan', nominal: 1000, persen: 100 });
  });

  it('mengelompokkan case-insensitive, huruf awal kapital, urut turun', () => {
    const r = diagramPengeluaran(
      [tx('pengeluaran', 100, 'makan'), tx('pengeluaran', 200, 'MAKAN'), tx('pengeluaran', 500, ' transport '), tx('pengeluaran', 50, 'Hiburan')],
      '2026-11',
    );
    expect(r.irisan.map((s) => [s.nama, s.nominal])).toEqual([
      ['Transport', 500],
      ['Makan', 300],
      ['Hiburan', 50],
    ]);
  });

  it('kategori kosong menjadi Lainnya (terakhir)', () => {
    const r = diagramPengeluaran([tx('pengeluaran', 900, null), tx('pengeluaran', 100, 'Makan'), tx('pengeluaran', 50, '  ')], '2026-11');
    expect(r.irisan.map((s) => s.nama)).toEqual(['Makan', 'Lainnya']);
    expect(r.irisan[1]).toMatchObject({ nominal: 950, lainnya: true });
  });

  it('lebih dari 5 kategori: 5 bernama + Lainnya', () => {
    const kat = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const r = diagramPengeluaran(kat.map((k, i) => tx('pengeluaran', 700 - i * 100, k)), '2026-11');
    expect(r.irisan.map((s) => s.nama)).toEqual(['A', 'B', 'C', 'D', 'E', 'Lainnya']);
    expect(r.irisan[5].nominal).toBe(300);
    expect(r.irisan.filter((s) => s.lainnya)).toHaveLength(1);
  });

  it('persen bulat total 100', () => {
    const r = diagramPengeluaran([tx('pengeluaran', 1, 'A'), tx('pengeluaran', 1, 'B'), tx('pengeluaran', 1, 'C')], '2026-11');
    expect(r.irisan.reduce((a, s) => a + s.persen, 0)).toBe(100);
    expect(persenBulat([1, 1, 1])).toEqual([34, 33, 33]);
    expect(persenBulat([0, 0])).toEqual([0, 0]);
  });
});
