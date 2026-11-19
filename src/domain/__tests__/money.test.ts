import { formatRingkas, formatRupiah, parseNominal } from '../money';

describe('formatRupiah', () => {
  it('memakai titik ribuan', () => {
    expect(formatRupiah(288000)).toBe('Rp288.000');
    expect(formatRupiah(1365283)).toBe('Rp1.365.283');
    expect(formatRupiah(0)).toBe('Rp0');
  });
  it('negatif didahulukan tanda minus', () => {
    expect(formatRupiah(-49000)).toBe('-Rp49.000');
  });
});

describe('formatRingkas', () => {
  it('ribu dan juta', () => {
    expect(formatRingkas(152000)).toBe('152rb');
    expect(formatRingkas(1500000)).toBe('1,5jt');
    expect(formatRingkas(2000000)).toBe('2jt');
    expect(formatRingkas(-25000)).toBe('-25rb');
    expect(formatRingkas(500)).toBe('500');
  });
});

describe('parseNominal', () => {
  it.each([
    ['25rb', 25000],
    ['1,5jt', 1500000],
    ['153.267', 153267],
    ['Rp 30.000', 30000],
    ['2.000.000', 2000000],
    ['2rb', 2000],
    ['2 ribu', 2000],
    ['5k', 5000],
    ['1,5 juta', 1500000],
  ])('%s -> %d', (s, n) => {
    expect(parseNominal(s)).toBe(n);
  });
  it.each(['abc', '0', '-5', '', '1,2345rb'])('%p -> null', (s) => {
    expect(parseNominal(s)).toBeNull();
  });
});

describe('parseNominal batas', () => {
  it('di atas MAX_SAFE_INTEGER -> null', () => {
    expect(parseNominal('9007199254740993')).toBeNull();
    expect(parseNominal('99999999999999999999')).toBeNull();
    expect(parseNominal('9' + '9'.repeat(400))).toBeNull();
  });
  it('tepat MAX_SAFE_INTEGER valid', () => {
    expect(parseNominal('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
  });
});
