# Checklist rilis Play Store: arta

Dokumen kerja untuk Rafli. Centang saat selesai. Perintah dijalankan satu per baris dari akar repo. Jangan commit `google-services.json`, kunci service account, atau secret apa pun.

## A. Sudah disiapkan (di repo)

- [x] `app.config.ts`: varian lewat `APP_VARIANT`. `production` memberi nama `arta` dan paket `id.arta.keuangan`. Varian lain memberi `arta dev` dan `com.keuanganapp.dev`. Bila `./google-services.json` ada, otomatis dipasang sebagai `android.googleServicesFile`.
- [x] `eas.json`: profil `development`, `preview`, dan `production` mengisi `APP_VARIANT`. `production` memakai `autoIncrement` (versionCode dikelola remote) dan `app-bundle`.
- [x] `eas.json`: `submit.production.android` = track `internal`, status `draft`.
- [x] Draf listing toko: `docs/store/listing-id.md`.
- [x] Jawaban formulir Data safety: bagian D di bawah.

## B. Harus dilakukan Rafli sendiri

### B1. Akun dan identitas

- [ ] Daftar akun Google Play Console tipe **pribadi** dan selesaikan verifikasi identitas.
- [ ] Konfirmasi ID paket rilis **`id.arta.keuangan`**. ID paket tidak bisa diganti setelah AAB pertama diunggah.
- [ ] Cek kewajiban **PSE Lingkup Privat** (Komdigi) untuk penyelenggara perorangan.
- [ ] Pastikan lagi bahwa arta (hanya mencatat, tidak memindahkan uang atau memberi pinjaman) tidak masuk ranah izin **OJK**.

### B2. Firebase / FCM (notifikasi push)

- [ ] Buat project Firebase, tambahkan app Android dengan paket `id.arta.keuangan`.
- [ ] Unduh `google-services.json`, taruh di akar repo. Pastikan tidak ikut ter-commit (cek `git status`; tambahkan ke `.gitignore` bila perlu).
- [ ] Buat kunci service account FCM V1 (Firebase Console, Project settings, Service accounts), lalu unggah lewat EAS: pilih Android, lalu Google Service Account Key for FCM V1.

```
npx eas-cli@latest credentials
```

### B3. RevenueCat

- [ ] Buat project RevenueCat dan app Android (paket `id.arta.keuangan`).
- [ ] Buat service account Google Cloud untuk Play, beri izin di Play Console, lalu masukkan kredensialnya di RevenueCat.
- [ ] Buat entitlement **`pro`**.
- [ ] Di Play Console (Monetize, Subscriptions) buat langganan **`arta_pro`** dengan dua base plan:
  - bulanan Rp19.000;
  - tahunan (harga ditentukan Rafli);
  - pasang **free trial 14 hari** sebagai offer di base plan (bukan di kode).
- [ ] Impor produk ke RevenueCat dan kaitkan ke entitlement `pro`.
- [ ] Buat offering **default** dengan paket `$rc_monthly` dan `$rc_annual`.
- [ ] Atur webhook RevenueCat ke URL berikut, dengan header Authorization berisi `Bearer <REVENUECAT_WEBHOOK_SECRET>`:

```
https://<ref>.supabase.co/functions/v1/revenuecat-webhook
```

- [ ] Simpan **kunci publik Android** RevenueCat sebagai env EAS (tanpa kunci ini build rilis menampilkan "Langganan belum tersedia"):

```
npx eas-cli@latest env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value <kunci_publik> --environment production --visibility sensitive
```

- [ ] Isi URL web kebijakan privasi dan hapus akun sebagai env EAS (nama sesuai `src/config.ts`; cocokkan bila berbeda):

```
npx eas-cli@latest env:create --name EXPO_PUBLIC_URL_KEBIJAKAN_PRIVASI --value <url> --environment production --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_URL_HAPUS_AKUN --value <url> --environment production --visibility plaintext
```

### B4. Supabase

- [ ] Hubungkan CLI ke project, lalu dorong migrasi:

```
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

- [ ] Set secret (nilai rahasia, jangan ditulis ke repo):

```
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=<acak_panjang>
npx supabase secrets set REVENUECAT_SECRET_KEY=<kunci_rahasia_v1_revenuecat>
npx supabase secrets set CRON_SECRET=<acak_panjang>
npx supabase secrets set EXPO_ACCESS_TOKEN=<token_expo_opsional>
```

- [ ] Deploy tiga fungsi (webhook tanpa verifikasi JWT, diatur di `supabase/config.toml`):

```
npx supabase functions deploy revenuecat-webhook
npx supabase functions deploy debt-reminders
npx supabase functions deploy delete-account
```

- [ ] Aktifkan ekstensi `pg_cron` dan `pg_net` (Dashboard, Database, Extensions), lalu jalankan SQL jadwal pengingat per jam di SQL Editor:

<!-- SQL cron: diisi orkestrator -->

- [ ] Jalankan tes integrasi (lihat `docs/uji-manual-rencana-5.md`).

### B5. Halaman web

- [ ] Host folder `web/` secara gratis (GitHub Pages atau Netlify).
- [ ] Lengkapi `web/kebijakan-privasi.html` (ganti `[EMAIL KONTAK]` dan `[TANGGAL]`, tinjau isinya).
- [ ] Catat dua URL final: kebijakan privasi dan hapus akun (`web/hapus-akun.html`), lalu isi env EAS di B3.

### B6. Listing toko

- [ ] Judul, deskripsi singkat, dan deskripsi lengkap: salin dari `docs/store/listing-id.md`.
- [ ] Ikon 512 x 512 dan feature graphic 1024 x 500.
- [ ] Minimal 2 screenshot ponsel.
- [ ] Kategori **Keuangan**.
- [ ] Email kontak developer dan URL kebijakan privasi di halaman listing.

### B7. Play Console: App content

- [ ] Kebijakan privasi: isi URL (B5).
- [ ] Akses app: sediakan **akun uji** untuk reviewer beserta petunjuk masuk. Simpan kredensial di Play Console saja, bukan di repo.
- [ ] Iklan: **Tidak** ada iklan.
- [ ] Rating konten: isi kuesioner.
- [ ] Target audiens: **18 tahun ke atas**.
- [ ] Data safety: isi sesuai bagian D.
- [ ] Financial features: pilih **manajemen keuangan pribadi / budgeting**; bukan pinjaman.
- [ ] Penghapusan akun: URL web hapus akun (B5), dan nyatakan juga tersedia di dalam app.
- [ ] Aplikasi pemerintahan: **Tidak**.

### B8. Build dan pengujian

- [ ] Bangun ulang APK development (ada paket native baru: notifications, sharing, purchases):

```
npx eas-cli@latest build -p android --profile development
```

- [ ] Bangun AAB rilis:

```
npx eas-cli@latest build -p android --profile production
```

- [ ] Unduh AAB lalu **unggah manual** sebagai rilis pertama ke track **Internal testing** (upload pertama ke Play Console wajib manual).
- [ ] Tambahkan akun penguji ke **License testing** (Play Console, Settings) supaya pembelian sandbox tidak menagih.
- [ ] Uji alur beli, uji coba, batal, dan pulihkan di perangkat; cek status Pro di app dan tabel `entitlements`.
- [ ] Buat service account Play untuk submit; simpan kunci JSON di luar repo (jangan di-commit) dan arahkan lewat `serviceAccountKeyPath` di `eas.json` secara lokal. Untuk rilis berikutnya:

```
npx eas-cli@latest submit -p android --profile production
```

- [ ] **Closed testing**: rekrut **≥12 penguji selama ≥14 hari** berturut-turut (cek angka terbaru di Play Console).
- [ ] Setelah syarat terpenuhi, ajukan **akses produksi** di Play Console.
- [ ] Setelah disetujui, promosikan ke Production dengan **rollout bertahap** (mis. 10% dulu) dan pantau crash.

## C. Catatan

- `version` di `app.json` dinaikkan manual; `versionCode` dinaikkan otomatis oleh EAS (`autoIncrement`, sumber remote).
- Build `preview` memakai paket dev (`com.keuanganapp.dev`), jadi bisa terpasang berdampingan dengan versi rilis.

## D. Jawaban formulir Data safety

Pertanyaan umum:

| Pertanyaan | Jawaban |
|---|---|
| Apakah app mengumpulkan data pengguna? | Ya. |
| Data dienkripsi saat transit? | **Ya** (HTTPS/TLS). |
| Pengguna bisa meminta data dihapus? | **Ya**, dari dalam app dan lewat URL web hapus akun. |
| Dibagikan ke pihak ketiga untuk iklan atau pemasaran? | Tidak. |

Per jenis data (tujuan hanya fungsi app dan manajemen akun):

| Jenis data (kategori Play) | Dikumpulkan | Dibagikan | Keterangan |
|---|---|---|---|
| Alamat email (Info pribadi) | Ya | Tidak (hanya pemroses) | Masuk (OTP email/Google) dan pengiriman laporan. Disimpan di Supabase. |
| Transaksi, saldo, hutang, budget yang dicatat pengguna (Info keuangan) | Ya | Tidak (hanya pemroses) | Disimpan di Supabase. Teks catatan dikirim ke OpenAI untuk diurai. |
| Rekaman suara (Audio) | Ya, dikirim untuk diproses | Tidak (hanya pemroses) | **Diproses lalu dibuang, tidak disimpan.** Dikirim lewat Edge Function ke OpenAI untuk transkripsi. |
| ID perangkat atau ID lain: token push | Ya | Tidak (hanya pemroses) | Untuk notifikasi pengingat. Dihapus saat keluar akun atau hapus akun. |
| Riwayat pembelian (Info keuangan) | Ya | Tidak (hanya pemroses) | Dikelola Google Play dan RevenueCat; status Pro disimpan di Supabase. |

Pemroses pihak ketiga (bertindak atas nama app, bukan untuk tujuan sendiri):

- Supabase: autentikasi, basis data, fungsi server.
- OpenAI: transkripsi suara dan penguraian teks.
- RevenueCat: status langganan.
- Google Play: pembayaran dan langganan.
- Expo (Expo Push Service) dan Firebase Cloud Messaging: pengiriman notifikasi.

Tidak dikumpulkan: lokasi, kontak, foto/video, pesan, riwayat penelusuran, kesehatan. Periksa ulang bila fitur baru menambah SDK (mis. analitik atau pelaporan crash).
