import { kekayaanBersih, sisaUang, walletBalances } from '../balances';
import { T, W } from '../testFactories';

const w = [W('gopay', 152000), W('cash', 106000), W('spay', 30000)];
const txs = [
  T('pengeluaran', 25000, 'gopay'),
  T('pemasukan', 1500000, 'cash'),
  T('transfer', 50000, 'cash', 'spay'),
  T('penyesuaian', -1000, 'gopay'),
];

describe('walletBalances', () => {
  it('tanpa transaksi = saldo awal', () => {
    expect(walletBalances(w, [])).toEqual({ gopay: 152000, cash: 106000, spay: 30000 });
  });
  it('efek tiap jenis', () => {
    expect(walletBalances(w, txs)).toEqual({ gopay: 126000, cash: 1556000, spay: 80000 });
  });
  it('hutang_baru menambah, hutang_bayar mengurangi', () => {
    const b = walletBalances(w, [T('hutang_baru', 100000, 'cash'), T('hutang_bayar', 30000, 'cash')]);
    expect(b.cash).toBe(176000);
  });
  it('mengabaikan transaksi untuk dompet tak dikenal', () => {
    expect(walletBalances(w, [T('pemasukan', 5, 'hantu')])).toEqual({
      gopay: 152000,
      cash: 106000,
      spay: 30000,
    });
  });
});

describe('sisaUang & kekayaanBersih', () => {
  it('data Rafli', () => {
    expect(sisaUang(w, walletBalances(w, []))).toBe(288000);
  });
  it('dompet darurat tidak masuk sisa uang tapi masuk kekayaan bersih', () => {
    const w2 = [...w, W('darurat', 100000, 'darurat')];
    const b2 = walletBalances(w2, []);
    expect(sisaUang(w2, b2)).toBe(288000);
    expect(kekayaanBersih(b2, 1365283)).toBe(388000 - 1365283);
  });
  it('dompet harian yang diarsip tetap dihitung', () => {
    const w3 = [{ ...W('lama', 10000), diarsip: true }, ...w];
    expect(sisaUang(w3, walletBalances(w3, []))).toBe(298000);
  });
  it('totalHutang default 0', () => {
    expect(kekayaanBersih({ a: 5, b: 7 })).toBe(12);
  });
});
