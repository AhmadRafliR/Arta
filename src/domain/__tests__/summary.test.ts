import { monthSummary } from '../summary';
import { T } from '../testFactories';

describe('monthSummary', () => {
  it('batas bulan memakai tanggal lokal (string)', () => {
    const t = [T('pengeluaran', 2000, 'cash', null, '2026-11-30')];
    expect(monthSummary(t, '2026-11').keluar).toBe(2000);
    expect(monthSummary(t, '2026-12').keluar).toBe(0);
  });
  it('hanya pemasukan & pengeluaran', () => {
    const txs = [
      T('pengeluaran', 25000, 'gopay'),
      T('pemasukan', 1500000, 'cash'),
      T('transfer', 50000, 'cash', 'spay'),
      T('penyesuaian', -1000, 'gopay'),
    ];
    expect(monthSummary(txs, '2026-11')).toEqual({ masuk: 1500000, keluar: 25000, selisih: 1475000 });
  });
});
