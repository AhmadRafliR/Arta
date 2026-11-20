import {
  bungaBulanIni,
  hariMenuju,
  labelBulan,
  labelJatuhTempo,
  pecahPembayaran,
  perkiraanBebas,
  ringkasHutang,
} from '../hutang';
import { buatHutang } from '../testFactories';

const HARI_INI = '2026-11-20';

const cicilan = (over = {}) =>
  buatHutang({
    tipe: 'cicilan_tetap',
    pokok_awal: 1_200_000,
    sisa_pokok: 800_000,
    nominal_cicilan: 100_000,
    tenor_bulan: 12,
    bunga_persen_bulanan: null,
    metode: null,
    jumlah_tagihan: 12,
    tagihan_lunas: 4,
    jatuh_tempo_berikutnya: '2026-12-05',
    nominal_berikutnya: 100_000,
    jatuh_tempo_terakhir: '2027-11-05',
    ...over,
  });

describe('bungaBulanIni', () => {
  test('sudah lunas (sisa 0) → tanpa bunga, juga untuk flat', () => {
    expect(bungaBulanIni(buatHutang({ metode: 'flat', bunga_persen_bulanan: 2 }), 0)).toBe(0);
  });

  it('flat dari pokok awal', () => {
    expect(bungaBulanIni(buatHutang({ metode: 'flat', bunga_persen_bulanan: 2 }), 300_000)).toBe(20_000);
  });
  it('efektif dari sisa sebelum bayar', () => {
    expect(bungaBulanIni(buatHutang({ metode: 'efektif', bunga_persen_bulanan: 2 }), 720_000)).toBe(14_400);
  });
  it('dibulatkan ke rupiah terdekat seperti round() Postgres', () => {
    const h = buatHutang({ metode: 'efektif', bunga_persen_bulanan: 1.5 });
    expect(bungaBulanIni(h, 333_333)).toBe(5_000); // 4.999,995
    expect(bungaBulanIni(buatHutang({ metode: 'efektif', bunga_persen_bulanan: 2.5 }), 100_020)).toBe(2_501); // 2.500,5
  });
  it('setengah tetap naik walau persen tidak tepat di biner', () => {
    expect(bungaBulanIni(buatHutang({ metode: 'efektif', bunga_persen_bulanan: 2.3 }), 1_500)).toBe(35); // 34,5
    expect(bungaBulanIni(buatHutang({ metode: 'efektif', bunga_persen_bulanan: 0.29 }), 25_000)).toBe(73); // 72,5
  });
  it('cicilan tetap tanpa bunga', () => {
    expect(bungaBulanIni(cicilan(), 800_000)).toBe(0);
  });
  it('bunga 0 persen atau sisa 0', () => {
    expect(bungaBulanIni(buatHutang({ bunga_persen_bulanan: 0 }), 500_000)).toBe(0);
    expect(bungaBulanIni(buatHutang({ metode: 'efektif' }), 0)).toBe(0);
  });
});

describe('pecahPembayaran', () => {
  const h = buatHutang({ metode: 'flat', bunga_persen_bulanan: 2, pokok_awal: 1_000_000, sisa_pokok: 600_000 });

  it('bunga dibayar lebih dulu, sisanya pokok', () => {
    expect(pecahPembayaran(h, 220_000, false)).toEqual({ bunga: 20_000, pokok: 200_000, lebih: false });
  });
  it('nominal di bawah bunga seluruhnya bunga', () => {
    expect(pecahPembayaran(h, 10_000, false)).toEqual({ bunga: 10_000, pokok: 0, lebih: false });
  });
  it('pembayaran kedua di bulan yang sama tanpa bunga', () => {
    expect(pecahPembayaran(h, 50_000, true)).toEqual({ bunga: 0, pokok: 50_000, lebih: false });
  });
  it('efektif memakai sisa pokok sekarang', () => {
    const e = buatHutang({ metode: 'efektif', bunga_persen_bulanan: 2, sisa_pokok: 720_000 });
    expect(pecahPembayaran(e, 100_000, false)).toEqual({ bunga: 14_400, pokok: 85_600, lebih: false });
  });
  it('melebihi sisa ditandai lebih', () => {
    expect(pecahPembayaran(h, 620_000, false).lebih).toBe(false);
    expect(pecahPembayaran(h, 620_001, false).lebih).toBe(true);
    expect(pecahPembayaran(h, 600_001, true).lebih).toBe(true);
  });
  it('cicilan tetap seluruhnya pokok', () => {
    expect(pecahPembayaran(cicilan(), 100_000, false)).toEqual({ bunga: 0, pokok: 100_000, lebih: false });
  });
});

describe('hariMenuju dan labelJatuhTempo', () => {
  it('label dasar', () => {
    expect(labelJatuhTempo('2026-11-20', HARI_INI)).toBe('Hari ini');
    expect(labelJatuhTempo('2026-11-21', HARI_INI)).toBe('Besok');
    expect(labelJatuhTempo('2026-11-23', HARI_INI)).toBe('3 hari lagi');
    expect(labelJatuhTempo('2026-11-18', HARI_INI)).toBe('Lewat 2 hari');
    expect(labelJatuhTempo('2026-11-19', HARI_INI)).toBe('Lewat 1 hari');
  });
  it('melewati akhir bulan dan akhir tahun', () => {
    expect(hariMenuju('2026-12-01', '2026-11-30')).toBe(1);
    expect(hariMenuju('2027-01-02', '2026-12-31')).toBe(2);
    expect(hariMenuju('2026-12-31', '2027-01-01')).toBe(-1);
    expect(labelJatuhTempo('2027-01-01', '2026-12-31')).toBe('Besok');
  });
  it('tahun kabisat', () => {
    expect(hariMenuju('2028-03-01', '2028-02-28')).toBe(2);
    expect(hariMenuju('2027-03-01', '2027-02-28')).toBe(1);
    expect(hariMenuju('2100-03-01', '2100-02-28')).toBe(1); // 2100 bukan kabisat
    expect(hariMenuju('2000-03-01', '2000-02-28')).toBe(2); // 2000 kabisat
    expect(hariMenuju('2027-11-20', '2026-11-20')).toBe(365);
    expect(hariMenuju('2028-11-20', '2027-11-20')).toBe(366);
  });
});

describe('perkiraanBebas', () => {
  it('punya tagihan belum lunas -> bulan jatuh tempo terakhir', () => {
    expect(perkiraanBebas(cicilan(), [], HARI_INI)).toBe('2027-11');
  });
  it('berbunga tanpa jadwal dari rata-rata pokok per bulan', () => {
    const h = buatHutang({ sisa_pokok: 600_000 });
    const riwayat = [
      { bulan: '2026-09', pokok: 200_000 },
      { bulan: '2026-10', pokok: 200_000 },
    ];
    expect(perkiraanBebas(h, riwayat, HARI_INI)).toBe('2027-02');
  });
  it('hanya 3 bulan terakhir yang ada pembayarannya, dibulatkan ke atas', () => {
    const h = buatHutang({ sisa_pokok: 500_000 });
    const riwayat = [
      { bulan: '2026-11', pokok: 100_000 },
      { bulan: '2026-05', pokok: 900_000 },
      { bulan: '2026-08', pokok: 200_000 },
      { bulan: '2026-10', pokok: 0 },
      { bulan: '2026-09', pokok: 150_000 },
    ];
    // rata (100.000 + 150.000 + 200.000) / 3 = 150.000 -> ceil(3,33) = 4 bulan
    expect(perkiraanBebas(h, riwayat, HARI_INI)).toBe('2027-03');
  });
  it('tanpa riwayat -> null', () => {
    expect(perkiraanBebas(buatHutang({ sisa_pokok: 600_000 }), [], HARI_INI)).toBeNull();
  });
  it('lunas -> null', () => {
    expect(perkiraanBebas(cicilan({ sisa_pokok: 0, tagihan_lunas: 12 }), [], HARI_INI)).toBeNull();
    expect(perkiraanBebas(buatHutang({ sisa_pokok: 0 }), [{ bulan: '2026-10', pokok: 1 }], HARI_INI)).toBeNull();
  });
  it('jadwal sudah lunas semua tetapi sisa ada -> pakai rata-rata', () => {
    const h = buatHutang({
      sisa_pokok: 100_000,
      jumlah_tagihan: 2,
      tagihan_lunas: 2,
      jatuh_tempo_terakhir: '2026-10-05',
    });
    expect(perkiraanBebas(h, [{ bulan: '2026-10', pokok: 100_000 }], HARI_INI)).toBe('2026-12');
  });
});

describe('ringkasHutang', () => {
  it('daftar kosong', () => {
    expect(ringkasHutang([], HARI_INI)).toEqual({
      totalSisa: 0,
      totalAwal: 0,
      progres: 0,
      berikutnya: null,
      bebasPada: null,
    });
  });
  it('hutang diarsip tidak dihitung', () => {
    const a = cicilan({ id: 'a' });
    const b = cicilan({ id: 'b', diarsip: true, sisa_pokok: 500_000, jatuh_tempo_berikutnya: '2026-11-21' });
    const r = ringkasHutang([a, b], HARI_INI);
    expect(r.totalSisa).toBe(800_000);
    expect(r.totalAwal).toBe(1_200_000);
    expect(r.progres).toBeCloseTo(1 / 3);
    expect(r.berikutnya?.hutang.id).toBe('a');
  });
  it('berikutnya memilih tanggal terdekat', () => {
    const a = cicilan({ id: 'a', jatuh_tempo_berikutnya: '2026-12-05', nominal_berikutnya: 100_000 });
    const b = cicilan({ id: 'b', jatuh_tempo_berikutnya: '2026-11-25', nominal_berikutnya: 250_000 });
    const c = buatHutang({ id: 'c' });
    expect(ringkasHutang([a, b, c], HARI_INI).berikutnya).toEqual({
      hutang: b,
      tanggal: '2026-11-25',
      nominal: 250_000,
    });
  });
  it('bebasPada = bulan terakhir dari semua perkiraan', () => {
    const a = cicilan({ id: 'a', jatuh_tempo_terakhir: '2027-11-05' });
    const b = cicilan({ id: 'b', jatuh_tempo_terakhir: '2028-02-05' });
    const lunas = buatHutang({ id: 'l', sisa_pokok: 0 });
    expect(ringkasHutang([a, b, lunas], HARI_INI).bebasPada).toBe('2028-02');
  });
  it('bebasPada null bila ada yang tak terperkirakan', () => {
    const a = cicilan({ id: 'a' });
    const b = buatHutang({ id: 'b', sisa_pokok: 300_000 });
    expect(ringkasHutang([a, b], HARI_INI).bebasPada).toBeNull();
  });
  it('riwayat pokok per hutang dipakai bila diberikan', () => {
    const a = cicilan({ id: 'a' });
    const b = buatHutang({ id: 'b', sisa_pokok: 300_000 });
    const riwayat = { b: [{ bulan: '2026-10', pokok: 100_000 }] };
    expect(ringkasHutang([a, b], HARI_INI, riwayat).bebasPada).toBe('2027-11');
    expect(ringkasHutang([b], HARI_INI, riwayat).bebasPada).toBe('2027-02');
  });
});

describe('labelBulan', () => {
  it('YYYY-MM ke nama bulan', () => {
    expect(labelBulan('2027-11')).toBe('Nov 2027');
  });
});
