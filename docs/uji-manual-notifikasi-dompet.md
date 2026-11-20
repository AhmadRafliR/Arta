# Uji Manual: catat otomatis dari notifikasi GoPay dan ShopeePay

Dokumentasi fitur: `docs/notifikasi-dompet.md`. Rencana: `docs/superpowers/plans/2026-11-22-notifikasi-dompet.md`.

**Butuh APK development baru**, karena fitur ini menambah modul native. Expo Go dan APK lama tidak bisa.

## Prasyarat

1. HP Android dengan aplikasi Gojek (GoPay) dan Shopee terpasang dan sudah login.
2. Pasang APK development baru yang memuat modul `notifikasi-dompet` (hasil build EAS profil development).
3. Di komputer, dari root proyek:

   ```powershell
   npx expo start --dev-client
   ```

4. Buka APK di HP, sambungkan ke dev server, login.
5. Punya dompet bernama mengandung "GoPay" dan dompet bernama mengandung "Shopee" (mis. "ShopeePay") di arta. Satu uji di bawah sengaja dilakukan tanpa dompet yang cocok.
6. Siapkan transaksi kecil: bayar atau terima uang kecil (mis. Rp1.000 sampai Rp10.000) di GoPay dan di ShopeePay.

## Daftar uji

Centang `- [x]` jika lulus. Kalau gagal, catat temuannya di bawah item itu.

### Layar pengaturan dan izin
- [ ] Akun → "Catat otomatis dari notifikasi" membuka layar pengaturan. Teks penjelasan dan privasi tampil.
- [ ] Status "Akses notifikasi" menunjukkan **Belum aktif**. Sakelar "Catat otomatis" mati.
- [ ] Tekan "Buka pengaturan akses notifikasi" → layar akses notifikasi sistem terbuka.
- [ ] Izinkan arta di layar sistem, kembali ke app → status berubah **Aktif** tanpa membuka ulang layar.
- [ ] Nyalakan sakelar "Catat otomatis". Tutup lalu buka lagi layarnya → sakelar tetap menyala.

### Notifikasi masuk
- [ ] Bayar kecil di GoPay. Di layar pengaturan, "Notifikasi terakhir yang terbaca" memuat notifikasinya dengan label "Terbaca sebagai transaksi". Beranda menampilkan kartu "N transaksi dari notifikasi siap dicek".
- [ ] Terima uang kecil di GoPay (atau top up). Muncul di daftar.
- [ ] Lakukan hal yang sama di ShopeePay (bayar, lalu terima atau top up).
- [ ] Notifikasi promo, voucher, atau OTP dari Gojek/Shopee (bila ada) muncul di daftar dengan label "Bukan transaksi" dan tidak menambah jumlah di kartu Beranda.
- [ ] Notifikasi aplikasi lain (WhatsApp, dan sebagainya) tidak muncul di daftar.

### Cek dan simpan
- [ ] Tekan kartu Beranda → layar "Cek dulu" berisi draf dengan nominal, jenis (pemasukan/pengeluaran), dan tanggal sesuai notifikasi. Draf GoPay memakai dompet GoPay, draf ShopeePay memakai dompet ShopeePay. Peringatan "Dari notifikasi ..." tampil.
- [ ] Tanpa dompet bernama GoPay/Shopee (ganti nama atau arsipkan dulu): draf menampilkan peringatan "Pilih dompet" dan harus memilih dompet sebelum menyimpan.
- [ ] Simpan → transaksi muncul di Riwayat dengan nominal dan dompet yang benar. Saldo dompet berubah sesuai.
- [ ] Setelah simpan, kartu Beranda hilang. Tutup dan buka ulang app → kartu tetap tidak muncul.
- [ ] Tidak tercatat dua kali: setiap transaksi hanya satu di Riwayat, juga setelah app dibuka ulang.
- [ ] Buat satu notifikasi baru, tekan kartu, lalu **tutup layar Cek tanpa menyimpan** (batal) → kartu tetap ada dengan jumlah sama.
- [ ] Hapus satu draf di layar Cek lalu simpan sisanya → kartu hilang seluruhnya (draf yang dihapus ikut dianggap selesai).

### Mematikan
- [ ] Matikan sakelar "Catat otomatis" → lakukan transaksi kecil baru → tidak muncul di daftar maupun kartu Beranda.
- [ ] Nyalakan lagi sakelar. Transaksi berikutnya masuk lagi.
- [ ] Matikan izin akses notifikasi di pengaturan sistem, kembali ke app → status kembali **Belum aktif**.

### HP Xiaomi/HyperOS
- [ ] Atur penghemat baterai "Tanpa pembatasan" dan Autostart untuk arta (lihat `docs/notifikasi-dompet.md`).
- [ ] Tutup arta dari daftar aplikasi terbuka (geser keluar). Lakukan transaksi kecil di GoPay atau ShopeePay.
- [ ] Buka arta → notifikasi tadi sudah masuk dan kartu Beranda muncul.
- [ ] Opsional: ulangi tanpa mengatur penghemat baterai dan catat apakah notifikasi hilang. Ini menunjukkan apakah tips di app memang perlu.

## Mengumpulkan contoh notifikasi asli

Contoh tes parser masih sintetis. Tolong bantu menggantinya dengan contoh asli:

1. Buka layar pengaturan, bagian "Notifikasi terakhir yang terbaca".
2. Untuk tiap jenis transaksi yang kamu lakukan, salin **judul** dan **teks** persis seperti di daftar. Jangan diketik ulang atau dirapikan.
3. Nominal boleh disensor, tetapi pertahankan formatnya: `Rp12.000` menjadi `Rp##.###`. Nama orang atau nomor HP boleh disensor.
4. Catat untuk tiap contoh: paket (mis. `com.gojek.app`), jenis transaksi sebenarnya (bayar merchant, transfer keluar, terima uang, top up, refund, dan sebagainya), dan label yang ditampilkan arta ("Terbaca sebagai transaksi" atau "Bukan transaksi").
5. Prioritaskan yang salah: transaksi sungguhan berlabel "Bukan transaksi", arah uang terbalik, atau nominal/keterangan keliru. Sertakan juga beberapa yang benar.
6. Daftar hanya ada di memori dan hilang saat app ditutup, jadi salin sebelum menutup app.

Format yang disarankan:

```text
Paket: com.gojek.app
Jenis sebenarnya: bayar merchant
Judul: <salinan judul>
Teks: <salinan teks, nominal disensor>
Label arta: Bukan transaksi
```

Contoh yang terkumpul dipakai untuk memperbarui tes dan pola di `src/notifikasi-dompet/` (langkah di bagian "Menyempurnakan pola parser" pada `docs/notifikasi-dompet.md`).
