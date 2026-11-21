import { pilihUnitId } from '../config';

const UJI = 'ca-app-pub-3940256099942544/9214589741';

describe('pilihUnitId', () => {
  it('saat pengembangan selalu iklan uji, abaikan ID produksi', () => {
    expect(pilihUnitId({ dev: true, uji: UJI, produksi: 'ca-app-pub-111/222' })).toBe(UJI);
  });
  it('produksi memakai ID dari env bila valid', () => {
    expect(pilihUnitId({ dev: false, uji: UJI, produksi: ' ca-app-pub-111/222 ' })).toBe('ca-app-pub-111/222');
  });
  it('produksi tanpa ID atau ID tidak valid: tidak ada iklan', () => {
    expect(pilihUnitId({ dev: false, uji: UJI, produksi: undefined })).toBeNull();
    expect(pilihUnitId({ dev: false, uji: UJI, produksi: '' })).toBeNull();
    expect(pilihUnitId({ dev: false, uji: UJI, produksi: 'ca-app-pub-111~222' })).toBeNull();
    expect(pilihUnitId({ dev: false, uji: UJI, produksi: 'bukan-id' })).toBeNull();
  });
});
