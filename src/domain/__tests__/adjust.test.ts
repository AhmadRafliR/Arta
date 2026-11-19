import { adjustmentFor, canArchive } from '../adjust';

describe('adjustmentFor', () => {
  it('selisih bertanda (saldo baru - saldo sekarang)', () => {
    expect(adjustmentFor(152000, 150000)).toBe(-2000);
    expect(adjustmentFor(100, 350)).toBe(250);
  });
  it('null jika sama', () => {
    expect(adjustmentFor(100, 100)).toBeNull();
  });
});

describe('canArchive', () => {
  it('hanya saat saldo 0', () => {
    expect(canArchive(0)).toBe(true);
    expect(canArchive(5000)).toBe(false);
    expect(canArchive(-1)).toBe(false);
  });
});
