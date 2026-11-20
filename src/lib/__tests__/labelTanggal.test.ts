import { labelTanggalRelatif } from '../labelTanggal';

describe('labelTanggalRelatif', () => {
  it('hari ini, kemarin, dan tanggal biasa', () => {
    expect(labelTanggalRelatif('2026-11-20', '2026-11-20')).toBe('Hari ini');
    expect(labelTanggalRelatif('2026-11-19', '2026-11-20')).toBe('Kemarin');
    expect(labelTanggalRelatif('2026-10-31', '2026-11-01')).toBe('Kemarin');
    expect(labelTanggalRelatif('2026-11-03', '2026-11-20')).toBe('3 Nov');
  });
});
