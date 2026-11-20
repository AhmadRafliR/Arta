import { ringkasAset, ringkasInvestasi } from '../investasi';
import { T, W } from '../testFactories';
import { walletBalances } from '../balances';

describe('ringkasAset', () => {
  const w = { ...W('s', 1000000, 'investasi'), nama: 'Saham' };
  const txs = [
    T('transfer', 500000, 'h', 's'),
    T('transfer', 200000, 's', 'h'),
    T('penyesuaian', 150000, 's'),
  ];
  it('nilai, modal, untung, persen', () => {
    const nilai = walletBalances([w, W('h', 0)], txs).s;
    expect(nilai).toBe(1450000);
    const r = ringkasAset(w, nilai, txs);
    expect(r).toMatchObject({ id: 's', nama: 'Saham', nilai: 1450000, modal: 1300000, untung: 150000, persen: 11.5 });
  });
  it('modal 0 -> persen null', () => {
    const r = ringkasAset(W('x', 0, 'investasi'), 5000, []);
    expect(r.modal).toBe(0);
    expect(r.untung).toBe(5000);
    expect(r.persen).toBeNull();
  });
  it('hutang_baru/bayar memengaruhi modal; tx dompet lain diabaikan', () => {
    const r = ringkasAset(W('x', 100, 'investasi'), 100, [
      T('hutang_baru', 50, 'x'),
      T('hutang_bayar', 20, 'x'),
      T('transfer', 999, 'y', 'z'),
    ]);
    expect(r.modal).toBe(130);
  });
  it('rugi bernilai negatif', () => {
    const r = ringkasAset(W('x', 1000, 'investasi'), 900, []);
    expect(r.untung).toBe(-100);
    expect(r.persen).toBe(-10);
  });
});

describe('ringkasInvestasi', () => {
  it('menjumlah dan mengabaikan arsip/non-investasi', () => {
    const wallets = [
      W('a', 1000, 'investasi'),
      W('b', 2000, 'investasi'),
      { ...W('c', 5000, 'investasi'), diarsip: true },
      W('h', 9000),
    ];
    const txs = [T('penyesuaian', 100, 'a'), T('penyesuaian', -200, 'b')];
    const r = ringkasInvestasi(wallets, walletBalances(wallets, txs), txs);
    expect(r.aset.map((a) => a.id)).toEqual(['a', 'b']);
    expect(r.totalNilai).toBe(2900);
    expect(r.totalModal).toBe(3000);
    expect(r.totalUntung).toBe(-100);
    expect(r.persen).toBe(-3.3);
  });
  it('kosong', () => {
    expect(ringkasInvestasi([], {}, [])).toEqual({
      aset: [],
      totalNilai: 0,
      totalModal: 0,
      totalUntung: 0,
      persen: null,
    });
  });
});
