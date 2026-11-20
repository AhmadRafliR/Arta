import { statusBerikut } from '../pulau';

describe('statusBerikut (histeresis pulau)', () => {
  it('masuk pulau hanya bila y > 24', () => {
    expect(statusBerikut('penuh', 25)).toBe('pulau');
    expect(statusBerikut('penuh', 24)).toBe('penuh');
  });

  it('kembali penuh hanya bila y <= 8', () => {
    expect(statusBerikut('pulau', 9)).toBe('pulau');
    expect(statusBerikut('pulau', 8)).toBe('penuh');
  });

  it('pantulan gulir (y negatif) kembali penuh', () => {
    expect(statusBerikut('pulau', -40)).toBe('penuh');
  });

  it('y NaN atau tak hingga: status tidak berubah', () => {
    expect(statusBerikut('penuh', NaN)).toBe('penuh');
    expect(statusBerikut('pulau', NaN)).toBe('pulau');
    expect(statusBerikut('penuh', Infinity)).toBe('penuh');
    expect(statusBerikut('pulau', -Infinity)).toBe('pulau');
  });
});
