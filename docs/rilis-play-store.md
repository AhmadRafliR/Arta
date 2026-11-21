# Checklist rilis Play Store: arta

Dokumen kerja untuk Rafli. Centang saat selesai. Perintah dijalankan satu per baris dari akar repo (PowerShell). Jangan commit `google-services.json`, kunci service account, atau secret apa pun.

Status 21 Nov 2026: **kode dan konfigurasi siap**. Rilis masih menunggu langkah akun di bagian B (Play Console, RevenueCat, AdMob, Supabase produksi, halaman web, dan environment variable EAS). Di EAS saat ini **belum ada satu pun environment variable**. Build production otomatis berhenti di awal dengan daftar kekurangannya, sehingga tidak ada AAB rusak yang terunggah.

## A. Sudah disiapkan di repo

- [x] `app.config.ts`, varian lewat `APP_VARIANT`:
  - `production`: nama `arta`, paket `id.arta.keuangan`. Varian lain: `arta dev`, `com.keuanganapp.dev`.
  - Build rilis (`preview`, `production`) memblokir izin `SYSTEM_ALERT_WINDOW` (overlay, hanya untuk layar galat saat pengembangan).
  - `google-services.json` dipasang dari env file EAS `GOOGLE_SERVICES_JSON`, atau dari berkas lokal bila ada.
  - **Penjaga rilis**: di mesin EAS Build profil `production`, build dihentikan bila env wajib kosong, URL masih `example.com`, kunci RevenueCat bukan `goog_`, atau ID AdMob tidak cocok satu akun. Pesannya menyebut variabel mana yang kurang.
- [x] `app.json`: `allowBackup: false`. Sesi login dan data lokal app keuangan tidak ikut dicadangkan ke Google Drive.
- [x] `app.json`: izin mikrofon (`RECORD_AUDIO`) kembali ada. Sebelumnya `expo-image-picker` dengan `microphonePermission: false` menghapusnya dari manifest, sehingga catat suara tidak bisa meminta izin mikrofon di build mana pun.
- [x] `eas.json`:
  - `environment` eksplisit per profil (`development`, `preview`, `production`).
  - `production`: AAB, `autoIncrement` (versionCode dikelola remote).
  - `submit.production.android`: track `internal`, status `draft`, kunci `./play-service-account.json` (di-ignore git).
- [x] Target SDK 36, compileSdk 37, minSdk 24: memenuhi syarat target API Play (API 36 untuk app baru dan pembaruan sejak 31 Agustus 2026).
- [x] Halaman memori 16 KB: 30 library native arm64-v8a di APK terakhir sudah sejajar 16 KB (segmen ELF dan offset ZIP).
- [x] Layar Premium sesuai kebijakan langganan Google Play:
  - "14 hari" hanya tampil bila Google Play benar-benar menawarkan uji coba ke akun itu. Google hanya mengembalikan tawaran yang boleh diambil.
  - Di bawah tombol beli tampil harga per periode, kapan tagihan pertama, perpanjangan otomatis, dan cara membatalkan.
  - Tersedia Pulihkan pembelian, Kelola langganan, dan tautan kebijakan privasi.
- [x] Tombol "Coba Pro N hari" di Akun mengikuti tawaran toko yang sama. Bila uji coba sudah tidak tersedia, labelnya "Lihat Pro".
- [x] Webhook RevenueCat menangani `TRANSFER`. Pulihkan pembelian di akun arta lain sekarang benar-benar memberi Pro di server (status dibaca dari API RevenueCat, butuh `REVENUECAT_SECRET_KEY`).
- [x] Iklan:
  - Persetujuan UMP sebelum iklan diminta. Selama pengembangan hanya memakai iklan uji Google.
  - Tombol **Akun > Pilihan privasi iklan** muncul otomatis di wilayah yang mewajibkan (EEA/UK).
  - Template `web/app-ads.txt`.
- [x] Kebijakan privasi diperbarui: AdMob, ID iklan, Gemini, Resend, Masuk dengan Google, catat otomatis dari notifikasi, dan screenshot tagihan.
- [x] Draf listing toko: `docs/store/listing-id.md`.

Izin di manifest rilis (untuk menjawab pertanyaan Play):

| Izin | Asal | Untuk apa |
|---|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK` | app, SDK iklan | Sinkron data, iklan |
| `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` | expo-audio | Catat dengan suara (diminta saat menekan mic) |
| `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE` | expo-notifications | Pengingat jatuh tempo lokal |
| `com.android.vending.BILLING` | RevenueCat | Langganan Pro |
| `com.google.android.gms.permission.AD_ID`, `ACCESS_ADSERVICES_*` | Google Mobile Ads | Iklan pengguna gratis |
| `READ/WRITE_EXTERNAL_STORAGE` (maxSdk 32) | expo-file-system, image-picker | Hanya Android 12 ke bawah |
| Layanan `BIND_NOTIFICATION_LISTENER_SERVICE` (bukan izin runtime) | modul `notifikasi-dompet` | Catat otomatis GoPay/ShopeePay, akses diberikan pengguna di pengaturan sistem |

Tidak ada izin yang butuh formulir deklarasi khusus (SMS, log panggilan, lokasi, semua file, aksesibilitas, `READ_MEDIA_*`, layanan latar depan bertipe, atau exact alarm). Gambar dipilih lewat photo picker sistem.

## B. Langkah Rafli, berurutan

### B1. Akun Play Console

- [ ] Daftar Play Console tipe **pribadi** dan selesaikan verifikasi identitas serta verifikasi perangkat Android.
- [ ] Buat app: nama `arta`, bahasa bawaan Indonesia, **Aplikasi**, **Gratis**.
- [ ] Konfirmasi paket **`id.arta.keuangan`**. ID paket tidak bisa diganti setelah AAB pertama diunggah.
- [ ] Cek kewajiban **PSE Lingkup Privat** (Komdigi) untuk penyelenggara perorangan.
- [ ] Pastikan lagi arta (hanya mencatat; tidak memindahkan uang, tidak memberi pinjaman) tidak masuk ranah izin **OJK**.

### B2. Supabase produksi

Putuskan dulu: memakai project `keuangan-dev` sebagai produksi, atau project baru (disarankan, agar data uji tidak tercampur data pengguna). Langkah di bawah untuk project yang dipakai produksi.

- [ ] Dorong semua migrasi (termasuk `20261121000060_saldo_dompet.sql`, yang baru ada di dev):

```powershell
npx supabase login
```

```powershell
npx supabase link --project-ref <ref>
```

```powershell
npx supabase db push
```

- [ ] Authentication:
  - Email OTP aktif, dan template email memuat `{{ .Token }}`.
  - Provider Google aktif dengan Web client ID yang sama dengan `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- [ ] Set secret (nilai rahasia, jangan ditulis ke repo):
  - AI: `GEMINI_API_KEY` dan/atau `OPENAI_API_KEY` (serta `OPENAI_*` lain bila dipakai), sesuai penyedia di dev.
  - Email laporan: `EMAIL_MODE=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (domain terverifikasi di Resend), `LAPORAN_SECRET`, `LAPORAN_CRON_SECRET`, `LAPORAN_HALAMAN_URL`. Tanpa `EMAIL_MODE=resend`, email hanya dicatat di log dan tidak terkirim.
  - Langganan dan jadwal:

```powershell
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=<acak_panjang>
```

```powershell
npx supabase secrets set REVENUECAT_SECRET_KEY=<kunci_rahasia_api_v1_revenuecat>
```

```powershell
npx supabase secrets set CRON_SECRET=<acak_panjang>
```

- [ ] Deploy fungsi. Webhook tanpa verifikasi JWT, diatur di `supabase/config.toml`:

```powershell
npx supabase functions deploy revenuecat-webhook
```

```powershell
npx supabase functions deploy delete-account
```

```powershell
npx supabase functions deploy parse
```

```powershell
npx supabase functions deploy parse-hutang
```

```powershell
npx supabase functions deploy report-send
```

```powershell
npx supabase functions deploy report-verify
```

```powershell
npx supabase functions deploy report-monthly
```

```powershell
npx supabase functions deploy debt-reminders
```

- [ ] Jadwal cron (`pg_cron` + `pg_net`) untuk `debt-reminders` dan `report-monthly`, sesuai `docs/uji-manual-rencana-5.md` dan dokumen laporan.

### B3. Halaman web (kebijakan privasi, hapus akun, app-ads.txt)

- [ ] Lengkapi placeholder di `web/` (lihat `web/README.md`): email kontak, tanggal, URL hapus akun, Supabase URL/anon key di `hapus-akun.html`, Publisher ID di `app-ads.txt`.
- [ ] Host folder `web/` di **akar domain** (Netlify, atau GitHub Pages situs pengguna). `app-ads.txt` wajib bisa dibuka di `https://domainmu/app-ads.txt`.
- [ ] Catat tiga hal: URL kebijakan privasi, URL hapus akun, dan domain situs (untuk "Situs web" di listing Play).

### B4. Masuk dengan Google untuk paket rilis

Bagian ini sering jadi penyebab penolakan: reviewer tidak bisa masuk.

- [ ] Di Google Cloud (project yang sama dengan Web client ID), buat OAuth client **Android** untuk `id.arta.keuangan` dengan SHA-1 **upload key**. Ambil SHA-1 dengan perintah di bawah: pilih Android, profil `production`, lalu Keystore.

```powershell
npx eas-cli@latest credentials -p android
```

- [ ] Setelah AAB pertama diunggah (B8): tambahkan OAuth client Android kedua dengan SHA-1 **App signing key** dari Play Console (Test and release, App integrity, App signing). App dari Play ditandatangani ulang dengan kunci ini, jadi tanpa SHA-1 ini login Google gagal (`DEVELOPER_ERROR`).

### B5. AdMob

- [ ] Buat app Android di AdMob (setelah app ada di Play, tautkan ke listing).
- [ ] Buat unit iklan **Banner** dan **Rewarded**. Catat App ID (`ca-app-pub-...~...`) dan dua ID unit (`ca-app-pub-.../...`).
- [ ] Privacy & messaging: buat pesan **GDPR (EEA/UK)** dan **US state regulations**. Tanpa pesan GDPR, pengguna di EEA tidak akan mendapat iklan.
- [ ] Unggah `app-ads.txt` (B3), lalu tunggu AdMob memverifikasinya.
- [ ] Jangan mengklik iklan sungguhan sendiri. Daftarkan HP sendiri sebagai perangkat uji di AdMob.

### B6. RevenueCat dan langganan Play

Play Console baru mengizinkan membuat langganan **setelah ada AAB berizin BILLING yang terunggah**. Jadi B8 (unggah pertama ke Internal testing) dikerjakan sebelum langkah produk di bawah.

- [ ] Buat project RevenueCat dan app **Google Play** dengan paket `id.arta.keuangan`. Salin **kunci SDK publik** (diawali `goog_`) untuk B7.
- [ ] Buat service account Google Cloud untuk RevenueCat, beri izin di Play Console (Users and permissions), lalu unggah JSON-nya ke RevenueCat.
- [ ] Hubungkan **Real-time developer notifications** (Pub/Sub) lewat RevenueCat. Tanpa ini perpanjangan, pembatalan, dan refund terlambat sampai di arta.
- [ ] Play Console, Monetize, Subscriptions: buat langganan **`arta_pro`** dengan base plan:
  - `bulanan` (perpanjang otomatis, 1 bulan), Rp19.000;
  - `tahunan` (perpanjang otomatis, 1 tahun), harga ditentukan Rafli;
  - offer **uji coba gratis 14 hari** di base plan bulanan, kelayakan "pelanggan baru" (diatur di Play, bukan di kode).
- [ ] RevenueCat:
  - impor produk, buat entitlement **`pro`**, dan kaitkan kedua produk ke entitlement itu;
  - offering **default** dengan paket `$rc_monthly` (`arta_pro:bulanan`) dan `$rc_annual` (`arta_pro:tahunan`).
- [ ] Webhook RevenueCat:
  - URL: `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`;
  - header Authorization `Bearer <REVENUECAT_WEBHOOK_SECRET>`;
  - kirim event Production dan Sandbox.
- [ ] Simpan **kunci rahasia API v1** RevenueCat sebagai secret Supabase `REVENUECAT_SECRET_KEY` (B2). Kunci ini dipakai untuk TRANSFER (pulihkan pembelian) dan hapus akun.

### B7. Environment variable EAS (wajib sebelum build production)

Nilai `EXPO_PUBLIC_*` ikut di bundle app, jadi publik. Visibility `sensitive` hanya menyamarkannya di log. Jangan memakai `secret` untuk `EXPO_PUBLIC_*`.

| Nama | Isi | Environment |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | production (preview: boleh project dev) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | kunci anon/publishable | production, preview |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Web client ID OAuth | production, preview |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | kunci SDK `goog_...` | production |
| `EXPO_PUBLIC_URL_KEBIJAKAN_PRIVASI` | URL B3 | production, preview |
| `EXPO_PUBLIC_URL_HAPUS_AKUN` | URL B3 | production, preview |
| `ADMOB_ANDROID_APP_ID` | `ca-app-pub-...~...` | production |
| `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` | `ca-app-pub-.../...` | production |
| `EXPO_PUBLIC_ADMOB_REWARD_ANDROID` | `ca-app-pub-.../...` | production |
| `GOOGLE_SERVICES_JSON` (file, opsional) | `google-services.json` dari Firebase | production |

Selama tiga variabel AdMob kosong, build production tetap bisa dibuat tanpa iklan. Bila salah satu ID unit diisi, App ID asli dari akun yang sama wajib ikut diisi.

Contoh (ulangi untuk tiap baris; `--environment` boleh diulang):

```powershell
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co" --environment production --visibility plaintext --non-interactive
```

```powershell
npx eas-cli@latest env:set --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value "goog_xxx" --environment production --visibility sensitive --non-interactive
```

```powershell
npx eas-cli@latest env:set --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production --visibility secret --non-interactive
```

Cek hasilnya:

```powershell
npx eas-cli@latest env:list --environment production
```

`GOOGLE_SERVICES_JSON` (Firebase, untuk push dari server) opsional. Pengingat jatuh tempo memakai notifikasi lokal, jadi tetap jalan tanpa Firebase. Bila dipakai, unggah juga kunci FCM V1 lewat `npx eas-cli@latest credentials -p android`.

### B8. Build dan unggah

- [ ] Uji dulu build **preview** (R8 aktif) di HP. Cek: masuk Google, iklan uji, catat suara (izin mikrofon muncul), catat otomatis, beli dan pulihkan (setelah B6).

```powershell
npx eas-cli@latest build -p android --profile preview
```

- [ ] Bangun AAB rilis. Bila konfigurasi kurang, build berhenti di awal dan menyebut variabelnya.

```powershell
npx eas-cli@latest build -p android --profile production
```

- [ ] **Unggahan pertama wajib manual**: unduh AAB dari expo.dev, lalu unggah ke **Internal testing** di Play Console.
- [ ] Tambahkan akun penguji ke **License testing** (Play Console, Settings) agar pembelian uji tidak menagih.
- [ ] Uji beli, uji coba, batal, dan pulihkan. Cek status Pro di app dan tabel `entitlements`.
- [ ] Untuk rilis berikutnya: buat service account Play dengan izin rilis, simpan JSON-nya sebagai `./play-service-account.json` (di-ignore git), lalu jalankan:

```powershell
npx eas-cli@latest submit -p android --profile production --latest
```

### B9. Play Console: App content

- [ ] **Kebijakan privasi**: URL B3.
- [ ] **Akses aplikasi**: "All or some functionality is restricted", isi petunjuk di bagian E.
- [ ] **Iklan**: **Ya, app berisi iklan**.
- [ ] **ID iklan**: **Ya**, untuk **Iklan atau pemasaran** (izin `AD_ID` dari SDK AdMob).
- [ ] **Rating konten**: isi kuesioner (kategori utilitas/produktivitas; tidak ada kekerasan, perjudian, atau konten pengguna yang dibagikan).
- [ ] **Target audiens**: **18 tahun ke atas**.
- [ ] **Data safety**: isi sesuai bagian D.
- [ ] **Fitur keuangan**: manajemen keuangan pribadi / budgeting; **bukan** pinjaman, bukan investasi, bukan pembayaran.
- [ ] **Penghapusan akun**: URL hapus akun (B3), dan nyatakan juga tersedia di dalam app (Akun > Hapus akun).
- [ ] Aplikasi pemerintahan: **Tidak**. Kesehatan: **Tidak**. Berita: **Tidak**.

### B10. Listing toko

- [ ] Judul, deskripsi singkat, dan deskripsi lengkap: salin dari `docs/store/listing-id.md`.
- [ ] Ikon 512 x 512 dan feature graphic 1024 x 500 sudah ada di `docs/store/`. Tinggal ambil minimal 2 screenshot ponsel (disarankan 4 sampai 8) dari build preview.
- [ ] Kategori **Keuangan**, email kontak developer, situs web (domain B3), dan URL kebijakan privasi.

### B11. Pengujian tertutup dan produksi

- [ ] **Closed testing**: minimal **12 penguji** yang ikut terus-menerus selama **14 hari** (syarat akun pribadi baru; cek angka terbaru di Play Console).
- [ ] Ajukan **akses produksi** di Play Console setelah syarat terpenuhi.
- [ ] Promosikan ke Production dengan **rollout bertahap** (mis. 10% dulu), lalu pantau crash dan ANR di Android vitals.

## C. Catatan

- `version` di `app.json` dinaikkan manual (mis. `1.0.1`); `versionCode` dinaikkan otomatis oleh EAS.
- Build `preview` memakai paket dev (`com.keuanganapp.dev`), jadi bisa terpasang berdampingan dengan versi Play.
- Build rilis memakai R8 (minify dan shrink resources). Fitur yang bergantung pada refleksi (iklan, login Google, pembelian, pendengar notifikasi) wajib dicek di build preview sebelum production.
- Rewarded ad belum diverifikasi server (AdMob SSV). Dampaknya hanya pendapatan iklan, bukan keamanan data (lihat `docs/admob.md`).

## D. Jawaban formulir Data safety

Pertanyaan umum:

| Pertanyaan | Jawaban |
|---|---|
| Apakah app mengumpulkan atau membagikan data pengguna? | **Ya**. |
| Semua data dienkripsi saat transit? | **Ya** (HTTPS/TLS). |
| Pengguna bisa meminta data dihapus? | **Ya**: di app (Akun > Hapus akun) dan lewat URL web hapus akun. |

Per jenis data:

| Kategori Play: jenis data | Dikumpulkan | Dibagikan | Ephemeral | Tujuan | Keterangan |
|---|---|---|---|---|---|
| Info pribadi: Alamat email | Ya | Tidak | Tidak | Fungsi app, manajemen akun | Masuk (OTP/Google) dan email penerima laporan. Disimpan di Supabase. |
| Info pribadi: Nama | Ya | Tidak | Tidak | Fungsi app, manajemen akun | Dari akun Google bila masuk dengan Google. |
| Info pribadi: ID pengguna | Ya | Tidak | Tidak | Fungsi app, manajemen akun | ID akun acak (dipakai juga oleh RevenueCat). |
| Info keuangan: Info keuangan lainnya | Ya | Tidak | Tidak | Fungsi app | Transaksi, saldo, hutang, budget, investasi yang dicatat pengguna. |
| Info keuangan: Riwayat pembelian | Ya | Tidak | Tidak | Fungsi app | Status langganan Pro (Google Play, RevenueCat). |
| Audio: Rekaman suara | Ya | Tidak | **Ya** | Fungsi app | Catat suara; diproses AI lalu dibuang. |
| Foto dan video: Foto | Ya | Tidak | **Ya** | Fungsi app | Screenshot tagihan yang dipilih pengguna; dibaca AI lalu dibuang. |
| Lokasi: Perkiraan lokasi | Ya | **Ya** | Tidak | Iklan, analitik, pencegahan penipuan | Alamat IP oleh SDK AdMob (pengguna gratis). |
| Aktivitas aplikasi: Interaksi aplikasi | Ya | **Ya** | Tidak | Iklan, analitik, pencegahan penipuan | SDK AdMob: peluncuran app, ketukan, tontonan iklan. |
| Info dan performa aplikasi: Diagnostik | Ya | **Ya** | Tidak | Iklan, analitik, pencegahan penipuan | SDK AdMob: performa app dan SDK. |
| ID perangkat atau lainnya | Ya | **Ya** | Tidak | Iklan (ID iklan); fungsi app (token push) | ID iklan dan app set ID oleh AdMob; token push untuk pengingat. |

Bukan "dikumpulkan" menurut definisi Play (diproses hanya di perangkat, tidak dikirim keluar): teks notifikasi GoPay/ShopeePay untuk catat otomatis. Yang terkirim hanyalah transaksi yang disimpan pengguna (sudah tercakup di Info keuangan).

Pemroses (bertindak atas nama arta, tidak dihitung "dibagikan"): Supabase, OpenAI dan Google Gemini API, RevenueCat, Google Play, Resend, Expo Push dan Firebase Cloud Messaging. Data AdMob dihitung **dibagikan** sesuai panduan Google untuk SDK iklan.

Tidak dikumpulkan: lokasi presisi, kontak, kalender, SMS, file, riwayat penelusuran, kesehatan. Periksa ulang bila menambah SDK baru (analitik, pelaporan crash, dan sejenisnya).

## E. Petunjuk "Akses aplikasi" untuk reviewer

Tempel di Play Console (bahasa Inggris agar mudah dibaca reviewer):

```
arta requires sign-in. On the welcome screen tap "Masuk dengan Google" (Sign in with Google) and use any Google account. A new account is created automatically, no invitation or payment is needed.
After signing in, complete the 2-step setup (starting balance can be 0) to reach the home screen.
Optional: "Catat otomatis dari notifikasi" (Account > Data & privacy) reads GoPay/ShopeePay notifications on the device only, after the user grants notification access in Android settings.
Pro subscription (Account > Lihat Pro) can be tested with a license-testing account.
```

Simpan kredensial apa pun hanya di Play Console, jangan di repo.
