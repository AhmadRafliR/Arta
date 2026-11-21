# Iklan (Google AdMob)

Pendapatan dari iklan untuk pengguna **gratis**. Pengguna **Pro tidak pernah melihat iklan**.

Paket: `react-native-google-mobile-ads` (Expo tidak punya modul AdMob resmi; paket ini pihak ketiga dengan config plugin). Butuh **development build / EAS build baru**, tidak jalan di Expo Go.

## Yang sudah disiapkan di kode
- Config plugin di `app.json`, dengan **App ID uji Google**. `app.config.ts` menggantinya bila env `ADMOB_ANDROID_APP_ID` / `ADMOB_IOS_APP_ID` diisi.
- `src/iklan/`: pemilihan ID unit (`config.ts`), consent UMP + inisialisasi (`mulai.native.ts`).
- `src/components/BannerIklan.native.tsx`: banner adaptif. Tampil hanya bila sudah masuk, status Pro sudah pasti **bukan Pro**, consent mengizinkan, dan ID unit tersedia. Gagal memuat → tidak ada ruang kosong.
- Dipasang di akhir layar **Beranda** dan **Riwayat**. Layar isian (catat, cek, rekam, hutang, langganan) sengaja bebas iklan.
- Konten umum (rating maks PG), bukan aplikasi anak.
- Saat pengembangan (`__DEV__`) selalu iklan uji Google. Iklan sungguhan hanya bila `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` / `_IOS` diisi di build non-dev.

## Langkah yang harus kamu lakukan
1. Buat akun di https://admob.google.com, daftarkan app **Android** (paket `id.arta.keuangan`). Catat **App ID** (`ca-app-pub-…~…`).
2. Buat satu **unit iklan Banner**. Catat **ID unit** (`ca-app-pub-…/…`).
3. Isi variabel lingkungan EAS untuk profil `production` (bukan rahasia, tapi spesifik akun):
   ```powershell
   npx eas-cli@latest env:create --name ADMOB_ANDROID_APP_ID --value "ca-app-pub-XXXX~YYYY" --environment production --visibility plain
   npx eas-cli@latest env:create --name EXPO_PUBLIC_ADMOB_BANNER_ANDROID --value "ca-app-pub-XXXX/ZZZZ" --environment production --visibility plain
   ```
4. Bangun ulang APK dev (App ID uji sudah di config): `npx eas-cli@latest build --profile development --platform android`.
5. Di AdMob, atur **Privacy & messaging → European regulations / US states** dan buat pesan consent (UMP). Tanpa pesan consent, di wilayah yang mensyaratkannya iklan tidak akan diminta.
6. Perbarui **kebijakan privasi** (menyebut Google AdMob, ID iklan, dan data perangkat) dan isi **Data safety** di Play Console (Advertising ID: ya, untuk iklan).
7. Kontrol Play Console: deklarasi "Aplikasi berisi iklan".

## Aturan penting
- **Jangan mengklik iklan sungguhan milik sendiri** dan jangan memakai ID produksi saat pengembangan: akun AdMob bisa ditangguhkan.
- Perangkat uji sendiri bisa didaftarkan di AdMob (Settings → Test devices) bila perlu melihat iklan sungguhan.

## Uji manual di HP
1. Pasang APK dev baru, `npx expo start --dev-client`, masuk dengan akun **non-Pro**.
2. Beranda dan Riwayat: di paling bawah muncul banner berlabel "Test Ad" (iklan uji).
3. Akun Pro: tidak ada banner sama sekali.
4. Mode pesawat: tidak ada ruang kosong di tempat banner.

## Belum dikerjakan
- Tombol "Pengaturan privasi iklan" di Akun (`bukaPengaturanPrivasiIklan()` sudah ada, belum dipasang). Wajib di wilayah yang mensyaratkan consent bila nanti app dirilis ke sana.
- Iklan interstisial / reward: sengaja tidak dipakai agar tidak mengganggu pencatatan.

## Iklan reward: ekspor data dan laporan email untuk pengguna gratis

Pengguna gratis bisa memakai **Ekspor data** (Excel/CSV) dan **Laporan email** (kirim manual) setelah menonton **satu iklan reward sampai selesai**. Akses terbuka **30 menit** per fitur. Pengguna Pro tidak pernah melihat gerbang ini. Pengiriman laporan **otomatis tiap tanggal 1 tetap khusus Pro**.

Cara kerja:
- `src/components/GerbangIklan.tsx` membungkus isi layar Ekspor dan Laporan. Hadiah dicatat hanya bila SDK melaporkan `EARNED_REWARD` sebelum iklan ditutup (`src/iklan/reward.native.ts`). Ditutup lebih awal = tidak ada akses.
- Akses disimpan di tabel `akses_iklan` (migrasi `20261121000050_akses_iklan.sql`) lewat RPC `klaim_akses_iklan` (jeda minimal 20 detik antarklaim).
- Edge Function `report-send` menerima Pro **atau** akses `laporan` yang masih berlaku. Batas kirim 3 kali per 24 jam dan hanya ke penerima terverifikasi tetap berlaku.
- Iklan tidak tersedia (tidak ada ID unit produksi, tidak ada consent, tidak ada isi iklan): fitur tetap terkunci dan pengguna diarahkan mencoba lagi atau berlangganan Pro.

Yang perlu kamu siapkan di AdMob: satu unit iklan **Rewarded** (selain unit Banner), lalu env EAS:
```powershell
npx eas-cli@latest env:create --name EXPO_PUBLIC_ADMOB_REWARD_ANDROID --value "ca-app-pub-XXXX/WWWW" --environment production --visibility plain
```
Saat pengembangan otomatis memakai iklan reward uji Google.

Batasan versi ini: klaim akses datang dari aplikasi (belum diverifikasi server lewat AdMob SSV). Pengguna yang memanggil RPC langsung bisa melewati iklan; dampaknya hanya hilangnya pendapatan iklan, bukan keamanan data. Penguatan berikutnya: Edge Function SSV yang memverifikasi tanda tangan Google sebelum menulis `akses_iklan`.

Uji manual: akun non-Pro → Akun → Ekspor data → "Tonton iklan untuk membuka" → iklan uji tampil → setelah selesai form ekspor terbuka dengan keterangan "Akses terbuka sampai …". Tutup iklan lebih awal → tetap terkunci. Ulangi untuk Rencana keuangan → Laporan email.
