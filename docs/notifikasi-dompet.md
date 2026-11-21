# Catat otomatis dari notifikasi GoPay dan ShopeePay

Rencana dan keputusan: `docs/superpowers/plans/2026-11-22-notifikasi-dompet.md`. Panduan uji: `docs/uji-manual-notifikasi-dompet.md`.

## Tujuan

- Transaksi GoPay dan ShopeePay tercatat hampir real-time, tanpa penyedia data berbayar.
- App membaca notifikasi di HP Android pengguna, mengurai nominal dan arah uang, lalu menyiapkannya sebagai **draf**.
- Pengguna tetap mengecek dan menyimpan sendiri di layar "Cek dulu". Tidak ada transaksi yang tersimpan diam-diam.

## Cara kerja ujung ke ujung

1. **Service native.** `PendengarNotifikasiDompet` (Kotlin, `NotificationListenerService`) menerima setiap notifikasi baru di HP.
   - Paket di luar daftar putih diabaikan dan tidak disimpan.
   - Bila sakelar "Catat otomatis" mati, notifikasi juga diabaikan.
   - Yang diambil: judul, teks (teks panjang bila ada), paket, waktu, dan kunci unik `${sbn.key}:${sbn.postTime}`.
2. **Antrean lokal.** Notifikasi masuk ke antrean di SharedPreferences (JSON).
   - Maksimal 300 item, yang tertua dibuang.
   - Kunci yang sama tidak dimasukkan dua kali.
   - Saat app hidup, service juga mengirim event `onNotifikasi` ke JS.
3. **Parser.** `sinkronAntrean()` membaca antrean saat layar dipasang, saat app aktif kembali, dan saat ada event baru. Setiap notifikasi diurai oleh `parseNotifikasi`.
   - Yang terbaca sebagai transaksi tetap di antrean sampai draf tersimpan.
   - Yang bukan transaksi (promo, OTP, gagal, dan sebagainya) langsung dibuang dari antrean.
4. **Draf.** `jadikanDraf` mengubah hasil parser menjadi draf.
   - Dompet dipetakan dari nama dompet pengguna: `/go\s?pay/i` untuk GoPay, `/shopee/i` untuk ShopeePay. Dompet yang diarsipkan dilewati.
   - Bila tidak ada dompet yang cocok, `wallet_id` kosong dan muncul peringatan "Pilih dompet".
   - Kategori awal `lainnya`. Catatan diisi nama merchant atau lawan transaksi bila terbaca.
   - Peringatan "Dari notifikasi GoPay" atau "Dari notifikasi ShopeePay" selalu ada.
   - Tanggal diambil dari waktu notifikasi menurut zona waktu profil.
5. **Kartu di Beranda.** Bila ada draf, tampil kartu "N transaksi dari notifikasi siap dicek". Tanpa antrean, kartu tidak tampil.
6. **Layar Cek dulu.** Menekan kartu mengisi draf store lalu membuka `/cek`. Pengguna bisa mengubah, menghapus, atau menyimpan draf.
7. **Simpan.** Setelah simpan berhasil, `beritahuSimpan()` (di `src/ai/drafStore.ts`, dipanggil `app/cek.tsx`) menjalankan pembersih satu kali: seluruh kelompok yang dicek dihapus dari antrean, termasuk draf yang dihapus pengguna di layar Cek. Lalu kartu Beranda hilang.
8. **Batal.** Menutup layar Cek tanpa simpan tidak menyentuh antrean, jadi kartu tetap ada.

Tanpa duplikat: ID draf diturunkan secara deterministik dari kunci notifikasi (`idDariKunci`, hash FNV-1a bukan kriptografis). Penyimpanan transaksi idempoten per id, jadi notifikasi yang sama tidak bisa tercatat dua kali, bahkan bila pembersihan antrean gagal.

## Privasi

- Hanya tiga paket yang dibaca: `com.gojek.app`, `com.gojek.gopay`, `com.shopee.id`. Notifikasi aplikasi lain dibuang di sisi native dan tidak disimpan.
- Teks notifikasi mentah diproses di HP. Tidak dikirim ke server.
- Daftar "Notifikasi terakhir yang terbaca" (maks 20) hanya ada di memori app dan hilang saat app ditutup.
- Yang tersimpan di server hanya transaksi yang dikonfirmasi pengguna: tanggal, jenis, kategori, nominal, dompet, catatan, dan kolom `transkrip` berisi sumbernya saja (mis. "Dari notifikasi GoPay"), bukan teks notifikasi.
- Izin "Akses notifikasi" harus diaktifkan pengguna sendiri. App hanya membuka layar pengaturannya.
- Sakelar "Catat otomatis" mati secara bawaan.

## Mengaktifkan di HP

1. Pasang build pengembangan atau rilis yang memuat modul native (lihat Batasan).
2. Buka **Akun → Catat otomatis dari notifikasi**.
3. Tekan **Buka pengaturan akses notifikasi**, lalu izinkan arta ("arta: catat otomatis") di layar sistem. Kembali ke app: status berubah menjadi "Aktif".
4. Nyalakan sakelar **Catat otomatis**.
5. HP Xiaomi/HyperOS: agar notifikasi tetap terbaca saat app ditutup:
   - Matikan penghemat baterai untuk arta (pilih "Tanpa pembatasan").
   - Aktifkan **Autostart** untuk arta.
   - Nama menu berbeda antar versi HyperOS/MIUI.

## Batasan

- **Android saja.** iOS tidak mengizinkan membaca notifikasi aplikasi lain. Di iOS dan web layar menampilkan "Fitur ini hanya tersedia di Android".
- **Butuh build dengan modul native.** Tidak jalan di Expo Go atau build lama. Di build tanpa modul, layar menampilkan "Modul belum terpasang di build ini".
- **Tidak semua transaksi memunculkan notifikasi.** Notifikasi dimatikan pengguna, ditunda sistem, atau memang tidak dikirim aplikasinya: transaksi itu tidak tercatat.
- **Format bisa berubah.** Parser memakai pola umum, bukan format resmi. Update GoPay/Shopee dapat membuat notifikasi tidak terbaca atau salah baca.
- **Contoh tes parser masih sintetis.** Tes parser memakai kalimat rekaan, bukan notifikasi asli. Akurasi di dunia nyata belum terbukti sampai ada contoh asli (lihat bagian pola parser).
- **Notifikasi aplikasi Gojek tidak wajib menyebut "GoPay".** Paket `com.gojek.app` dianggap GoPay, jadi pembayaran GoFood/GoRide yang dibayar GoPay ikut terbaca. Karena itu semuanya tetap lewat konfirmasi pengguna.
- **Pembayaran Shopee yang tidak menyebut "ShopeePay" terlewat.** Untuk paket Shopee, notifikasi harus memuat kata "ShopeePay". Notifikasi pesanan/pengiriman (dikirim, resi, kurir) juga ditolak.
- **Penolakan agresif.** Teks yang memuat kata promo, voucher, "hingga", OTP/PIN, gagal/batal/tertunda, atau pengingat pembayaran ditolak. Transaksi sah yang kebetulan memuat kata itu bisa ikut terlewat.
- **Nominal.** Hanya format `Rp` atau `IDR`. Nominal yang didahului "saldo" atau "sisa" dianggap saldo, bukan transaksi.
- **Sumber transaksi tercatat `ai`.** Constraint database hanya mengizinkan `ai`, `manual`, `import`, dan layar Cek memakai `ai`. Transaksi dari notifikasi karenanya tidak bisa dibedakan dari catatan suara lewat kolom `sumber`. Bedanya hanya di `transkrip`.
- **Antrean maksimal 300 item.** Notifikasi baru diurai saat app dibuka atau ada event; yang datang saat app mati tetap masuk antrean selama service hidup.
- **Kategori awal selalu `lainnya`.** Pengguna mengubahnya di layar Cek.

## Menyempurnakan pola parser

1. Buka **Akun → Catat otomatis dari notifikasi**, lihat bagian **Notifikasi terakhir yang terbaca**. Tiap item menampilkan paket, jam, judul, teks, dan label "Terbaca sebagai transaksi" atau "Bukan transaksi".
2. Cari notifikasi transaksi sungguhan yang berlabel "Bukan transaksi", atau yang terbaca tetapi arah/nominal/keterangannya salah.
3. Salin judul dan teksnya (nominal boleh disensor, mis. `Rp12.000` menjadi `Rp##.###`; pertahankan format penulisan).
4. Tambahkan sebagai contoh di `src/notifikasi-dompet/__tests__/` (gantikan contoh sintetis), lalu ubah pola di `src/notifikasi-dompet/parser.ts` sampai tes lulus.
   - Penolak: konstanta `TOLAK` dan `SHOPEE_BUKAN_DOMPET`.
   - Nominal: `parseNominal`.
   - Arah uang: `tentukanJenis`.
   - Keterangan: `ambilKeterangan`.
5. Jalankan tes parser, `npx tsc --noEmit`, dan `npx expo lint`.

## Catatan kebijakan Google Play

Izin akses notifikasi (`BIND_NOTIFICATION_LISTENER_SERVICE`) tergolong sensitif. Sebelum rilis:

- **Penjelasan di app.** Layar pengaturan sudah menjelaskan apa yang dibaca (hanya GoPay dan ShopeePay), bahwa teks diproses di HP, dan bahwa pengguna mengonfirmasi tiap transaksi. Pastikan penjelasan ini tampil sebelum pengguna dikirim ke pengaturan sistem, dan teksnya sesuai perilaku sebenarnya.
- **Data Safety.** Isi sesuai kode: teks notifikasi tidak dikirim ke server; yang dikirim hanya transaksi yang dikonfirmasi pengguna. Jangan menyatakan hal yang belum bisa dipastikan, misalnya soal pihak ketiga atau penyimpanan di sisi server, sebelum ditelusuri dari kode dan layanan yang dipakai.
- **Deklarasi izin sensitif.** Siapkan alasan penggunaan, dan periksa kebijakan Play terbaru untuk izin ini. Dokumen ini tidak menjamin lolos tinjauan.
- **Kebijakan privasi.** Perbarui agar menyebut fitur ini.

## Peta file

| Lapisan | File |
|---|---|
| API modul (TypeScript, fallback no-op di iOS/web/Jest) | `modules/notifikasi-dompet/index.ts` |
| Konfigurasi modul | `modules/notifikasi-dompet/expo-module.config.json` |
| Deklarasi service dan izin | `modules/notifikasi-dompet/android/src/main/AndroidManifest.xml` |
| Service, daftar putih paket | `modules/notifikasi-dompet/android/src/main/java/expo/modules/notifikasidompet/PendengarNotifikasiDompet.kt` |
| Antrean dan sakelar (SharedPreferences) | `.../notifikasidompet/AntreanNotifikasi.kt` |
| Fungsi dan event modul | `.../notifikasidompet/NotifikasiDompetModule.kt` |
| Parser | `src/notifikasi-dompet/parser.ts` |
| Draf, pemetaan dompet, ID deterministik | `src/notifikasi-dompet/draf.ts` |
| Hook, sinkron antrean, daftar terakhir | `src/notifikasi-dompet/useNotifikasiDompet.ts` |
| Layar pengaturan (modal) | `app/notifikasi-dompet.tsx` |
| Kartu Beranda | `src/components/KartuNotifDompet.tsx` |
| Pintu masuk | `app/(tabs)/akun.tsx`, `app/(tabs)/index.tsx`, `app/_layout.tsx` |
| Pembersihan setelah simpan | `src/ai/drafStore.ts` (`setDraf`, `beritahuSimpan`), `app/cek.tsx` |
| Tes | `src/notifikasi-dompet/__tests__/`, `src/__tests__/screens/notifikasi-dompet.test.tsx` |
