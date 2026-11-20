# Uji Manual Rencana 1 (APK development Android)

## Persiapan Supabase (sekali, di dashboard)

Aplikasi hanya menerima **kode 6 digit** lewat email, bukan tautan. Template email bawaan Supabase hanya berisi `{{ .ConfirmationURL }}`, jadi tanpa langkah ini email masuk tidak memuat kode.

1. Authentication → Email Templates: edit template **Confirm signup** dan **Magic Link**, tambahkan baris `Kode masuk: {{ .Token }}` (boleh tetap menyertakan tautan).
2. Authentication → Providers → Email: pastikan **Email OTP Length = 6**.
3. SMTP bawaan Supabase dibatasi laju (sangat sedikit email per jam). Untuk uji tertutup dengan beberapa orang, pasang SMTP khusus (mis. Resend) di Project Settings → Authentication → SMTP Settings. Saat batas tercapai, aplikasi menampilkan "Terlalu sering mencoba, tunggu sebentar."
4. Template email hanya bisa diedit setelah SMTP khusus dipasang (dashboard Supabase kini mewajibkannya). Paling cepat untuk uji: SMTP Gmail (`smtp.gmail.com`, port 587, username = alamat Gmail, password = Google App Password yang dibuat di bawah Verifikasi 2 Langkah, nama pengirim `arta`). Sebelum rilis, pakai Resend dengan domain sendiri.
5. Contoh template kode 6 digit, untuk **Magic Link** dan **Confirm signup**:

   ```html
   <h2>Kode masuk arta</h2><p>Masukkan kode ini di aplikasi:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   ```

## Persiapan aplikasi

**APK development harus dibangun ulang** (langkah 4 di bawah) karena ada modul native baru: `react-native-svg`, font Nunito Sans yang ditanam, dan tab bar berbasis Reanimated. APK lama tidak akan jalan dengan kode ini.

1. Buat file `.env` di root proyek dengan menyalin `.env.example`, lalu isi:
   - `EXPO_PUBLIC_SUPABASE_URL` - base URL proyek Supabase, misalnya `https://xxxx.supabase.co` (tanpa `/rest/v1`).
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` - anon key dari proyek Supabase.
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` - isi jika Google Sign-In ikut diuji.
2. Login ke EAS: `npx eas login`
3. Hubungkan proyek ke EAS (sekali, build pertama): `npx eas init`
4. Build APK development: `npx eas build -p android --profile development`
5. Unduh APK dari tautan build EAS, pasang di HP Android.
6. Jalankan server development di laptop: `npx expo start --dev-client`, lalu buka aplikasi di HP dan hubungkan ke server. **HP dan laptop harus berada di jaringan Wi-Fi yang sama** (atau pakai `npx expo start --dev-client --tunnel`).

**Catatan:** pada alur dev-client, Metro (di laptop) yang menyajikan JavaScript dan membaca `.env` lokal, jadi APK development tetap tersambung ke Supabase tanpa environment variable EAS. Environment variable EAS hanya diperlukan untuk build mandiri (standalone: profil `preview` / `production`); tambahkan lewat `npx eas env:create --environment preview` (atau `development` / `production`) atau dashboard expo.dev. Build rilis tanpa nilai ini akan berhenti dengan galat "Konfigurasi Supabase belum diisi".

## Daftar uji

Centang `- [x]` jika lulus, catat temuan di bawah item bila gagal.

- [ ] Masuk dengan email OTP
- [ ] Onboarding dengan GoPay 152.000, Cash 106.000, ShopeePay 30.000 → Beranda menampilkan "Rp288.000"
- [ ] Catat "rokok 25rb GoPay" → Beranda menampilkan Rp263.000, chip GoPay 127rb
- [ ] Transfer Cash → ShopeePay 10.000 → total tetap
- [ ] Mode pesawat → Simpan → muncul pesan offline; nyalakan lagi → Simpan → hanya 1 transaksi tersimpan
- [ ] Riwayat: ubah nominal, lalu hapus transaksi
- [ ] Sesuaikan saldo GoPay
- [ ] Ganti tema Terang / Gelap / Sistem
- [ ] Keluar lalu masuk lagi → data tetap ada
- [ ] Cek visual mode terang dan gelap di semua layar (Beranda, Riwayat, Hutang, Akun, Catat)
- [ ] Tab bar menjadi kapsul melayang saat gulir ke bawah, dan kembali penuh saat di posisi atas

## Catatan temuan

-
