import { sapaan } from '../greeting';

describe('sapaan', () => {
  it('pagi, siang, sore, malam', () => {
    expect(sapaan(10)).toBe('Selamat pagi');
    expect(sapaan(14)).toBe('Selamat siang');
    expect(sapaan(17)).toBe('Selamat sore');
    expect(sapaan(21)).toBe('Selamat malam');
  });
  it('batas jam', () => {
    expect(sapaan(0)).toBe('Selamat pagi');
    expect(sapaan(11)).toBe('Selamat siang');
    expect(sapaan(15)).toBe('Selamat sore');
    expect(sapaan(18)).toBe('Selamat malam');
  });
});
