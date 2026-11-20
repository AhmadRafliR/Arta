import { ringkasDarurat } from '../danaDarurat';
import { W } from '../testFactories';
import type { Jenis } from '../types';

const peng = (nominal: number, tanggal: string, jenis: Jenis = 'pengeluaran') => ({ jenis, nominal, tanggal });

describe('ringkasDarurat', () => {
  const wallets = [
    { ...W('d1', 0, 'darurat'), nama: 'Darurat 1', target: 3000000 },
    { ...W('d2', 0, 'darurat'), nama: 'Darurat 2' },
    { ...W('d3', 0, 'darurat'), diarsip: true },
    W('h1', 0),
  ];
  const balances = { d1: 1200000, d2: 300000, d3: 999, h1: 5000000 };

  it('total, target, persen, cakupan', () => {
    const txs = [
      peng(1000000, '2026-08-10'),
      peng(2000000, '2026-09-10'),
      peng(5000000, '2026-11-02'),
      peng(7, '2026-10-01', 'pemasukan'),
    ];
    const r = ringkasDarurat(wallets, balances, txs, '2026-11');
    expect(r.dompet.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(r.dompet[0].persen).toBe(40);
    expect(r.dompet[1].persen).toBeNull();
    expect(r.total).toBe(1500000);
    expect(r.totalTarget).toBe(3000000);
    expect(r.persen).toBe(50);
    expect(r.cakupanBulan).toBe(1);
  });
  it('tanpa pengeluaran -> cakupan null; tanpa target -> null', () => {
    const r = ringkasDarurat([W('d2', 0, 'darurat')], { d2: 300000 }, [], '2026-11');
    expect(r.cakupanBulan).toBeNull();
    expect(r.totalTarget).toBeNull();
    expect(r.persen).toBeNull();
    expect(r.total).toBe(300000);
  });
  it('cakupan satu desimal', () => {
    const r = ringkasDarurat([W('d', 0, 'darurat')], { d: 2500000 }, [peng(1000000, '2026-10-05')], '2026-11');
    expect(r.cakupanBulan).toBe(2.5);
  });
  it('lintas tahun memakai geserBulan', () => {
    const r = ringkasDarurat([W('d', 0, 'darurat')], { d: 100 }, [peng(100, '2025-12-05')], '2026-01');
    expect(r.cakupanBulan).toBe(1);
  });
});
