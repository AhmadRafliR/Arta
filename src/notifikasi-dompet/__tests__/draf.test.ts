import type { Wallet } from '@/domain/types';
import { idDariKunci, jadikanDraf, transkripSumber } from '../draf';
import type { HasilNotif } from '../parser';

const W = (id: string, nama: string, diarsip = false): Wallet => ({
  id,
  nama,
  tipe: 'harian',
  saldo_awal: 0,
  tanggal_saldo_awal: '2026-01-01',
  target: null,
  diarsip,
});

const H = (patch: Partial<HasilNotif> = {}): HasilNotif => ({
  kunci: 'k1:1000',
  sumber: 'gopay',
  jenis: 'pengeluaran',
  nominal: 25000,
  keterangan: 'Kopi Kenangan',
  waktu: Date.UTC(2026, 10, 20, 10, 0, 0),
  ...patch,
});

describe('idDariKunci', () => {
  it('format UUID v4 dan deterministik', () => {
    const a = idDariKunci('0|com.gojek.app|1:1700000000000');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(idDariKunci('0|com.gojek.app|1:1700000000000')).toBe(a);
  });

  it('kunci berbeda menghasilkan id berbeda', () => {
    const ids = new Set(Array.from({ length: 500 }, (_, i) => idDariKunci(`kunci-${i}`)));
    expect(ids.size).toBe(500);
    expect(idDariKunci('a')).not.toBe(idDariKunci('b'));
  });
});

describe('jadikanDraf', () => {
  const dompet = [W('w-cash', 'Cash'), W('w-gp', 'GoPay'), W('w-sp', 'ShopeePay')];

  it('memetakan sumber ke dompet berdasarkan nama', () => {
    const [a, b] = jadikanDraf([H(), H({ kunci: 'k2', sumber: 'shopeepay' })], dompet, 'Asia/Jakarta');
    expect(a.wallet_id).toBe('w-gp');
    expect(b.wallet_id).toBe('w-sp');
    expect(a.peringatan).toEqual(['Dari notifikasi GoPay']);
    expect(b.peringatan).toEqual(['Dari notifikasi ShopeePay']);
  });

  it('nama "Go Pay" juga cocok; dompet diarsip diabaikan', () => {
    const [a] = jadikanDraf([H()], [W('lama', 'GoPay', true), W('baru', 'Go Pay')], 'Asia/Jakarta');
    expect(a.wallet_id).toBe('baru');
  });

  it('tanpa dompet cocok: wallet_id null dan peringatan Pilih dompet', () => {
    const [a] = jadikanDraf([H()], [W('w-cash', 'Cash'), W('lama', 'GoPay', true)], 'Asia/Jakarta');
    expect(a.wallet_id).toBeNull();
    expect(a.peringatan).toEqual(['Pilih dompet', 'Dari notifikasi GoPay']);
  });

  it('isi draf: id dari kunci, kategori lainnya, catatan dari keterangan, jenis dan nominal', () => {
    const [a, b] = jadikanDraf([H(), H({ kunci: 'k2', jenis: 'pemasukan', keterangan: '', nominal: 50000 })], dompet);
    expect(a).toMatchObject({
      id: idDariKunci('k1:1000'),
      jenis: 'pengeluaran',
      kategori: 'lainnya',
      nominal: 25000,
      catatan: 'Kopi Kenangan',
      wallet_tujuan_id: null,
    });
    expect(b).toMatchObject({ jenis: 'pemasukan', kategori: 'lainnya', nominal: 50000, catatan: null });
  });

  it('tanggal mengikuti zona pengguna', () => {
    // 20 Nov 2026 18:30 UTC = 21 Nov 01:30 WIB.
    const waktu = Date.UTC(2026, 10, 20, 18, 30, 0);
    expect(jadikanDraf([H({ waktu })], dompet, 'Asia/Jakarta')[0].tanggal).toBe('2026-11-21');
    expect(jadikanDraf([H({ waktu })], dompet, 'UTC')[0].tanggal).toBe('2026-11-20');
    expect(jadikanDraf([H({ waktu })], dompet, 'America/Los_Angeles')[0].tanggal).toBe('2026-11-20');
  });
});

describe('transkripSumber', () => {
  it('menyebut sumber unik', () => {
    expect(transkripSumber([H()])).toBe('Dari notifikasi GoPay');
    expect(transkripSumber([H({ sumber: 'shopeepay' })])).toBe('Dari notifikasi ShopeePay');
    expect(transkripSumber([H(), H({ sumber: 'shopeepay' }), H()])).toBe('Dari notifikasi GoPay dan ShopeePay');
  });
});
