# Uji Manual Rencana 1 (APK development Android)

## Persiapan

1. Buat file `.env` di root proyek dengan menyalin `.env.example`, lalu isi:
   - `EXPO_PUBLIC_SUPABASE_URL` - base URL proyek Supabase, misalnya `https://xxxx.supabase.co` (tanpa `/rest/v1`).
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` - anon key dari proyek Supabase.
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` - isi jika Google Sign-In ikut diuji.
2. Login ke EAS: `npx eas login`
3. Build APK development: `npx eas build -p android --profile development`
4. Unduh APK dari tautan build EAS, pasang di HP Android.
5. Jalankan server development: `npx expo start --dev-client`, lalu buka aplikasi di HP dan hubungkan ke server.

**Catatan penting:** build cloud EAS **tidak** membaca file `.env` lokal. Dua nilai `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY` (dan `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` bila dipakai) juga harus ditambahkan sebagai environment variable EAS untuk environment `development`, lewat `npx eas env:create` atau dashboard expo.dev. Tanpa ini, APK hasil build tidak tersambung ke Supabase.

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

## Catatan temuan

-
