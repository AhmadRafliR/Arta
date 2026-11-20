# Uji manual Rencana 5: langganan, pengingat push, ekspor, hapus akun

Panduan ini untuk Rafli. Perintah dijalankan sendiri, satu per baris. Checklist rilis lengkap ada di `docs/rilis-play-store.md`.

## 0. Persiapan

1. Dorong migrasi `20261120000040`–`42` ke Supabase:

   ```
   npx supabase db push --remote
   ```

2. Jalankan tes integrasi (butuh `.env.test` berisi `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`):

   ```
   npm run test:integration
   ```

   Suite baru: `langganan`, `push_pengingat`, `hapus_akun`. Kalau `hapus_akun` gagal di "semua tabel pengguna punya FK cascade", berarti ada tabel (mungkin dari rencana 3/4) yang `user_id`-nya belum `references auth.users on delete cascade`.

3. Set secret dan deploy fungsi (lihat `docs/rilis-play-store.md` bagian B4).
4. **Bangun ulang APK dev.** Ada paket native baru: `expo-notifications`, `expo-sharing`, `react-native-purchases`.

   ```
   npx eas-cli@latest build -p android --profile development
   ```

5. Jalankan dev server:

   ```
   npx expo start --dev-client
   ```

Catatan tes unit di Windows: `npx jest` tanpa argumen ikut mengambil `tests/integration` dan gagal karena env tidak ada. Pakai:

```
npx jest --testPathIgnorePatterns /node_modules/ integration
```

## 1. Langganan dan layar Premium

**Mode mock** (tanpa `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, build dev):

- [ ] Akun → kartu Langganan menampilkan badge Free dan "Free: catat AI 30× per bulan".
- [ ] Ketuk kartu Langganan → layar Premium muncul dengan crest, "Coba Premium 14 hari", tabel banding, dan pilihan bulanan Rp19.000 / tahunan Rp190.000.
- [ ] Label "Mode uji: pembayaran tidak sungguhan" tampil.
- [ ] "Mulai uji coba 14 hari" → pesan mode uji. Status **tidak** berubah jadi Pro, karena mock tidak boleh mengubah server.

**Status Pro dari server tanpa pembayaran.** Jalankan di SQL Editor dengan `<uuid>` = id akun uji:

```sql
select public.terapkan_event_langganan('<uuid>', true, now() + interval '14 days', 'arta_pro:bulanan', 'trial', true, extract(epoch from now())::bigint * 1000, 'manual');
```

- [ ] Tarik ulang/buka Akun → "Uji coba Pro sampai …", badge Pro.
- [ ] Rekam → sisa kuota sekarang dari 600, atau tersembunyi untuk Pro.
- [ ] Premium → kartu "Pro aktif" + "Kelola langganan".
- [ ] Kembalikan ke gratis dengan event yang lebih baru:

  ```sql
  select public.terapkan_event_langganan('<uuid>', false, now() - interval '1 minute', null, null, false, extract(epoch from now())::bigint * 1000, 'manual');
  ```

  Fitur Pro terkunci lagi, dan data tetap utuh.

**Pembelian sandbox sungguhan** (setelah RevenueCat dan Play Console disiapkan, akun Google terdaftar sebagai *license tester*, dan build dari track internal):

- [ ] Premium menampilkan harga dari Google Play.
- [ ] "Mulai uji coba 14 hari" → dialog Google Play bertanda *test*.
- [ ] Setelah selesai, dalam beberapa detik status menjadi "Uji coba Pro sampai …" (webhook → `entitlements`).
- [ ] Batalkan di dialog Play → tidak ada pesan galat.
- [ ] RevenueCat dashboard → Webhooks → "Send test event" → fungsi membalas 200.
- [ ] Di Play Store, batalkan langganan → status tetap Pro sampai tanggal berakhir, lalu "Pro aktif sampai …".
- [ ] "Pulihkan pembelian" di HP lain dengan akun Google yang sama → Pro aktif.

## 2. Pengingat jatuh tempo (push)

- [ ] Akun Free → baris "Pengingat jatuh tempo · Pro" mengarah ke Premium.
- [ ] Akun Pro → saklar menyala → dialog izin notifikasi muncul sekali.
- [ ] Izinkan → di `push_tokens` ada satu baris `ExponentPushToken[…]` milik akun ini.
- [ ] Tolak izin → pesan "Izin notifikasi ditolak…" + "Buka Pengaturan".
- [ ] Pilih H-3 dan 19.00 → `pengaturan_pengingat` berisi `hari_sebelum=3, jam=19`.
- [ ] Keluar → baris token perangkat ini hilang dari `push_tokens`.
- [ ] Masuk dengan akun Pro lain di HP yang sama dan nyalakan pengingat → token pindah ke akun baru.
- [ ] Panggil fungsi secara manual. Sebelum Rencana 3 menyediakan `tagihan_untuk_pengingat`, respons berisi `catatan: 'tagihan_untuk_pengingat belum tersedia'`:

  ```
  curl -X POST https://<ref>.supabase.co/functions/v1/debt-reminders -H "Authorization: Bearer <CRON_SECRET>"
  ```

- [ ] Tanpa header / secret salah → 401.
- [ ] Setelah Rencana 3:
  - buat tagihan uji yang jatuh tempo besok;
  - set `jam` ke jam sekarang;
  - panggil fungsi → notifikasi "Tagihan … besok" muncul;
  - ketuk notifikasi → tab Hutang terbuka;
  - panggil lagi → tidak dikirim dua kali (`dilewati`).

## 3. Ekspor

- [ ] Akun Free → Akun → "Ekspor data · Pro" → layar terkunci dengan tombol "Lihat Pro".
- [ ] Akun Pro → Excel (.xlsx), Semua → lembar bagikan Android muncul → simpan ke Drive / buka di Google Sheets.
  - [ ] Sheet Transaksi, Dompet, dan Kategori ada.
  - [ ] Nominal berupa angka yang bisa dijumlahkan.
  - [ ] Catatan berisi koma/kutip/baris baru tampil utuh.
- [ ] Buka file yang sama di Microsoft Excel (lokal Indonesia) → kolom terpisah benar.
- [ ] CSV, Bulan ini → hanya transaksi bulan ini, dan huruf seperti "é" tampil benar.
- [ ] Catatan transaksi `=1+1` → di file tampil sebagai teks `'=1+1`, bukan dihitung.
- [ ] Akun dengan > 1000 transaksi (bisa diisi lewat SQL) → semua baris ikut.

## 4. Hapus akun

**Dari app:**

- [ ] Akun → "Hapus akun" → daftar data yang akan dihapus.
- [ ] Akun Pro → peringatan langganan Google Play + "Kelola langganan".
- [ ] Tombol "Hapus akun permanen" nonaktif sampai mengetik `HAPUS` persis.
- [ ] Hapus → kembali ke layar Masuk.
- [ ] Di SQL Editor, hasil di bawah ini kosong:

  ```sql
  select * from public.sisa_data_pengguna('<uuid>');
  ```

- [ ] Masuk lagi dengan email yang sama → akun baru yang kosong (onboarding dari awal).
- [ ] Mode pesawat saat menghapus → pesan offline, dan akun masih ada.

**Dari web** (`web/hapus-akun.html` setelah konstanta diisi dan di-host):

- [ ] Email akun → kode 6 digit masuk ke email. Template OTP Supabase harus memuat `{{ .Token }}`.
- [ ] Email yang tidak terdaftar → tidak membuat akun baru (`shouldCreateUser: false`).
- [ ] Kode salah → pesan galat.
- [ ] Kode benar → ketik HAPUS → "Akun terhapus".
- [ ] `sisa_data_pengguna` kosong.

## 5. Varian build

- [ ] `npx expo config --type public` → `name: arta dev`, `package: com.keuanganapp.dev`.
- [ ] Varian produksi:

  ```powershell
  $env:APP_VARIANT='production'; npx expo config --type public
  ```

  Hasil: `name: arta`, `package: id.arta.keuangan`.

## Hal yang ditunda / tindak lanjut

- **Rencana 2:**
  - Kartu "kuota habis" di `app/rekam.tsx` → tombol ke `/premium?dari=kuota` (layar Premium sudah menangani `dari=kuota`).
  - `kuota_ai()` dan `pro_aktif()` sebaiknya disatukan.
- **Rencana 3:**
  - Buat RPC `tagihan_untuk_pengingat` sesuai kontrak di dokumen rencana 5.
  - Tambahkan `<PengaturanPengingat>` di layar Hutang.
  - Tambahkan sumber ekspor hutang/jadwal.
- **Rencana 4:** sumber ekspor budget; gerbang Pro laporan email pakai `public.pro_aktif(user)`.
- **Langganan:**
  - TRANSFER RevenueCat hanya mencabut Pro dari akun lama. Akun tujuan mendapat Pro pada event berikutnya atau saat "Pulihkan pembelian" memicu event.
  - Sinkronisasi langsung lewat REST RevenueCat belum ada.
- **Notifikasi:** ikon notifikasi Android putih 96×96 (`expo-notifications` plugin `icon`) belum ada, jadi masih memakai ikon app.
- Tes unit di Windows: pola `testPathIgnorePatterns` untuk `tests/integration` tidak bekerja (sudah begitu sebelum rencana 5).
