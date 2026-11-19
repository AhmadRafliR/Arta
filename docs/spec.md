# Desain: App Keuangan "Ngomong aja, beres." (Android)

Tanggal: 2026-11-19 · Status: draf untuk disetujui
Nama app: **belum ditentukan** (pakai nama kerja `keuangan-app` sampai diputuskan).

---

## 1. Maksud & alasan

Rafli sudah punya tracker keuangan pribadi yang jalan di n8n Cloud: catat lewat Telegram (teks/voice note) → AI memecah jadi transaksi → Google Sheets → laporan email bulanan bergaya invoice. Sekarang ia ingin **menjualnya sebagai app Android komersial di Play Store**, dipakai banyak orang, dengan model **gratis + langganan Pro**.

Orang memilih app ini dibanding pencatat keuangan gratis (Money Lover, Finku, dll.) karena tiga hal (USP, diusulkan Claude, diterima Rafli):

1. **Catat pakai suara dengan bahasa santai.** "tadi rokok 25rb pake gopay, parkir 2rb cash" → 2 transaksi lengkap dengan dompetnya. Tanpa formulir.
2. **Fokus hutang & paylater.** Bunga flat/efektif, jadwal tagihan, pengingat jatuh tempo, perkiraan tanggal bebas hutang.
3. **Laporan bulanan otomatis ke orang pilihan** (orang tua, pasangan, teman) sebagai bentuk akuntabilitas.

Target pengguna: mahasiswa & pekerja muda Indonesia; uang bulanan dari ortu atau gaji kecil, beberapa e-wallet, punya paylater/cicilan.

Tagline kerja: *"Ngomong aja, beres."*

## 2. Tujuan, bukan tujuan, anti-tujuan

**Tujuan (v1)**
- App Android terbit di Play Store, bisa diunduh gratis, dengan langganan Pro lewat Google Play.
- Rafli sendiri bisa berhenti memakai bot Telegram dan pindah ke app untuk pemakaian harian.
- Biaya AI per pengguna gratis tetap kecil dan tertutup oleh pendapatan Pro.

**Bukan tujuan (v1)**
- Bot Telegram/WhatsApp untuk pengguna umum.
- Versi iPhone, versi web.
- Scan struk, sinkron otomatis dengan e-wallet/bank.
- Multi mata uang.
- Fitur berbagi dompet antar pengguna.

**Anti-tujuan (gagal walau "jalan")**
- Data satu pengguna bisa terbaca pengguna lain.
- AI menyimpan transaksi salah tanpa pengguna sempat mengecek.
- Biaya AI/infra per pengguna lebih besar daripada pendapatannya.
- Tampilan terasa seperti template generik, bukan produk yang dirawat.
- App ditolak/ditarik Play Store karena kebijakan (billing, privasi, penghapusan akun).

## 3. Batasan

- **Play Store:** langganan fitur digital wajib lewat Google Play Billing (biaya layanan ~15% untuk langganan). Wajib: kebijakan privasi, formulir Data Safety, deklarasi fitur keuangan (app ini = manajemen keuangan pribadi, bukan pinjaman), serta **penghapusan akun dari dalam app dan dari web**. Akun developer pribadi baru wajib uji tertutup dengan sejumlah penguji selama beberapa hari sebelum boleh rilis produksi (cek ulang angka pastinya saat mendaftar).
- **UU PDP (Pelindungan Data Pribadi):** data keuangan = data pribadi; perlu persetujuan, kebijakan privasi berbahasa Indonesia, data terenkripsi saat transit & tersimpan, dan hak hapus data.
- **Dirilis atas nama pribadi Rafli** (keputusan Rafli): akun Play Console tipe pribadi → wajib uji tertutup sebelum rilis produksi, jadi rekrut penguji (teman kampus) dijadwalkan sejak fase awal; Rafli adalah pengendali data menurut UU PDP; kewajiban pendaftaran PSE Lingkup Privat untuk perorangan dicek sebelum rilis.
- App hanya **mencatat**, tidak memindahkan uang → tidak masuk ranah izin OJK (dipastikan ulang sebelum rilis).
- Pengembang tunggal (Rafli + Claude), Windows; build Android lewat EAS Build (cloud), bukan Android Studio lokal.
- Sistem n8n + Sheets yang sekarang **tetap jalan** sampai Rafli pindah ke app; app tidak bergantung padanya.

## 4. Pendekatan yang dipertimbangkan

| | Pendekatan | Untung | Rugi |
|---|---|---|---|
| **A (dipilih)** | App Android asli dengan **Expo (React Native) + Supabase**; logika AI/laporan/pengingat di Supabase Edge Functions; langganan via RevenueCat | Biaya per pengguna paling murah, tidak ada risiko lisensi n8n, terasa app HP asli (mic, notifikasi), patuh billing Play | Pekerjaan awal paling banyak; logika n8n harus dipindah ke kode |
| B | Web app Next.js (gaya PANTRA) dibungkus TWA ke Play Store, backend tetap n8n webhook | Paling cepat jadi, gaya PANTRA bisa dipakai hampir apa adanya | Biaya eksekusi n8n membengkak per pengguna, risiko lisensi n8n untuk produk komersial, Play Billing dari web yang dibungkus itu ribet |
| C | App Expo, tapi AI & laporan sementara masih lewat n8n | Lebih cepat dari A | Tetap harus pindah dari n8n nanti → kerja dua kali |

**Rafli memilih A** karena margin per pengguna dan kepatuhan Play Store lebih penting daripada cepat jadi.

## 5. Yang sudah diputuskan

### 5.1 Model bisnis (keputusan Rafli: gratis + langganan)

| | Gratis | Pro |
|---|---|---|
| Catat pakai AI (suara/ketik bahasa bebas) | 30× per bulan kalender | Tanpa batas (dengan batas wajar anti-penyalahgunaan, mis. 600×/bulan) |
| Catat manual lewat formulir | Tanpa batas | Tanpa batas |
| Dompet, hutang, budget, dana darurat, investasi | ✓ | ✓ |
| Laporan email bulanan otomatis + kirim sekarang | — | ✓, maks. 3 penerima |
| Pengingat jatuh tempo hutang (push) | — | ✓ |
| Ekspor ke Sheets/Excel (CSV/XLSX) | — | ✓ |

Harga: belum final, usulan awal ~Rp19.000/bulan (plus opsi tahunan). Satu "catat pakai AI" = satu permintaan parsing, berapa pun transaksi yang dihasilkan.

### 5.2 Tampilan (keputusan Rafli)

Dua mode, susunan layar identik, hanya token warna yang bertukar. Mengikuti aturan 60/30/10 dari video referensi: aksen hanya untuk aksi penting (mic, tombol utama, progres, uang masuk).

| Peran | Terang = PANTRA | Gelap = Versi D |
|---|---|---|
| Latar (60%) | `#EEF3F5` | `#0B0B0C` |
| Kartu utama & teks (30%) | `#0B424F` (kartu hero gradien `#0B424F → #1F6A76`), kartu biasa `#FFFFFF` | Kartu hero `#FFFFFF` (teks hitam), kartu biasa `#161618`, teks `#FFFFFF` |
| Aksen (10%) | `#52C3BF` | `#C6F432` |
| Garis/teks sekunder | `#DDE7EA` / `#5B7C84` | `#26262A` / `#8A8A8F` |

Default mengikuti pengaturan HP; bisa dipaksa Terang/Gelap di Akun.

Pola dari repo PANTRA yang dipakai: kartu hero bergradasi berisi saldo besar, kartu putih membulat (radius ~16–22px), ikon lucide, sapaan sesuai waktu ("Selamat pagi/siang/sore/malam").

Mockup yang disetujui: `.superpowers/brainstorm/943-1795100178/content/versi-d-layar.html` dan `dua-mode.html`.

### 5.3 Layar v1

Navigasi bawah: **Beranda · Riwayat · [Mic besar di tengah] · Hutang · Akun**.

1. **Beranda** — kartu hero "Sisa uang · semua dompet" + kekayaan bersih (dompet + dana darurat + investasi − sisa hutang); chip saldo per dompet; ringkasan bulan ini (masuk, keluar, kategori budget paling kritis); kartu hutang (jatuh tempo berikutnya + hitungan hari + perkiraan bebas hutang); 3–5 transaksi terbaru.
2. **Merekam** — tahan tombol mic → rekam, gelombang suara, transkrip tampil setelah selesai; tombol "Ketik saja"; info sisa kuota AI (gratis).
3. **Cek dulu (konfirmasi)** — daftar transaksi hasil AI, tiap baris bisa diketuk untuk diubah (jenis, kategori, nominal, dompet, tanggal, catatan) atau dihapus; peringatan budget ≥80% / lewat; "Simpan N transaksi" / "Batal". **Tidak ada yang tersimpan sebelum tombol Simpan.**
4. **Riwayat** — daftar transaksi per bulan, filter jenis/kategori/dompet, ubah & hapus.
5. **Hutang** — total sisa, progres lunas, perkiraan bebas hutang, daftar hutang (pemberi, pokok awal, bunga %, flat/efektif, sisa pokok), jadwal tagihan, pengaturan pengingat (Pro).
6. **Akun** — dompet (tambah/ubah/sesuaikan saldo), budget per kategori, dana darurat & target, investasi, laporan & penerima (Pro), langganan, mode tampilan, ekspor (Pro), kebijakan privasi, hapus akun, keluar.
7. **Onboarding** — masuk (Google / email), buat dompet awal + saldo awal, opsional tambah hutang, izin mikrofon & notifikasi.
8. **Paywall** — muncul saat kuota AI gratis habis atau membuka fitur Pro.

### 5.4 Arsitektur

- **App:** Expo (SDK terbaru stabil) + Expo Router + TypeScript; NativeWind (Tailwind, sama seperti PANTRA) dengan token warna terang/gelap; TanStack Query untuk data server; `expo-audio` untuk rekam; `expo-notifications` untuk push; `react-native-purchases` (RevenueCat) untuk langganan; development build via EAS (bukan Expo Go, karena RevenueCat).
- **Backend:** Supabase
  - Auth: Google + email (magic link/OTP).
  - Postgres dengan **Row Level Security di semua tabel milik pengguna** (`user_id = auth.uid()`).
  - Edge Functions: `parse` (audio/teks → draf transaksi/koreksi), `report-send`, `report-monthly`, `debt-reminders`, `revenuecat-webhook`, `export`, `delete-account`.
  - Simpan transaksi lewat fungsi Postgres (RPC) dalam satu transaksi database, karena `hutang_bayar` harus memecah bunga/pokok dan menandai jadwal secara atomik.
  - `pg_cron` untuk jadwal: laporan tgl 1 pukul 08.00 (zona waktu pengguna, default Asia/Jakarta) dan pengingat hutang harian. **Tidak ada job bunga bulanan** (lihat 5.5).
  - **Online-only di v1.** Tanpa koneksi, app menampilkan data terakhir (cache TanStack Query) dan menolak simpan dengan pesan jelas; antrean offline ditunda.
- **AI:** OpenAI (sama seperti sekarang) — transkripsi bahasa Indonesia + model kecil dengan structured output. Kunci API hanya ada di Edge Function, tidak pernah di app.
- **Email:** Resend dari domain milik app (butuh domain sendiri), template HTML invoice yang dipindah dari WF2.
- **Langganan:** RevenueCat → webhook menulis status Pro ke tabel `entitlements`; app dan Edge Function membaca dari situ (server adalah sumber kebenaran untuk kuota).

### 5.5 Model data (garis besar)

- `profiles` (id = auth user, nama, zona waktu, mode tampilan)
- `wallets` (user_id, nama, **tipe: harian | darurat | investasi**, saldo_awal, tanggal_saldo_awal, target (untuk darurat), diarsip)
  - Dana darurat dan tiap aset investasi (Kripto, Saham BBCA, …) adalah **dompet dengan tipe khusus**, bukan tabel terpisah. Semua uang tinggal di dompet, jadi tidak ada yang terhitung dua kali.
- `transactions` (user_id, tanggal, jenis, kategori, nominal, wallet_id, wallet_tujuan_id, debt_id, porsi_bunga, porsi_pokok, catatan, transkrip, sumber: ai|manual|import)
  - `jenis`: `pemasukan`, `pengeluaran`, `transfer`, `hutang_baru`, `hutang_bayar`, `penyesuaian`
  - Setor/tarik dana darurat dan beli/jual investasi = `transfer` antar dompet (mis. GoPay → Dana darurat). Kenaikan/penurunan nilai investasi = `penyesuaian` pada dompet investasi ("update nilai").
  - Kategori bawaan pengeluaran: rokok, makan, parkir, kuliah, transport, lainnya (pengguna boleh menambah kategori sendiri); pemasukan: ortu, gaji, lainnya.
- `debts` (user_id, pemberi, **tipe: cicilan_tetap | berbunga**, tanggal_mulai, diarsip)
  - `cicilan_tetap` (paylater, kredit HP): nominal_cicilan × tenor bulan mulai tanggal X → app **membuat** `debt_schedule` otomatis. Pembayaran menandai tagihan tertua yang belum lunas. Tanpa pecah bunga.
  - `berbunga` (pinjaman pribadi/pinjol): pokok_awal, bunga_persen_bulanan, metode flat|efektif. Logika n8n: pembayaran pertama di suatu bulan membayar bunga dulu (flat = pokok_awal × rate, efektif = sisa_pokok × rate), sisanya pokok; bunga hanya sekali per bulan; bunga yang tidak dibayar tidak menumpuk. Jadwal opsional, diisi manual.
  - **Sisa pokok dihitung dari transaksi** (pokok_awal − Σ porsi_pokok), tidak disimpan. Mengubah/menghapus `hutang_bayar` lama → RPC menghitung ulang pecahan bunga/pokok pembayaran sesudahnya di hutang yang sama.
  - Hutang baru dari suara: "Cek dulu" menampilkan isian tambahan (tipe, tenor/nominal cicilan atau bunga & metode) dengan default `cicilan_tetap` tanpa bunga.
- `debt_schedule` (debt_id, jatuh_tempo, nominal, status belum|lunas, transaction_id)
- `budgets` (user_id, kategori, batas_bulanan)
- `report_recipients` (user_id, email, maks 3, terverifikasi)
- `ai_usage` (user_id, bulan, jumlah)
- `entitlements` (user_id, pro_aktif, berlaku_sampai, sumber)
- `push_tokens` (user_id, token)

**Saldo dompet** = saldo_awal + efek semua transaksi setelah tanggal_saldo_awal (pemasukan/hutang_baru menambah; pengeluaran/hutang_bayar mengurangi; transfer memindah; penyesuaian ±). **Sisa uang** = total dompet tipe harian. **Kekayaan bersih** = total semua dompet − total sisa hutang. "Sesuaikan saldo" mencatat transaksi `penyesuaian` sebesar selisihnya, jadi riwayat tetap utuh. (Ini menggantikan "estimasi dari baseline" di versi Sheets.)

### 5.6 Logika yang dipindah dari sistem n8n (sudah teruji)

- Prompt & skema parsing (jenis/kategori/nominal/dompet/tanggal, banyak transaksi per pesan, kategori tak dikenal → `lainnya`).
- Pecah `hutang_bayar` jadi porsi bunga & pokok; bunga flat = pokok_awal × rate, efektif = sisa_pokok × rate; bunga dibebankan sekali per bulan.
- Peringatan budget ≥80% / lewat.
- Isi laporan: ringkasan (pemasukan, pengeluaran, setor darurat, bayar hutang, selisih masuk−keluar, **sisa uang = total semua dompet**), per kategori vs budget, 5 pengeluaran terbesar, dana darurat, status hutang & jadwal, investasi, kekayaan bersih.

Sumber: workflow n8n WF1 (`neRo4uQlpRpv9YMn`), WF2 (`FeUy9Rn0gPySpCZB`), WF4 (`JnppasFTjl7wSymR`), dan `implementasi.md`.

### 5.7 Alur catat pakai AI

1. App merekam audio (atau menerima teks) → kirim ke Edge Function `parse` dengan token pengguna.
2. Fungsi mengecek kuota (`ai_usage` + `entitlements`); kalau habis → balas `quota_exceeded` → app membuka paywall.
3. Transkripsi (jika audio) → parsing dengan daftar dompet & hutang milik pengguna sebagai konteks → kembalikan **draf** (tidak disimpan). Audio tidak disimpan setelah diproses.
4. Kuota +1 hanya jika parsing berhasil.
5. Pengguna mengecek/mengubah di layar "Cek dulu" → Simpan → RPC menyimpan semuanya dalam satu transaksi database (RLS melindungi).

**Koreksi saldo pakai suara** (pengganti perintah "update …" di bot): "saldo gopay sekarang 150rb, sisa hutang kredivo 1,2jt" → `parse` mengembalikan draf **koreksi** (nilai lama → nilai baru per dompet/hutang/budget), ditampilkan di "Cek dulu" dengan tampilan "sebelum → sesudah". Saat disimpan, koreksi dompet menjadi transaksi `penyesuaian`; koreksi hutang berbunga menjadi `penyesuaian` pada pokok; budget langsung diubah. Dihitung 1 kuota AI.

### 5.8 Keamanan & privasi

- RLS di semua tabel; Edge Function memakai token pengguna, service role hanya untuk job terjadwal & webhook.
- Penerima laporan harus **terverifikasi** (email konfirmasi) sebelum menerima laporan, supaya app tidak bisa dipakai mengirim spam ke orang sembarangan.
- Hapus akun: menghapus semua baris milik pengguna + akun auth; tersedia di app dan lewat halaman web sederhana.
- Tidak menyimpan audio; transkrip disimpan di transaksi (bisa dihapus bersama transaksinya).

### 5.9 Keputusan Claude (bisa dikoreksi Rafli)

- Hutang dibagi dua tipe (cicilan tetap vs berbunga); tidak ada job bunga bulanan; sisa pokok dihitung dari transaksi.
- Dana darurat & investasi dijadikan dompet bertipe khusus; setor/beli = transfer.
- Koreksi saldo pakai suara masuk v1 (karena Rafli memakainya sehari-hari di bot).
- Online-only di v1.
- Saat langganan Pro berakhir, data tetap utuh; hanya fitur Pro yang terkunci kembali.

## 6. Diserahkan ke builder

- Struktur folder, nama komponen, library ikon (disarankan lucide-react-native), font (disarankan Mona Sans/Poppins seperti PANTRA, atau setara).
- Detail animasi rekam, empty state, loading, pesan error.
- Skema SQL rinci, indeks, migrasi.
- Pemilihan model OpenAI spesifik & prompt akhir (mulai dari prompt WF1).
- Format ekspor (CSV/XLSX).
- Halaman web statis untuk kebijakan privasi & hapus akun (boleh di hosting gratis).
- Skrip impor satu kali data Rafli dari Google Sheets `Keuangan Pribadi` ke akunnya.

## 7. Urutan pengerjaan yang disarankan

1. Fondasi: proyek Expo, Supabase (auth, tabel, RLS), token tema terang/gelap, navigasi.
2. Dompet + catat manual + riwayat + beranda.
3. Catat pakai AI (rekam → parse → cek dulu → simpan) + kuota.
4. Hutang + jadwal + bunga bulanan.
5. Budget, dana darurat, investasi.
6. Laporan email + penerima terverifikasi.
7. Langganan (RevenueCat) + paywall + pengingat push + ekspor.
8. Hapus akun, kebijakan privasi, uji tertutup Play Store, rilis.
