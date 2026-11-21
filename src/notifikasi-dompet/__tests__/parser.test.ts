import { parseNominal, parseNotifikasi } from '../parser';
import type { NotifikasiMentah } from '../tipe';

// CATATAN: semua contoh notifikasi di bawah ini SINTETIS (karangan berdasarkan
// perkiraan format). Ganti/tambahkan dengan contoh notifikasi asli GoPay dan
// ShopeePay begitu tersedia.

const GP = 'com.gojek.app';
const SP = 'com.shopee.id';

function notif(paket: string, judul: string, teks: string): NotifikasiMentah {
  return { kunci: 'k1', paket, judul, teks, waktu: 1700000000000 };
}

describe('parseNominal', () => {
  it.each([
    ['Rp25.000', 25000],
    ['Rp 1.250.000', 1250000],
    ['Rp25.000,00', 25000],
    ['IDR 25.000', 25000],
    ['rp500', 500],
    ['Bayar   Rp\n12.500 sukses', 12500],
  ])('membaca %s', (teks, hasil) => {
    expect(parseNominal(teks)).toBe(hasil);
  });

  it('mengabaikan saldo dan mengambil nominal transaksi', () => {
    expect(parseNominal('Saldo kamu Rp100.000. Bayar Rp25.000')).toBe(25000);
  });
  it('null bila hanya saldo', () => {
    expect(parseNominal('Saldo kamu Rp100.000')).toBeNull();
  });
  it('null bila tanpa nominal atau nol', () => {
    expect(parseNominal('Halo dunia')).toBeNull();
    expect(parseNominal('Rp0')).toBeNull();
    expect(parseNominal('')).toBeNull();
  });
});

describe('parseNotifikasi: pengeluaran', () => {
  it('pembayaran merchant dengan "di"', () => {
    const r = parseNotifikasi(notif(GP, 'Pembayaran berhasil', 'Kamu membayar Rp25.000 di Kopi Kenangan.'));
    expect(r).toEqual({
      kunci: 'k1', sumber: 'gopay', jenis: 'pengeluaran', nominal: 25000,
      keterangan: 'Kopi Kenangan', waktu: 1700000000000,
    });
  });
  it('pembayaran merchant dengan "ke"', () => {
    const r = parseNotifikasi(notif(GP, 'GoPay', 'Pembayaran Rp 18.500 ke Warung Bu Ani berhasil'));
    expect(r?.jenis).toBe('pengeluaran');
    expect(r?.nominal).toBe(18500);
    expect(r?.keterangan).toBe('Warung Bu Ani');
  });
  it('berhasil dibayar, spasi dan baris baru berlebih', () => {
    const r = parseNotifikasi(notif(GP, 'GoPay', 'Pesanan  kamu\nberhasil dibayar   Rp 52.000,00\ndi   Indomaret'));
    expect(r?.jenis).toBe('pengeluaran');
    expect(r?.nominal).toBe(52000);
    expect(r?.keterangan).toBe('Indomaret');
  });
  it('transfer keluar', () => {
    const r = parseNotifikasi(notif(GP, 'Transfer berhasil', 'Transfer ke Budi Santoso Rp150.000 berhasil'));
    expect(r?.jenis).toBe('pengeluaran');
    expect(r?.nominal).toBe(150000);
    expect(r?.keterangan).toBe('Budi Santoso');
  });
  // Contoh ASLI dari HP (GoPay, 21/11): nominal berada di antara "transfer" dan "ke".
  it('ASLI: "Yes, sukses transfer" / "Kamu berhasil transfer Rp1 ke Zhahira."', () => {
    const r = parseNotifikasi(notif('com.gojek.gopay', 'Yes, sukses transfer', 'Kamu berhasil transfer Rp1 ke Zhahira.'));
    expect(r).toMatchObject({ sumber: 'gopay', jenis: 'pengeluaran', nominal: 1, keterangan: 'Zhahira' });
  });
  it('ASLI: kartu gosok bukan transaksi', () => {
    expect(
      parseNotifikasi(
        notif('com.gojek.gopay', 'Hai, kamu dapet kartu gosok!', 'Buka sekarang sebelum hangus dan nikmatin bermacam-macam hadiah.'),
      ),
    ).toBeNull();
  });
  it('kirim uang', () => {
    const r = parseNotifikasi(notif(GP, 'GoPay', 'Kamu berhasil kirim ke Siti IDR 75.000'));
    expect(r?.jenis).toBe('pengeluaran');
    expect(r?.nominal).toBe(75000);
    expect(r?.keterangan).toBe('Siti');
  });
  it('top up ke tujuan lain (DANA)', () => {
    const r = parseNotifikasi(notif(GP, 'GoPay', 'Top up ke DANA Rp100.000 berhasil'));
    expect(r?.jenis).toBe('pengeluaran');
    expect(r?.nominal).toBe(100000);
  });
  it('pembelian ShopeePay', () => {
    const r = parseNotifikasi(notif(SP, 'ShopeePay', 'Pembelian pulsa Rp50.000 berhasil dengan ShopeePay'));
    expect(r?.sumber).toBe('shopeepay');
    expect(r?.jenis).toBe('pengeluaran');
    expect(r?.nominal).toBe(50000);
  });
  it('pembayaran ShopeePay di merchant', () => {
    const r = parseNotifikasi(notif(SP, 'Pembayaran ShopeePay berhasil', 'Pembayaran Rp 32.000 di Alfamart berhasil.'));
    expect(r?.jenis).toBe('pengeluaran');
    expect(r?.keterangan).toBe('Alfamart');
  });
  it('saldo yang disebut setelah nominal tidak dianggap nominal', () => {
    const r = parseNotifikasi(notif(GP, 'GoPay', 'Pembayaran Rp25.000 di Gojek berhasil. Saldo kamu Rp100.000'));
    expect(r?.nominal).toBe(25000);
  });
  it('paket com.gojek.gopay dikenali', () => {
    const r = parseNotifikasi(notif('com.gojek.gopay', 'GoPay', 'Pembayaran Rp10.000 di Kantin berhasil'));
    expect(r?.sumber).toBe('gopay');
  });
  it('keterangan dipangkas maksimal 60 karakter', () => {
    const panjang = 'Toko ' + 'A'.repeat(100);
    const r = parseNotifikasi(notif(GP, 'GoPay', `Pembayaran Rp10.000 di ${panjang} berhasil`));
    expect(r?.keterangan.length).toBeLessThanOrEqual(60);
    expect(r?.keterangan.startsWith('Toko A')).toBe(true);
  });
  it('keterangan kosong bila tak terbaca', () => {
    const r = parseNotifikasi(notif(GP, 'GoPay', 'Pembayaran Rp10.000 berhasil'));
    expect(r?.keterangan).toBe('');
  });
});

describe('parseNotifikasi: pemasukan', () => {
  it('menerima transfer', () => {
    const r = parseNotifikasi(notif(GP, 'Uang masuk', 'Kamu menerima Rp200.000 dari Andi Wijaya'));
    expect(r?.jenis).toBe('pemasukan');
    expect(r?.nominal).toBe(200000);
    expect(r?.keterangan).toBe('Andi Wijaya');
  });
  it('transfer diterima', () => {
    const r = parseNotifikasi(notif(SP, 'ShopeePay', 'ShopeePay: Rp 90.000 diterima dari Rina'));
    expect(r?.jenis).toBe('pemasukan');
    expect(r?.sumber).toBe('shopeepay');
    expect(r?.keterangan).toBe('Rina');
  });
  it('dana masuk', () => {
    const r = parseNotifikasi(notif(GP, 'GoPay', 'Dana masuk Rp 35.000 dari Dewi.'));
    expect(r?.jenis).toBe('pemasukan');
    expect(r?.keterangan).toBe('Dewi');
  });
  it('top up berhasil ke saldo sendiri', () => {
    const r = parseNotifikasi(notif(GP, 'Top up berhasil', 'Top up GoPay Rp100.000 dari BCA berhasil'));
    expect(r?.jenis).toBe('pemasukan');
    expect(r?.nominal).toBe(100000);
  });
  it('top up ke saldo ShopeePay', () => {
    const r = parseNotifikasi(notif(SP, 'ShopeePay', 'Top up ke saldo ShopeePay Rp 250.000 berhasil'));
    expect(r?.jenis).toBe('pemasukan');
    expect(r?.nominal).toBe(250000);
  });
  it('refund', () => {
    const r = parseNotifikasi(notif(SP, 'ShopeePay', 'Refund pembayaran Rp45.000 dari Shopee masuk ke ShopeePay kamu'));
    expect(r?.jenis).toBe('pemasukan');
    expect(r?.nominal).toBe(45000);
  });
  it('pengembalian dana', () => {
    const r = parseNotifikasi(notif(GP, 'GoPay', 'Pengembalian dana Rp 20.000 dari Tokopedia berhasil'));
    expect(r?.jenis).toBe('pemasukan');
    expect(r?.keterangan).toBe('Tokopedia');
  });
  it('cashback masuk', () => {
    const r = parseNotifikasi(notif(GP, 'GoPay', 'Cashback Rp5.000 sudah masuk ke saldo GoPay kamu'));
    expect(r?.jenis).toBe('pemasukan');
    expect(r?.nominal).toBe(5000);
  });
});

describe('parseNotifikasi: harus null', () => {
  it.each([
    ['promo ber-Rp', GP, 'Promo', 'Diskon Rp10.000 untuk pembayaran pertama kamu hari ini!'],
    ['voucher', GP, 'Voucher', 'Pakai voucher Rp15.000 saat membayar di GoFood'],
    ['cashback s.d.', GP, 'GoPay', 'Bayar pakai GoPay, cashback s.d. Rp50.000'],
    ['cashback hingga', SP, 'ShopeePay', 'Dapat cashback hingga Rp 100.000 dengan ShopeePay'],
    ['OTP', GP, 'Kode verifikasi', 'Jangan bagikan OTP 123456 untuk transaksi Rp25.000'],
    ['PIN', GP, 'GoPay', 'Masukkan PIN untuk membayar Rp25.000'],
    ['transaksi gagal', GP, 'Pembayaran gagal', 'Pembayaran Rp25.000 di Kopi Kenangan gagal'],
    ['dibatalkan', SP, 'ShopeePay', 'Pembayaran Rp 30.000 dibatalkan'],
    ['tertunda', GP, 'GoPay', 'Transfer ke Budi Rp50.000 tertunda'],
    ['menunggu pembayaran', GP, 'GoPay', 'Menunggu pembayaran Rp75.000, selesaikan sebelum pukul 20.00'],
    ['pengingat tagihan', GP, 'Tagihan', 'Tagihan listrik Rp200.000 jatuh tempo besok, belum dibayar'],
    ['saldo saja', GP, 'GoPay', 'Saldo kamu Rp100.000'],
    ['tanpa nominal', GP, 'GoPay', 'Pembayaran berhasil, terima kasih!'],
    ['jenis tak jelas', GP, 'GoPay', 'Ada aktivitas Rp25.000 di akunmu'],
    ['paket lain', 'com.whatsapp', 'Budi', 'Transfer ke Budi Rp50.000 berhasil'],
    ['Shopee non-ShopeePay (promo)', SP, 'Flash Sale', 'Belanja sekarang, hemat Rp 50.000'],
    ['Shopee pesanan dikirim', SP, 'Pesanan dikirim', 'Pesanan ShopeePay senilai Rp120.000 sedang dikirim oleh kurir'],
    ['Shopee tanpa ShopeePay', SP, 'Shopee', 'Pembayaran Rp 120.000 berhasil'],
  ])('%s', (_nama, paket, judul, teks) => {
    expect(parseNotifikasi(notif(paket, judul, teks))).toBeNull();
  });
});
