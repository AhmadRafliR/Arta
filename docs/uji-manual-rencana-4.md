# Uji Manual Rencana 4: Budget, dana darurat, investasi, laporan email

Rencana: `docs/superpowers/plans/2026-11-20-rencana-4-budget-investasi.md`.

**APK development tidak perlu dibangun ulang**, karena Rencana 4 tidak menambah paket native. Cukup `npx expo start --dev-client`.

## Persiapan (dijalankan Rafli sendiri)

Jalankan perintah berikut satu per satu dari root proyek.

1. Push migrasi `20261120000020_budget.sql` dan `20261120000021_laporan.sql`:

   ```powershell
   npx supabase db push --remote
   ```

2. Jalankan tes integrasi. Pastikan `.env.test` berisi `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`. Yang relevan untuk rencana ini adalah `tests/integration/budget.test.ts` dan `laporan.test.ts`.

   ```powershell
   npm run test:integration
   ```

3. Set secret Edge Function. Ketik sendiri string acak yang panjang, dan jangan menempelkannya ke chat.

   ```powershell
   npx supabase secrets set LAPORAN_SECRET=<string-acak-1> LAPORAN_CRON_SECRET=<string-acak-2>
   ```

4. Opsional, untuk mengirim email sungguhan. Ini butuh domain yang sudah diverifikasi di Resend. Tanpa langkah ini, function hanya mencatat log, berisi alamat yang disamarkan dan subjek, dan **tidak mengirim email**.

   ```powershell
   npx supabase secrets set EMAIL_MODE=resend RESEND_API_KEY=<kunci> "EMAIL_FROM=arta <laporan@domainmu>"
   ```

5. Deploy ketiga function:

   ```powershell
   npx supabase functions deploy report-send
   ```

   ```powershell
   npx supabase functions deploy report-verify --no-verify-jwt
   ```

   ```powershell
   npx supabase functions deploy report-monthly --no-verify-jwt
   ```

6. Jadwal otomatis: buka `supabase/sql/jadwal-laporan.sql`, isi kedua placeholder, lalu jalankan seluruh isinya sekali di SQL editor Supabase.

7. Jadikan akun uji Pro lewat SQL editor. Langganan asli baru tersedia di Rencana 5.

   ```sql
   insert into public.entitlements (user_id, pro_aktif, sumber)
   values ('<uid akun uji>', true, 'uji')
   on conflict (user_id) do update set pro_aktif = true, berlaku_sampai = null;
   ```

## Daftar uji

Centang `- [x]` jika lulus. Kalau gagal, catat temuannya di bawah item itu.

### Budget
- [ ] Akun → Rencana keuangan → Budget. Kalau belum ada budget, keadaan kosong tampil.
- [ ] Tambah budget Makan Rp800.000. Kategori yang sudah punya budget tidak muncul lagi di pilihan.
- [ ] Catat pengeluaran makan Rp320.000. Budget menampilkan "Aman, 40% terpakai".
- [ ] Budget Transport Rp300.000, lalu catat transport Rp264.000. Statusnya "Hampir habis, 88% terpakai", dengan ikon dan teks, tidak hanya warna.
- [ ] Budget Rokok Rp300.000, lalu catat rokok Rp390.000. Statusnya "Lewat budget Rp90.000", dan bar tidak melebihi lebar kartu.
- [ ] Tepi ambang: terpakai tepat 80% → waspada; tepat 100% → masih waspada; 100% + Rp1 → lewat.
- [ ] Beranda menampilkan "Budget paling kritis" berisi kategori dengan persen tertinggi. Ketuk kartunya → membuka layar Budget.
- [ ] Form catat pengeluaran: nominal yang membuat kategori ≥80% atau lewat memunculkan peringatan di atas tombol Simpan. Simpan tetap bisa.
- [ ] Ubah transaksi lama: peringatan tidak menghitung nominal lama dua kali.
- [ ] Ubah batas lalu hapus budget, dengan konfirmasi. Beranda tidak lagi menampilkan kartu kritis bila semua budget dihapus.

### Dana darurat
- [ ] Tanpa dompet darurat → keadaan kosong. "Buat dana darurat" membuka Tambah dompet dengan chip Darurat sudah terpilih.
- [ ] Dana darurat Rp1.000.000 dengan target Rp3.000.000 → persen dan bar progres tampil.
- [ ] Setor Rp100.000 dari GoPay → saldo GoPay turun, dana darurat naik, Riwayat berisi satu transfer. Tekan Simpan dua kali cepat → tetap satu transaksi.
- [ ] Tarik ke Cash → kebalikannya.
- [ ] Ubah target, lalu isi 0 untuk menghapus target.
- [ ] Ada pengeluaran di 3 bulan penuh terakhir → muncul "Cukup untuk N bulan pengeluaran".
- [ ] Sisa uang di Beranda tidak menghitung dana darurat. Kekayaan bersih tetap = total semua dompet − hutang.

### Investasi
- [ ] Tambah aset → Tambah dompet dengan chip Investasi terpilih, misalnya Saham Rp1.000.000.
- [ ] Beli Rp500.000 dari GoPay → nilai Rp1.500.000, modal Rp1.500.000, untung Rp0.
- [ ] Update nilai ke Rp1.650.000 → untung "+Rp150.000 (+10%)", dan Riwayat berisi penyesuaian +Rp150.000. Nilai yang sama → tombol nonaktif "Nilainya sama".
- [ ] Jual Rp200.000 ke Cash → nilai dan modal turun Rp200.000, untung tetap.
- [ ] Nilai di bawah modal → untung negatif berwarna bahaya, dengan tanda minus.

### Laporan email
- [ ] Akun non-Pro: layar Laporan email terkunci dengan ilustrasi dan "Pro segera hadir.", tanpa formulir.
- [ ] Akun Pro: tambah `email-sendiri@…` → "Email konfirmasi dikirim ke …". Status penerima "Menunggu konfirmasi".
- [ ] Mode log (tanpa langkah 4): log function `report-send` hanya berisi alamat yang disamarkan, tanpa isi email dan tanpa token. Uji ujung-ke-ujung butuh mode resend.
- [ ] Mode resend: email konfirmasi masuk. Membuka tautan menampilkan halaman dengan tombol (lihat catatan HTML di bawah). Menekan tombol → penerima jadi "Terverifikasi".
- [ ] Email tidak valid dan email ganda ditolak dengan pesan jelas. Penerima ke-4 ditolak, dan formulir hilang setelah ada 3 penerima.
- [ ] "Kirim ulang" dua kali dalam 10 menit → kali kedua menampilkan pesan tunggu 10 menit.
- [ ] Belum ada penerima terverifikasi → tombol Kirim laporan nonaktif dengan alasan.
- [ ] Kirim laporan Bulan ini dan Bulan lalu → email bergaya invoice berisi ringkasan, kategori vs budget, 5 pengeluaran terbesar, dana darurat, investasi, hutang (bila Rencana 3 sudah di-merge), dan kekayaan bersih. Penerima yang belum terverifikasi tidak menerima.
- [ ] Kirim laporan lebih dari 3 kali dalam 24 jam → pesan batas.
- [ ] Tautan "berhenti menerima" di email → konfirmasi → penerima hilang dari daftar di app.
- [ ] `report-monthly` manual. Bila sekarang tanggal 1–7, lewat pukul 08.00 WIB, dan bulan lalu belum dikirim, laporan terkirim. Panggilan kedua tidak mengirim dobel.

  ```powershell
  curl.exe -X POST "https://<ref>.supabase.co/functions/v1/report-monthly" -H "x-cron-secret: <LAPORAN_CRON_SECRET>"
  ```

- [ ] Header `x-cron-secret` salah → 401.

## Catatan & tindak lanjut

- **Halaman HTML `report-verify` di domain bawaan Supabase.** Dokumentasi Supabase menyebut respons `text/html` dari Edge Function hanya dirender dengan custom domain. Di `*.supabase.co` halaman konfirmasi bisa tampil sebagai teks mentah, sehingga tombol konfirmasi tidak bisa ditekan. Ada tiga pilihan solusi, untuk dikerjakan bersama halaman web kebijakan privasi di Rencana 5:
  - pasang custom domain;
  - buat halaman statis kecil, di hosting yang sama dengan kebijakan privasi, yang membaca `?t=` dan mem-POST ke `report-verify`;
  - buka app lewat deep link.

  Sementara itu, verifikasi bisa diuji dengan mem-POST token dari tautan:

  ```powershell
  curl.exe -X POST "<URL report-verify>" -d "t=<token dari tautan>"
  ```

- **Integrasi peringatan budget ke layar "Cek dulu"** (Rencana 2) dikerjakan setelah Rencana 2 di-merge. Fungsi murni `peringatanBudget` (`src/domain/budget.ts`) sudah menerima banyak draf sekaligus.
- **Koreksi budget lewat suara** (spec §5.7) masih menunggu Rencana 2.
- **Status Pro di app** dibaca dari `useKuotaAi().data.pro` (Rencana 2). Saat Rencana 5 punya hook status langganan, ganti pemanggilan di `app/laporan.tsx`.
- **Kekurangan yang diketahui:**
  - Bila email verifikasi gagal terkirim, pengguna tetap menunggu 10 menit sebelum bisa mencoba lagi.
  - Laporan bulanan yang gagal setelah diklaim tidak dicoba ulang otomatis bulan itu.
  - `report-monthly` memproses pengguna berurutan, jadi untuk banyak pengguna perlu dipecah per batch agar tidak melewati batas waktu function.
- **Lint di worktree:** `eslint.config.js` (milik Rencana 2) mengabaikan `.claude/*`, sehingga `npx expo lint` dari worktree ini tidak memeriksa apa pun. File Rencana 4 dicek dari checkout utama dengan `npx eslint --no-ignore --rule "import/no-unresolved: off" <file>` dan bersih. Aturan `no-unresolved` dimatikan karena alias `@/` di checkout utama menunjuk ke `src` milik checkout itu.
