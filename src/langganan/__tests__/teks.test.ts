import { tanggalSingkat, teksStatusLangganan } from '../teks';

const dasar = { pro: true, berlakuSampai: null, periode: null, produk: null, akanDiperpanjang: true } as const;

it('tanggalSingkat memakai tanggal Jakarta', () => {
  expect(tanggalSingkat('2026-12-03T18:00:00Z')).toBe('4 Des 2026');
});

it('teksStatusLangganan', () => {
  expect(teksStatusLangganan(undefined)).toBe('Free: catat AI 30× per bulan');
  expect(teksStatusLangganan({ ...dasar, pro: false })).toBe('Free: catat AI 30× per bulan');
  expect(teksStatusLangganan({ ...dasar, periode: 'trial', berlakuSampai: '2026-12-04T00:00:00Z' })).toBe(
    'Uji coba Pro sampai 4 Des 2026',
  );
  expect(teksStatusLangganan({ ...dasar, akanDiperpanjang: false, berlakuSampai: '2026-12-04T00:00:00Z' })).toBe(
    'Pro aktif sampai 4 Des 2026',
  );
  expect(teksStatusLangganan({ ...dasar })).toBe('Pro aktif');
});
