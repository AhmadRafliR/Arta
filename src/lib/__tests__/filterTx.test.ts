import { T } from '@/domain/testFactories';
import { filterTx, kelompokHarian } from '../filterTx';
import { geserBulan, labelBulan } from '../tanggal';

const kat = (t: ReturnType<typeof T>, k: string) => ({ ...t, kategori: k });

describe('filterTx', () => {
  const txs = [
    kat(T('pengeluaran', 25000, 'cash'), 'Makan'),
    kat(T('pemasukan', 1000000, 'spay'), 'Gaji'),
    T('transfer', 50000, 'cash', 'spay'),
    T('pengeluaran', 9000, 'bank'),
  ];

  it('tanpa filter mengembalikan semua', () => {
    expect(filterTx(txs, {})).toHaveLength(4);
  });
  it('transfer cash->spay muncul untuk filter dompet spay (asal atau tujuan)', () => {
    const r = filterTx(txs, { walletId: 'spay' });
    expect(r.map((t) => t.jenis)).toEqual(['pemasukan', 'transfer']);
  });
  it('jenis dan kategori digabung (AND)', () => {
    expect(filterTx(txs, { jenis: 'pengeluaran' })).toHaveLength(2);
    expect(filterTx(txs, { jenis: 'pengeluaran', kategori: 'Makan' })).toHaveLength(1);
    expect(filterTx(txs, { kategori: 'Gaji', walletId: 'cash' })).toHaveLength(0);
  });
});

describe('kelompokHarian', () => {
  it('urut tanggal terbaru dulu; total = masuk - keluar, transfer tidak dihitung', () => {
    const g = kelompokHarian([
      T('pengeluaran', 25000, 'cash', null, '2026-11-18'),
      T('pemasukan', 100000, 'cash', null, '2026-11-19'),
      T('pengeluaran', 30000, 'cash', null, '2026-11-19'),
      T('transfer', 999, 'cash', 'spay', '2026-11-19'),
    ]);
    expect(g.map((x) => x.tanggal)).toEqual(['2026-11-19', '2026-11-18']);
    expect(g[0].total).toBe(70000);
    expect(g[0].items).toHaveLength(3);
    expect(g[1].total).toBe(-25000);
  });
});

describe('bulan', () => {
  it('geserBulan melewati batas tahun', () => {
    expect(geserBulan('2026-01', -1)).toBe('2025-12');
    expect(geserBulan('2026-12', 1)).toBe('2027-01');
    expect(geserBulan('2026-11', 0)).toBe('2026-11');
  });
  it('labelBulan memakai nama singkat Indonesia', () => {
    expect(labelBulan('2026-11')).toBe('Nov 2026');
    expect(labelBulan('2026-05')).toBe('Mei 2026');
    expect(labelBulan('2026-08')).toBe('Agu 2026');
  });
});
