import { satuanPeriode, tanggalSingkat, teksKetentuan, teksStatusLangganan } from '../teks';

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

describe('teksKetentuan (kebijakan langganan Google Play)', () => {
  const bulanan = { id: 'b', jenis: 'bulanan' as const, harga: 'Rp19.000', hargaPerBulan: null, ujiCobaHari: 14 };

  it('uji coba: lama gratis, harga sesudahnya, tagihan otomatis, dan cara agar tidak ditagih', () => {
    expect(teksKetentuan(bulanan)).toBe(
      'Gratis 14 hari, lalu Rp19.000 per bulan. Tagihan pertama otomatis saat uji coba berakhir, lalu diperpanjang ' +
        'otomatis tiap bulan sampai kamu membatalkannya. Batalkan sebelum uji coba berakhir agar tidak ditagih.',
    );
  });

  it('tanpa uji coba: harga per periode dan perpanjangan otomatis', () => {
    expect(teksKetentuan({ ...bulanan, id: 't', jenis: 'tahunan', harga: 'Rp190.000', ujiCobaHari: null })).toBe(
      'Rp190.000 per tahun, ditagih lewat Google Play saat kamu mengonfirmasi, lalu diperpanjang otomatis tiap tahun ' +
        'sampai kamu membatalkannya.',
    );
  });

  it('satuanPeriode', () => {
    expect(satuanPeriode('bulanan')).toBe('bulan');
    expect(satuanPeriode('tahunan')).toBe('tahun');
    expect(satuanPeriode('lain')).toBe('periode');
  });
});
