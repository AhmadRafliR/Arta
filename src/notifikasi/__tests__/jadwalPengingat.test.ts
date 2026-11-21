import { labelWaktu, susunJadwalPengingat, waktuDiZona, type TagihanPengingat } from '../jadwalPengingat';

const t = (id: string, jatuhTempo: string, nominal = 1_200_000, pemberi = 'Koperasi'): TagihanPengingat => ({
  id,
  debtId: `d-${id}`,
  pemberi,
  jatuhTempo,
  nominal,
});

// 2026-11-20 00:00 WIB
const SEKARANG = new Date('2026-11-19T17:00:00Z');

describe('waktuDiZona', () => {
  it('Asia/Jakarta (UTC+7)', () => {
    expect(waktuDiZona('2026-11-25', 8, 'Asia/Jakarta').toISOString()).toBe('2026-11-25T01:00:00.000Z');
  });
  it('Asia/Makassar (UTC+8) dan Asia/Jayapura (UTC+9)', () => {
    expect(waktuDiZona('2026-11-25', 8, 'Asia/Makassar').toISOString()).toBe('2026-11-25T00:00:00.000Z');
    expect(waktuDiZona('2026-11-25', 8, 'Asia/Jayapura').toISOString()).toBe('2026-11-24T23:00:00.000Z');
  });
  it('zona dengan DST (America/New_York musim dingin UTC-5)', () => {
    expect(waktuDiZona('2026-12-01', 8, 'America/New_York').toISOString()).toBe('2026-12-01T13:00:00.000Z');
  });
});

describe('susunJadwalPengingat', () => {
  const dasar = { hariSebelum: 0 as const, jam: 8, zona: 'Asia/Jakarta', sekarang: SEKARANG };

  it('hari H: satu notifikasi pukul jam di zona', () => {
    const r = susunJadwalPengingat({ ...dasar, tagihan: [t('a', '2026-11-25')] });
    expect(r).toHaveLength(1);
    expect(r[0].waktu.toISOString()).toBe('2026-11-25T01:00:00.000Z');
    expect(r[0].judul).toBe('Tagihan Koperasi hari ini');
    expect(r[0].isi).toBe('Rp1.200.000 jatuh tempo Rabu, 25 Nov.');
  });

  it('zona berbeda menggeser instan', () => {
    const r = susunJadwalPengingat({ ...dasar, zona: 'Asia/Jayapura', tagihan: [t('a', '2026-11-25')] });
    expect(r[0].waktu.toISOString()).toBe('2026-11-24T23:00:00.000Z');
  });

  it('zona null atau tidak valid memakai Asia/Jakarta', () => {
    const a = susunJadwalPengingat({ ...dasar, zona: null, tagihan: [t('a', '2026-11-25')] });
    const b = susunJadwalPengingat({ ...dasar, zona: 'Bukan/Zona', tagihan: [t('a', '2026-11-25')] });
    expect(a[0].waktu.toISOString()).toBe('2026-11-25T01:00:00.000Z');
    expect(b[0].waktu.toISOString()).toBe('2026-11-25T01:00:00.000Z');
  });

  it('H-1: pengingat besok dan hari H', () => {
    const r = susunJadwalPengingat({ ...dasar, hariSebelum: 1, tagihan: [t('a', '2026-11-25')] });
    expect(r.map((x) => x.waktu.toISOString())).toEqual(['2026-11-24T01:00:00.000Z', '2026-11-25T01:00:00.000Z']);
    expect(r[0].judul).toBe('Tagihan Koperasi besok');
    expect(r[1].judul).toBe('Tagihan Koperasi hari ini');
  });

  it('H-3: judul "3 hari lagi", lintas bulan', () => {
    const r = susunJadwalPengingat({ ...dasar, hariSebelum: 3, tagihan: [t('a', '2026-12-01')] });
    expect(r[0].waktu.toISOString()).toBe('2026-11-28T01:00:00.000Z');
    expect(r[0].judul).toBe('Tagihan Koperasi 3 hari lagi');
    expect(r).toHaveLength(2);
  });

  it('melewati waktu yang sudah lewat', () => {
    const sekarang = new Date('2026-11-24T02:00:00Z'); // sudah lewat 08.00 WIB tanggal 24
    const r = susunJadwalPengingat({ ...dasar, hariSebelum: 1, sekarang, tagihan: [t('a', '2026-11-25')] });
    expect(r).toHaveLength(1);
    expect(r[0].judul).toBe('Tagihan Koperasi hari ini');
    expect(susunJadwalPengingat({ ...dasar, sekarang, tagihan: [t('a', '2026-11-24')] })).toEqual([]);
  });

  it('menggabungkan tagihan pada waktu kirim sama', () => {
    const r = susunJadwalPengingat({
      ...dasar,
      tagihan: [t('a', '2026-11-25', 1_000_000, 'Bank A'), t('b', '2026-11-25', 500_000, 'Bank B')],
    });
    expect(r).toHaveLength(1);
    expect(r[0].judul).toBe('2 tagihan jatuh tempo');
    expect(r[0].isi).toBe('Total Rp1.500.000. Terdekat: Bank A hari ini.');
  });

  it('H-1: hari H tagihan A bertabrakan dengan H-1 tagihan B -> digabung', () => {
    const r = susunJadwalPengingat({
      ...dasar,
      hariSebelum: 1,
      tagihan: [t('a', '2026-11-25', 100_000, 'A'), t('b', '2026-11-26', 200_000, 'B')],
    });
    expect(r).toHaveLength(3);
    const tengah = r[1];
    expect(tengah.waktu.toISOString()).toBe('2026-11-25T01:00:00.000Z');
    expect(tengah.judul).toBe('2 tagihan jatuh tempo');
    expect(tengah.isi).toBe('Total Rp300.000. Terdekat: A hari ini.');
  });

  it('urut waktu, id deterministik, dan batas maks', () => {
    const tagihan = [t('c', '2026-12-03'), t('a', '2026-11-25'), t('b', '2026-11-30')];
    const r = susunJadwalPengingat({ ...dasar, tagihan });
    expect(r.map((x) => x.id)).toEqual([
      'pengingat-hutang:2026-11-25T08',
      'pengingat-hutang:2026-11-30T08',
      'pengingat-hutang:2026-12-03T08',
    ]);
    expect(susunJadwalPengingat({ ...dasar, tagihan: [...tagihan].reverse() })).toEqual(r);
    expect(susunJadwalPengingat({ ...dasar, tagihan, maks: 2 }).map((x) => x.id)).toEqual([r[0].id, r[1].id]);
  });

  it('maks bawaan 40', () => {
    const tagihan = Array.from({ length: 60 }, (_, i) => t(`x${i}`, `2027-01-${String((i % 28) + 1).padStart(2, '0')}`));
    const banyak = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10);
      return t(`y${i}`, d);
    });
    expect(susunJadwalPengingat({ ...dasar, tagihan: banyak })).toHaveLength(40);
    expect(susunJadwalPengingat({ ...dasar, tagihan }).length).toBeLessThanOrEqual(28);
  });

  it('format rupiah dan daftar kosong', () => {
    const r = susunJadwalPengingat({ ...dasar, tagihan: [t('a', '2026-11-25', 85_000)] });
    expect(r[0].isi).toContain('Rp85.000');
    expect(susunJadwalPengingat({ ...dasar, tagihan: [] })).toEqual([]);
  });
});

describe('labelWaktu', () => {
  it('memformat di zona', () => {
    expect(labelWaktu(new Date('2026-11-25T01:00:00Z'), 'Asia/Jakarta')).toBe('Rabu, 25 Nov 08.00');
  });
});
