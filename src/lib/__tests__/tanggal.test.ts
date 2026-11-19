import { hariIni, jamDi, tanggalValid } from '../tanggal';

describe('hariIni', () => {
  const now = new Date('2026-11-19T20:00:00Z');
  it('mengikuti zona waktu', () => {
    expect(hariIni('Asia/Jakarta', now)).toBe('2026-11-20');
    expect(hariIni('America/Los_Angeles', now)).toBe('2026-11-19');
  });
  it('zona tidak dikenal -> tetap YYYY-MM-DD (tanggal lokal)', () => {
    expect(hariIni('Bukan/Zona', now)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('jamDi', () => {
  it('jam di zona waktu', () => {
    expect(jamDi('Asia/Jakarta', new Date('2026-11-19T20:00:00Z'))).toBe(3);
    expect(jamDi('Asia/Jakarta', new Date('2026-11-19T17:00:00Z'))).toBe(0);
  });
});

describe('tanggalValid', () => {
  it('menerima tanggal nyata', () => {
    expect(tanggalValid('2026-11-19')).toBe(true);
    expect(tanggalValid('2028-02-29')).toBe(true);
  });
  it('menolak yang bukan', () => {
    expect(tanggalValid('2026-02-30')).toBe(false);
    expect(tanggalValid('2026-13-01')).toBe(false);
    expect(tanggalValid('19-11-2026')).toBe(false);
    expect(tanggalValid('')).toBe(false);
  });
});
