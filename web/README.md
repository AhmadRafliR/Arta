# Halaman web arta

Dua halaman statis mandiri (CSS inline, tanpa build) yang dibutuhkan Google Play:

| File | Fungsi | Dipakai untuk |
| --- | --- | --- |
| `hapus-akun.html` | Hapus akun lewat web (email, kode 6 digit, ketik HAPUS) | Play Console: "Penghapusan akun" (URL) |
| `kebijakan-privasi.html` | Draf kebijakan privasi | Play Console: "Kebijakan privasi" (URL) |

## 1. Isi dulu

`hapus-akun.html`, bagian `<script>` paling bawah:

- `SUPABASE_URL` -> `https://<ref>.supabase.co`
- `SUPABASE_ANON_KEY` -> kunci **anon/publishable** project (publik, aman di web). **Jangan** isi service role.

Selama masih `GANTI_...`, halaman menampilkan "Halaman belum dikonfigurasi".

Kedua file, cari dan ganti placeholder:

- `[EMAIL KONTAK]` -> email kontak (hapus-akun.html dan kebijakan-privasi.html)
- `[TANGGAL]` -> tanggal pembaruan kebijakan
- `[URL HAPUS AKUN]` -> URL publik `hapus-akun.html` setelah di-host (di kebijakan-privasi.html)
- `[JANGKA WAKTU CADANGAN]` -> lama cadangan database sesuai paket Supabase, atau hapus kalimatnya

Kebijakan privasi masih **draf**: tinjau isinya (idealnya dengan konsultan hukum) sebelum dipublikasikan.

## 2. Supabase

- Fungsi `delete-account` harus sudah di-deploy (`npx supabase functions deploy delete-account`).
- Login OTP email aktif di Authentication -> Providers -> Email. Template email perlu memuat `{{ .Token }}` agar kode 6 digit terkirim (bukan hanya tautan).
- Halaman memakai `shouldCreateUser: false`, jadi email yang belum terdaftar ditolak.

## 3. Host gratis

### GitHub Pages

1. Letakkan folder `web/` di repo (atau repo terpisah), lalu Settings -> Pages.
2. Source: branch `main`, folder `/web` (bila tersedia) atau salin isinya ke `/docs`.
3. URL: `https://<user>.github.io/<repo>/hapus-akun.html` dan `.../kebijakan-privasi.html`.

### Netlify

1. Add new site -> Deploy manually, seret folder `web/` (atau hubungkan repo dengan publish directory `web`).
2. URL: `https://<nama>.netlify.app/hapus-akun.html` dan `.../kebijakan-privasi.html`.

## 4. Setelah di-host

- Tempel URL kebijakan privasi dan hapus akun ke Play Console (App content).
- Isi `[URL HAPUS AKUN]` di `kebijakan-privasi.html`, lalu deploy ulang.
- Uji sekali dengan akun percobaan: email -> kode -> HAPUS -> pastikan akun hilang di Supabase.

Catatan: supabase-js dimuat dari CDN dengan versi terkunci (`@supabase/supabase-js@2.49.4`). Ubah versinya hanya setelah diuji.
