# Rencana 3: Hutang & jadwal tagihan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Status

Disetujui 2026-11-20. Pengguna menyerahkan keputusan teknis ke Claude, dan lima keputusan di bawah diterima apa adanya. Branch: `claude/rencana-3-172b0c` (worktree `.claude/worktrees/rencana-3-172b0c`). **Belum di-push, dan migrasi belum di-apply ke remote.** Rentang nomor migrasi Rencana 3: `20261120000008`–`20261120000019`.

| Task | Status | Commit |
|---|---|---|
| Tipe bersama (`src/domain/types.ts`) | selesai | `9c62001` |
| 1 Tabel hutang, jadwal, view | selesai (SQL belum dijalankan di DB) | `62df27b` |
| 2 RPC v3 + hitung ulang | selesai (SQL belum dijalankan di DB) | `98cf023` |
| 3 Domain | selesai | `eba4096` |
| 4 Lapisan data | selesai | `169089d` |
| 5 Tab Hutang + detail | belum (berikutnya; pakai juga `useRiwayatPokok` dari `c5c7233` untuk `ringkasHutang`) | – |
| 6 Form baru/bayar/sesuaikan | belum | – |
| 7 Beranda + TxRow | belum (pakai `useRiwayatPokok`) | – |
| 8 Panduan uji | belum | – |
| 9 Draf AI hutang | diblokir (menunggu Rencana 2 di `main`) | – |

### Keputusan saat implementasi (Claude)
- **Bunga sesudah lunas.** Bunga tidak ditagih bila sisa pokok sebelum bayar ≤ 0, termasuk untuk metode flat. Akibatnya, pembayaran ke hutang yang sudah lunas tertolak sebagai lebih bayar. Aturan ini diterapkan di SQL (`hitung_ulang_hutang`) dan di domain (`bungaBulanIni`).
- **Hak eksekusi `hitung_ulang_hutang`.** Fungsi ini tetap punya EXECUTE untuk `authenticated`, karena trigger `security invoker` berjalan sebagai pengguna. Panggilan langsung dari klien tetap ditolak lewat penjaga `pg_trigger_depth() < 1`.
- **Trigger tambahan `debt_schedule_hitung_ulang_aiud`.** Mengubah atau menghapus tagihan, termasuk lewat `tambah_jadwal`, ikut menghitung ulang status.
- **Constraint tambahan:**
  - `debts_pokok_cicilan`: untuk cicilan tetap, `pokok_awal = nominal_cicilan × tenor_bulan`, sehingga `pokok_awal` cicilan tidak bisa diubah;
  - `transactions_penyesuaian_hutang`: penyesuaian hutang tanpa dompet dan `porsi_pokok = nominal`.
- **Respons RPC v3.** `save_transactions` v3 membaca ulang baris setelah trigger, jadi `porsi_*` di respons sudah hasil hitungan server.
- **`ringkasHutang`.** Fungsi ini menerima `riwayatPokok` per hutang sebagai parameter ketiga opsional, untuk perkiraan hutang berbunga tanpa jadwal. `labelBulan` diekspor ulang dari `@/lib/tanggal`.
- **Sebelum `db push`.** `select count(*) from transactions where jenis in ('hutang_baru','hutang_bayar')` harus 0; kalau tidak, check baru gagal.
- **Lint:** `npx expo lint` masih punya 3 error di file lama yang tidak diubah Rencana 3 (`src/auth/AuthProvider.tsx:57`, `src/components/__tests__/TabBar.test.tsx:39`, `src/nav/__tests__/NavPulauProvider.test.tsx:14`); perbaiki sebelum dinyatakan selesai.
- **Jest di worktree ini.** `testPathIgnorePatterns` `<rootDir>/tests/integration/` tidak cocok di path Windows worktree ini (`\r` di `\rencana-3…`). Untuk verifikasi, pakai `npx jest --testPathIgnorePatterns=integration`. `package.json` sengaja tidak diubah supaya tidak bentrok dengan Rencana 2.

## Ringkasan

**Goal:** Pengguna mencatat hutang dan paylater (cicilan tetap atau pinjaman berbunga), membayarnya dari dompet, dan melihat sisa pokok, jadwal tagihan, jatuh tempo berikutnya, serta perkiraan tanggal bebas hutang. Pembayaran hutang berbunga dipecah otomatis menjadi porsi bunga dan porsi pokok di server. Beranda menampilkan kartu hutang, dan kekayaan bersih dikurangi sisa hutang.

**Architecture:**
- **Server (Postgres):**
  - tabel `debts` dan `debt_schedule`, dengan RLS dan FK komposit pemilik;
  - RPC `save_transactions` v3 (nama dan bentuk item sama, sesuai `2026-11-19-app-fondasi.md:188`) kini menerima `hutang_baru` dan `hutang_bayar`;
  - fungsi `hitung_ulang_hutang(debt_id)` menghitung ulang pecahan bunga/pokok semua pembayaran dan status jadwal. Fungsi ini dipanggil oleh trigger setiap kali transaksi hutang ditambah, diubah, atau dihapus. Dengan begitu ubah/hapus dari Riwayat (yang memakai `update`/`delete` PostgREST langsung) tetap konsisten tanpa mengubah alur yang ada;
  - view `v_hutang` (`security_invoker`) berisi ringkasan per hutang (sisa pokok, tagihan lunas, jatuh tempo berikutnya), supaya app tidak perlu memuat semua pembayaran.
- **Logika murni app** (`src/domain/hutang.ts`): perkiraan bebas hutang, hitungan hari jatuh tempo, ringkasan total, dan pratinjau pecahan bunga/pokok di form bayar. Server tetap menjadi sumber kebenaran.
- **App:** tab Hutang (daftar + ringkasan), modal `hutang/baru`, `hutang/[id]` (detail + jadwal + riwayat bayar), `hutang/bayar`, `hutang/sesuaikan`; kartu hutang di Beranda.

**Tech Stack:** Expo SDK 58 + Expo Router, Supabase JS (`rpc`, `from`), TanStack Query, NativeWind. **Tidak ada dependensi baru**, sehingga `package.json`, `package-lock.json`, dan APK dev tidak berubah. Tes: Jest + RNTL v14, tes integrasi DB (`npm run test:integration`).

**Spec:** `docs/spec.md` §1 (USP 2), §5.3 layar 1 dan 5, §5.4 (RPC atomik, tanpa job bunga bulanan), §5.5 (`debts`, `debt_schedule`, aturan bunga, sisa pokok dari transaksi), §5.7 (koreksi hutang berbunga = `penyesuaian` pada pokok), §5.9. Acuan visual: `docs/design/arta/kit.html` (`.debt-card`: nama pemberi, badge jatuh tempo `status-jatuh-tempo` warna `warnInk`, nominal sisa besar, sub "Sisa pokok · 4 dari 12 cicilan lunas"; keadaan kosong "Belum ada hutang tercatat. Tambahkan paylater atau cicilan kalau ada."; ikon `nav-hutang`, `status-lunas`).

## Keputusan produk (usulan Claude, disetujui 2026-11-20)

1. **Hutang baru tanpa dompet.** `hutang_baru` boleh tanpa `wallet_id`. Contohnya paylater untuk belanja langsung atau kredit HP: uangnya tidak pernah masuk dompet, dan saldo dompet tidak berubah. Jika dompet dipilih (misalnya pinjaman tunai), `nominal` masuk ke dompet itu.
   - Akibatnya: barang yang dibeli dengan paylater **tidak** tercatat sebagai pengeluaran bulan itu. Pengeluarannya baru terasa saat cicilan dibayar (`hutang_bayar` mengurangi dompet).
   - Alternatifnya, pengguna mencatat pengeluaran terpisah, tetapi cara itu menghitung uang dua kali di laporan.
2. **Hutang yang sudah berjalan sebelum pakai app.**
   - **Cicilan tetap:** isi *sisa* tenor dan jatuh tempo berikutnya, tanpa riwayat lama.
   - **Berbunga:** isi pokok awal dan sisa pokok sekarang. Selisihnya dicatat sebagai `penyesuaian` pada pokok (tanpa dompet), supaya bunga flat tetap dihitung dari pokok awal.
3. **Pembayaran melebihi sisa** (bunga bulan itu + sisa pokok) ditolak dengan pesan `'Pembayaran melebihi sisa hutang'`. Pembayaran tidak dipotong diam-diam.
4. **Menghapus hutang** menghapus juga semua transaksinya (hutang baru, pembayaran, penyesuaian) setelah konfirmasi, sehingga saldo dompet dihitung ulang. Kalau hanya ingin menyembunyikan hutang yang sudah lunas, pakai "Arsipkan".
5. **Di luar Rencana 3:**
   - pengingat push jatuh tempo (Pro), masuk Rencana 5 bersama `expo-notifications`;
   - langkah tambah hutang di onboarding, karena menyentuh `AuthGate` dan alur onboarding. Gantinya, keadaan kosong tab Hutang punya tombol "Tambah hutang";
   - menyambungkan draf AI hutang (Task 9) masih menunggu Rencana 2.

## Global Constraints

- **Jenis hutang dan saldo dompet.**
  - `hutang_baru` dengan dompet menambah saldo dompet; tanpa dompet tidak mengubah saldo apa pun.
  - `hutang_bayar` wajib dompet dan mengurangi saldo dompet.
  - `penyesuaian` dengan `debt_id` tidak punya dompet (`wallet_id` null) dan hanya mengubah sisa pokok.
  - `walletBalances` yang ada sudah benar untuk ketiganya: id dompet null diabaikan.
- **Dua tipe hutang** (`debts.tipe`):
  - **`cicilan_tetap`**
    - Field wajib: `nominal_cicilan` > 0 dan `tenor_bulan` 1–60.
    - `pokok_awal` = `nominal_cicilan × tenor_bulan` dan dihitung server, bukan dikirim app.
    - Jadwal dibuat otomatis: `tenor_bulan` tagihan mulai `jatuh_tempo_pertama`, setiap +1 bulan. Akhir bulan mengikuti Postgres (31 Jan + 1 bulan = 28/29 Feb).
    - Tanpa bunga: `porsi_bunga` = 0 dan `porsi_pokok` = `nominal`. `penyesuaian` tidak diizinkan.
  - **`berbunga`**
    - Field wajib: `pokok_awal` > 0, `bunga_persen_bulanan` 0–100 (numeric, 2 desimal), dan `metode` `flat|efektif`.
    - Jadwal opsional, diisi manual per tagihan.
- **Pecah bunga/pokok** (berbunga), dihitung berurutan per hutang menurut `(tanggal, created_at, id)`:
  - Pembayaran **pertama** di suatu bulan kalender (dari `tanggal`) membayar bunga lebih dulu:
    - flat: `round(pokok_awal × rate)`;
    - efektif: `round(sisa_pokok_sebelum × rate)`;
    - `rate` = `bunga_persen_bulanan / 100`, dibulatkan ke rupiah terdekat (setengah ke atas).
  - `porsi_bunga` = `min(nominal, bunga)` dan `porsi_pokok` = `nominal − porsi_bunga`.
  - Pembayaran berikutnya di bulan yang sama seluruhnya masuk ke pokok.
  - Bunga yang tidak terbayar **tidak menumpuk**. Tidak ada job bunga bulanan.
- **Sisa pokok** tidak disimpan: `pokok_awal − Σ porsi_pokok` dari semua `hutang_bayar` dan `penyesuaian` milik hutang itu. `penyesuaian` memakai `porsi_pokok` bertanda: positif mengurangi sisa, negatif menambah sisa. `nominal` = `porsi_pokok`, dan nilainya ≠ 0.
- **Status jadwal** dihitung ulang, tidak di-update satu per satu:
  - `dibayar` = Σ `nominal` semua `hutang_bayar` hutang itu.
  - Tagihan diurutkan menurut `jatuh_tempo`. Tagihan ke-k `lunas` jika `dibayar` ≥ jumlah nominal tagihan 1..k.
  - `transaction_id` = pembayaran yang pertama kali membuat jumlah kumulatif mencapai tagihan itu.
- **Hutang diarsip** tidak menerima pembayaran atau penyesuaian baru (`'Hutang sudah diarsipkan'`), tetapi riwayatnya tetap tampil.
- **Keamanan:**
  - RLS di `debts` dan `debt_schedule` (`user_id = (select auth.uid())`);
  - FK komposit `(debt_id, user_id) → debts(id, user_id)`, mengikuti pola `20261119000003_wallet_fk_owner.sql`;
  - `GRANT` eksplisit untuk `authenticated` (konvensi `20261119000002_grants.sql`), `revoke … from anon, public`;
  - fungsi `security invoker`, `set search_path = ''`.
- **Nomor migrasi mulai `20261120000008`**, karena Rencana 2 sudah memakai `…0006` dan `…0007`.
- **Gaya:**
  - semua teks UI bahasa Indonesia;
  - setiap `<Text`/`<TextInput` wajib `font-sans` (dijaga `src/__tests__/font.test.ts`);
  - aksen `acc` hanya untuk tombol utama dan progres lunas; badge jatuh tempo memakai `warnInk`; format uang `Rp1.200.000` (`formatRupiah`).
- **Sebelum setiap commit:** jalankan `npx jest`, `npx tsc --noEmit`, dan `npx expo lint`. Migrasi di-push oleh Rafli (`npx supabase db push --remote`); tes integrasi dijalankan setelah push.

## Titik bentrok dengan Rencana 2 (branch `rencana-2`, dikerjakan paralel)

| File | Rencana 2 | Rencana 3 | Penanganan |
|---|---|---|---|
| `supabase/migrations/` | `…0006_kuota_ai.sql`, `…0007_kuota_ai_grants.sql` | mulai `…0008` | Nomor tidak tumpang tindih. Jika Rencana 2 menambah migrasi lagi sebelum merge, nomor Rencana 3 digeser. |
| RPC `save_transactions` | **tidak diubah**, tetapi dipanggil oleh layar `cek` (Task 6) dengan item `pemasukan|pengeluaran|transfer|penyesuaian` | diganti v3 (`create or replace`) | Bentuk item lama tetap diterima apa adanya, dan field `debt_id`/`hutang` opsional. Tes integrasi v3 menyertakan item gaya Rencana 2 (`sumber: 'ai'`, `transkrip` terisi). Batas maksimal 50 item per panggilan (tindak lanjut Rencana 1) berlaku juga untuk `cek`. |
| `src/data/errors.ts` | menambah `kind: 'kuota'` | **tidak diubah** | Rencana 3 memakai `toAppError` apa adanya (pesan P0001 dari RPC tampil langsung). |
| `tsconfig.json`, `package.json`, `package-lock.json` | `exclude` Deno, jest path, `expo-file-system`/`expo-audio` | **tidak diubah** | Tanpa dependensi baru. |
| `src/data/transactions.ts` | tidak diubah, tetapi `NewTx` dipakai `cek` | `NewTx` diberi field opsional `debt_id?`, `hutang?`; `COLS` dan invalidasi ditambah | Hanya penambahan opsional, jadi pemanggil Rencana 2 tetap valid. |
| `app/_layout.tsx` | mendaftarkan `rekam` dan `cek` | mendaftarkan `hutang/baru`, `hutang/[id]`, `hutang/bayar`, `hutang/sesuaikan` | Konflik teks kecil di blok `<Stack>` yang sama; saat merge, ambil kedua sisi. |
| `docs/tindak-lanjut-rencana-1.md` | Task 7 menambah bagian "Dari Rencana 2" | **tidak diubah** | Hal yang ditunda Rencana 3 ditulis di `docs/uji-manual-rencana-3.md`. |
| `supabase/functions/_shared/parsing.ts`, `src/ai/*`, `app/cek.tsx` | milik Rencana 2 | hanya Task 9 (diblokir) | Dikerjakan setelah Rencana 2 di-merge ke `main`. |

## Pembagian kerja paralel

- **Gelombang A** (tiga subagent paralel, file tidak beririsan):
  - Task 1 lalu Task 2 berurutan, oleh satu agen (migrasi + tes integrasi);
  - Task 3 (domain murni);
  - Task 4 (lapisan data; supabase di-mock, kontrak SQL diambil dari dokumen ini).
- **Gelombang B** (tiga subagent paralel setelah A selesai):
  - Task 5 (tab Hutang + detail, **pemilik tunggal `app/_layout.tsx`**, mendaftarkan keempat modal sekaligus);
  - Task 6 (form baru/bayar/sesuaikan);
  - Task 7 (Beranda + `TxRow`).
- **Penutup:** Task 8 (panduan uji), lalu review akhir.
- **Diblokir:** Task 9, menunggu Rencana 2 di `main`.

## Review Focus

1. **Bunga hanya sekali per bulan dan tidak menumpuk.** Contoh: dua pembayaran di November → hanya yang pertama mengandung bunga. Tidak membayar di Desember → Januari tetap hanya satu kali bunga. Tes di Task 2 dan Task 3.
2. **Ubah tanggal atau hapus pembayaran lama** dari Riwayat → pecahan bunga/pokok pembayaran sesudahnya dan status jadwal ikut berubah. Tes di Task 2.
3. **Hutang milik pengguna lain** tidak bisa dibaca, dibayar, atau dirujuk lewat `debt_id` (FK komposit + RLS). Tes di Task 1.
4. **Tekan Simpan dua kali / coba lagi setelah gagal** → id transaksi dan id hutang stabil, jadi hanya tersimpan sekali (`on conflict do nothing` di kedua tabel). Tes di Task 2 dan Task 6.
5. **Kekayaan bersih dan sisa uang:** hutang tanpa dompet tidak mengubah sisa uang, tetapi mengurangi kekayaan bersih. Tes di Task 3 dan Task 7.

---

### Task 1: Tabel hutang, jadwal, view ringkasan

**Files:**
- Create: `supabase/migrations/20261120000008_hutang.sql`
- Test: `tests/integration/hutang.test.ts`

**Interfaces:**
- Produces (SQL):
  - **Tabel `public.debts`** dengan kolom:
    - `id uuid primary key default gen_random_uuid()`
    - `user_id uuid not null default auth.uid() references auth.users on delete cascade`
    - `pemberi text not null check (length(trim(pemberi)) between 1 and 60)`
    - `tipe text not null check (tipe in ('cicilan_tetap','berbunga'))`
    - `tanggal_mulai date not null`
    - `pokok_awal bigint not null check (pokok_awal > 0)`
    - `nominal_cicilan bigint`, `tenor_bulan int`
    - `bunga_persen_bulanan numeric(5,2)`, `metode text check (metode in ('flat','efektif'))`
    - `diarsip boolean not null default false`, `created_at timestamptz not null default now()`
    - `unique (id, user_id)`
    - check per tipe: `cicilan_tetap` → `nominal_cicilan > 0`, `tenor_bulan between 1 and 60`, `bunga_persen_bulanan is null`, `metode is null`; `berbunga` → `bunga_persen_bulanan between 0 and 100`, `metode is not null`, `nominal_cicilan is null`, `tenor_bulan is null`.
  - **Tabel `public.debt_schedule`** dengan kolom:
    - `id uuid primary key default gen_random_uuid()`, `user_id uuid not null default auth.uid()`
    - `debt_id uuid not null`, FK komposit `(debt_id, user_id) → debts(id, user_id) on delete cascade`
    - `jatuh_tempo date not null`, `nominal bigint not null check (nominal > 0)`
    - `status text not null default 'belum' check (status in ('belum','lunas'))`
    - `transaction_id uuid references public.transactions(id) on delete set null`
    - `unique (debt_id, jatuh_tempo)`
  - **`public.transactions`:**
    - FK komposit `(debt_id, user_id) → debts(id, user_id) on delete cascade`;
    - check `jenis not in ('hutang_baru','hutang_bayar') or debt_id is not null`;
    - check `debt_id is null or jenis in ('hutang_baru','hutang_bayar','penyesuaian')`;
    - check `jenis <> 'hutang_bayar' or wallet_id is not null`;
    - indeks `transactions_debt_id_idx (debt_id)`.
  - **RLS dan grant:** RLS + policy select/insert/update/delete milik sendiri di kedua tabel; `grant select, insert, update, delete … to authenticated`.
  - **View `public.v_hutang`** dengan `security_invoker = true`, satu baris per hutang:
    - semua kolom `debts`;
    - `sisa_pokok bigint` (`pokok_awal − coalesce(Σ porsi_pokok, 0)`), `total_bunga bigint`, `total_bayar bigint`;
    - `jumlah_tagihan int`, `tagihan_lunas int`;
    - `jatuh_tempo_berikutnya date`, `nominal_berikutnya bigint` (tagihan `belum` paling awal);
    - `jatuh_tempo_terakhir date` (tagihan `belum` paling akhir);
    - `bayar_terakhir date`;
    - `grant select … to authenticated`.

- [ ] **Step 1: Tulis tes integrasi yang gagal** (pola `tests/integration/rls.test.ts`):
  - A membuat hutang `berbunga` lewat `insert` → B tidak bisa `select`, `update`, atau `delete`;
  - B tidak bisa insert transaksi atau `debt_schedule` dengan `debt_id` milik A (FK komposit menolak);
  - check per tipe: `cicilan_tetap` dengan `metode` → ditolak; `berbunga` tanpa `metode` → ditolak;
  - `hutang_bayar` tanpa `debt_id` → ditolak oleh constraint;
  - `v_hutang` hanya mengembalikan baris milik sendiri, dengan `sisa_pokok = pokok_awal` untuk hutang tanpa pembayaran;
  - `anon` tidak bisa `select` `debts`.
- [ ] **Step 2:** Tulis migrasi. Jalankan `npx tsc --noEmit` dan `npx jest`; harus PASS (tes integrasi tidak ikut Jest biasa).
- [ ] **Step 3: Commit** `feat(db): tabel hutang, jadwal, dan ringkasan`. Verifikasi integrasi menunggu `db push` oleh Rafli; catat di laporan.

### Task 2: RPC `save_transactions` v3 dan hitung ulang hutang

**Files:**
- Create: `supabase/migrations/20261120000009_hutang_rpc.sql`
- Test: `tests/integration/hutang_rpc.test.ts`, tambah kasus di `tests/integration/save_transactions.test.ts` (item lama gaya Rencana 2 tetap lolos)

**Interfaces:**
- Consumes: tabel Task 1.
- Produces (SQL):
  - **`public.hitung_ulang_hutang(p_debt uuid) returns void`** (`security invoker`):
    - no-op bila hutang tidak ada (misalnya sedang dihapus cascade);
    - `berbunga`: perbarui `porsi_bunga`/`porsi_pokok` semua `hutang_bayar` hutang itu sesuai Global Constraints; `penyesuaian` ikut dihitung dalam sisa berjalan, tetapi porsinya tidak diubah;
    - `cicilan_tetap`: `porsi_bunga = 0`, `porsi_pokok = nominal`;
    - bila sisa berjalan < 0 → `raise exception 'Pembayaran melebihi sisa hutang'`;
    - hitung ulang `debt_schedule.status`/`transaction_id` (Global Constraints);
    - update hanya baris yang berubah.
  - **Trigger `transactions_hutang_aiud`** `after insert or delete or update of tanggal, nominal, debt_id, jenis, porsi_pokok on public.transactions for each row`:
    - panggil `hitung_ulang_hutang` untuk `old.debt_id` dan `new.debt_id` (yang tidak null, tanpa duplikat);
    - trigger tidak terpicu oleh update `porsi_bunga`, dan oleh update `porsi_pokok` yang berasal dari `hitung_ulang_hutang` sendiri (dijaga `pg_trigger_depth() > 1` → return);
    - sebelum menghitung ulang, tolak insert/update `hutang_bayar`/`penyesuaian` ke hutang `diarsip` (`'Hutang sudah diarsipkan'`) dan `penyesuaian` pada `cicilan_tetap` (`'Penyesuaian hanya untuk hutang berbunga'`).
  - **Trigger `debts_hitung_ulang_au`** `after update of pokok_awal, bunga_persen_bulanan, metode on public.debts` → `hitung_ulang_hutang(new.id)`.
  - **`public.save_transactions(items jsonb)` v3** (`create or replace`, signature sama, `security invoker`):
    - **Batas dan validasi lama:** maksimal 50 item (`'Terlalu banyak transaksi sekaligus (maks 50)'`); semua validasi v2 tetap.
    - **Jenis yang diterima:** `hutang_baru`, `hutang_bayar`, dan `penyesuaian` dengan `debt_id`.
    - **`hutang_bayar`:**
      - `debt_id` wajib dan milik pengguna (`'Hutang tidak ditemukan'`);
      - dompet wajib;
      - `kategori` diisi `pemberi` bila kosong;
      - `porsi_*` dari app diabaikan, karena dihitung trigger.
    - **`hutang_baru`:**
      - item membawa `debt_id` (uuid buatan app, stabil antarpercobaan) dan `hutang: { pemberi, tipe, tanggal_mulai, nominal_cicilan?, tenor_bulan?, jatuh_tempo_pertama?, pokok_awal?, bunga_persen_bulanan?, metode?, sisa_pokok_sekarang? }`;
      - RPC `insert into debts … on conflict (id) do nothing`; `cicilan_tetap` → `pokok_awal = nominal_cicilan × tenor_bulan`, dan jadwal dibuat bila hutang baru tersisip;
      - `berbunga` dengan `sisa_pokok_sekarang` < `pokok_awal` → sisipkan juga `penyesuaian` (id = `md5(debt_id || ':awal')::uuid` agar idempoten, tanggal = `tanggal_mulai`, `porsi_pokok = nominal = pokok_awal − sisa_pokok_sekarang`, catatan `'Sudah dibayar sebelum pakai arta'`);
      - `wallet_id` opsional, `kategori` = `pemberi`.
    - **`penyesuaian` dengan `debt_id`:** `wallet_id` harus null, `nominal` ≠ 0, dan `porsi_pokok = nominal`.
    - **Pesan validasi** (Indonesia, P0001): `'Nama pemberi wajib diisi'`, `'Tenor 1–60 bulan'`, `'Nominal cicilan wajib diisi'`, `'Bunga 0–100% per bulan'`, `'Metode bunga flat atau efektif'`, `'Sisa pokok tidak boleh lebih dari pokok awal'`.
    - **Penyisipan:** debts → jadwal → transaksi (`on conflict (id) do nothing`, kolom `debt_id` dan `porsi_pokok` ikut). Semua dalam satu transaksi database; trigger menghitung ulang.
  - **`public.tambah_jadwal(p_debt uuid, p_jatuh_tempo date, p_nominal bigint) returns public.debt_schedule`:** hanya untuk `berbunga`; `on conflict (debt_id, jatuh_tempo) do update set nominal`; lalu hitung ulang.
  - Grant eksekusi hanya untuk `authenticated`; `hitung_ulang_hutang` di-`revoke` dari `public, anon, authenticated` (hanya dipanggil trigger/RPC).

- [ ] **Step 1: Tulis tes integrasi yang gagal:**
  - **Cicilan tetap:** `hutang_baru` Kredivo `cicilan_tetap` 100.000 × 12, jatuh tempo pertama `2026-12-05`, tanpa dompet → `debts.pokok_awal = 1.200.000`, 12 tagihan (`2026-12-05` … `2027-11-05`), saldo dompet tidak berubah.
  - **Simpan ulang:** item dan `debt_id` yang sama dikirim dua kali → tetap 1 hutang, 12 tagihan, 1 transaksi.
  - **Bayar cicilan:** `hutang_bayar` 100.000 → tagihan 1 `lunas` dengan `transaction_id` pembayaran itu, `v_hutang.sisa_pokok = 1.100.000`, `tagihan_lunas = 1`. Bayar 250.000 sekaligus → tagihan 2–3 lunas, tagihan 4 belum.
  - **Bunga flat:** berbunga flat 2%, pokok 1.000.000, bayar 300.000 tanggal `2026-11-10` → bunga 20.000, pokok 280.000. Bayar 100.000 tanggal `2026-11-25` → bunga 0, pokok 100.000. Bayar 50.000 tanggal `2026-12-03` → bunga 20.000, pokok 30.000.
  - **Bunga efektif:** efektif 2%, pokok 1.000.000, bayar 300.000 (Nov) → bunga 20.000. Bayar 300.000 (Des) → bunga `round(720.000 × 0,02)` = 14.400.
  - **Bunga tidak menumpuk:** bayar 10.000 saat bunga 20.000 → `porsi_bunga` 10.000, pokok 0; bulan berikutnya bunga tetap satu kali.
  - **Hapus pembayaran lama:** hapus pembayaran November (`delete` langsung) → pembayaran Desember dihitung ulang menjadi pembayaran pertama di bulannya dengan sisa pokok yang benar.
  - **Ubah tanggal:** ubah `tanggal` pembayaran kedua November ke Oktober → pecahannya dihitung ulang (pembayaran itu kini membawa bunga Oktober).
  - **Lebih bayar:** pembayaran melebihi sisa → error `'Pembayaran melebihi sisa hutang'`, dan tidak ada baris yang tersimpan (atomik).
  - **Hutang yang sudah berjalan:** `berbunga` dengan `sisa_pokok_sekarang` 600.000 dari pokok 1.000.000 → ada `penyesuaian` 400.000, `sisa_pokok = 600.000`, dan bunga flat tetap dari 1.000.000.
  - **Hutang diarsip:** bayar ke hutang `diarsip` → `'Hutang sudah diarsipkan'`.
  - **Penyesuaian cicilan tetap:** `penyesuaian` pada `cicilan_tetap` → ditolak.
  - **Batas item:** 51 item → `'Terlalu banyak transaksi sekaligus (maks 50)'`.
  - **Hapus hutang:** hapus hutang → semua transaksi dan jadwalnya ikut terhapus.
  - **`tambah_jadwal`:** pada berbunga → tagihan tersimpan dan statusnya mengikuti total bayar.
  - **Kompatibilitas Rencana 2:** item gaya Rencana 2 (`pengeluaran`, `sumber: 'ai'`, `transkrip`) tetap tersimpan seperti v2.
- [ ] **Step 2:** Tulis migrasi. Jalankan `npx tsc --noEmit` dan `npx jest`; harus PASS.
- [ ] **Step 3: Commit** `feat(db): simpan dan pecah pembayaran hutang`. Verifikasi integrasi menunggu `db push`.

### Task 3: Logika hutang murni (domain)

**Files:**
- Create: `src/domain/hutang.ts`
- Modify: `src/domain/types.ts` (tambah tipe di bawah), `src/domain/testFactories.ts` (`buatHutang(over)`)
- Test: `src/domain/__tests__/hutang.test.ts`

**Interfaces:**
- Produces:
  - **Tipe:**
    - `type TipeHutang = 'cicilan_tetap' | 'berbunga'`
    - `type MetodeBunga = 'flat' | 'efektif'`
    - `type Hutang = { id; pemberi; tipe: TipeHutang; tanggal_mulai: string; pokok_awal: number; nominal_cicilan: number|null; tenor_bulan: number|null; bunga_persen_bulanan: number|null; metode: MetodeBunga|null; diarsip: boolean; sisa_pokok: number; total_bunga: number; total_bayar: number; jumlah_tagihan: number; tagihan_lunas: number; jatuh_tempo_berikutnya: string|null; nominal_berikutnya: number|null; jatuh_tempo_terakhir: string|null; bayar_terakhir: string|null }` (bentuk baris `v_hutang`)
    - `type Tagihan = { id; debt_id; jatuh_tempo: string; nominal: number; status: 'belum'|'lunas'; transaction_id: string|null }`
  - **`bungaBulanIni(h, sisaSebelum)`:** `number` (flat/efektif, dibulatkan seperti SQL; `cicilan_tetap` → 0).
  - **`pecahPembayaran(h, nominal, sudahBayarBulanIni: boolean)`:** `{ bunga, pokok, lebih: boolean }`, cermin aturan server untuk pratinjau. `lebih` = pokok > `h.sisa_pokok`.
  - **`hariMenuju(tanggal, hariIni)`:** `number` (negatif = lewat). **`labelJatuhTempo(tanggal, hariIni)`:** `'Hari ini' | 'Besok' | 'N hari lagi' | 'Lewat N hari'`.
  - **`perkiraanBebas(h, riwayatPokok: { bulan: string; pokok: number }[], hariIni)`:** `string | null` ('YYYY-MM').
    - Sisa 0 → `null`.
    - Punya tagihan belum lunas → bulan `jatuh_tempo_terakhir`.
    - Selain itu (berbunga tanpa jadwal), dari rata-rata pokok per bulan 3 bulan terakhir yang ada pembayarannya: `ceil(sisa / rata)` bulan dari bulan ini. Belum ada pembayaran → `null`.
  - **`ringkasHutang(list: Hutang[], hariIni)`:**
    - `totalSisa`: Σ `sisa_pokok` hutang tidak diarsip;
    - `totalAwal`;
    - `progres` 0..1: `1 − totalSisa/totalAwal`, dengan `totalAwal` 0 → 0;
    - `berikutnya`: `{ hutang, tanggal, nominal } | null`, yaitu jatuh tempo terdekat dari hutang aktif;
    - `bebasPada`: bulan terakhir dari semua `perkiraanBebas`, atau `null` bila ada hutang bersisa yang tidak bisa diperkirakan.
  - **`labelBulan('2027-11')`:** `'Nov 2027'`.

- [ ] **Step 1: Tulis tes yang gagal:**
  - `bungaBulanIni`: flat 2%/1.000.000 → 20.000; efektif 2% dengan sisa 720.000 → 14.400; 1,5% dengan sisa 333.333 → 5.000 (pembulatan); cicilan → 0.
  - `pecahPembayaran`:
    - 10.000 saat bunga 20.000 → `{bunga:10.000, pokok:0}`;
    - pembayaran kedua di bulan yang sama → bunga 0;
    - melebihi sisa → `lebih: true`.
  - `labelJatuhTempo`:
    - `'2026-11-20'` → `'Hari ini'`;
    - `'2026-11-21'` → `'Besok'`;
    - `'2026-11-23'` → `'3 hari lagi'`;
    - `'2026-11-18'` → `'Lewat 2 hari'`;
    - melewati akhir tahun dan tahun kabisat benar (tanpa `Date` UTC; pola `src/lib/tanggal.ts`).
  - `perkiraanBebas`:
    - cicilan dengan jatuh tempo terakhir `2027-11-05` → `'2027-11'`;
    - berbunga sisa 600.000, pokok/bulan [200.000, 200.000] → 3 bulan dari bulan ini;
    - tanpa riwayat → `null`;
    - lunas → `null`.
  - `ringkasHutang`:
    - hutang diarsip tidak dihitung;
    - `berikutnya` memilih tanggal terdekat;
    - `bebasPada` null bila ada yang tak terperkirakan;
    - daftar kosong → `totalSisa` 0, `progres` 0.
- [ ] **Step 2:** Jalankan `npx jest src/domain`. Harus FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npx jest`, `npx tsc --noEmit`, dan `npx expo lint`. Harus PASS.
- [ ] **Step 5: Commit** `feat(hutang): logika bunga, jatuh tempo, dan perkiraan bebas hutang`

### Task 4: Lapisan data hutang di app

**Files:**
- Create: `src/data/debts.ts`
- Modify: `src/data/transactions.ts`:
  - `NewTx` mendapat `debt_id?: string | null` dan `hutang?: HutangBaru`;
  - `useInvalidate` juga menginvalidasi `['debts']`;
  - tambah `useDebtTransactions(debtId)`.
- Test: `src/data/__tests__/debts.test.tsx`, tambah kasus di `src/data/__tests__/transactions.test.tsx`

**Interfaces:**
- Consumes: kontrak SQL Task 1–2 (supabase di-mock; tidak menunggu `db push`), tipe Task 3. Jika Task 3 belum selesai, salin tipe dari dokumen ini; agen Task 3 adalah pemilik `src/domain/types.ts`.
- Produces:
  - `type HutangBaru = { pemberi: string; tipe: TipeHutang; tanggal_mulai: string; nominal_cicilan?: number; tenor_bulan?: number; jatuh_tempo_pertama?: string; pokok_awal?: number; bunga_persen_bulanan?: number; metode?: MetodeBunga; sisa_pokok_sekarang?: number }`
  - `useDebts({ arsip?: boolean })`: kunci `['debts', 'list', arsip]`, `from('v_hutang')` dengan filter `diarsip`, diurutkan `jatuh_tempo_berikutnya nulls last, created_at`. Angka dari Postgres (`bigint`/`numeric` sebagai string) dikonversi ke `number`.
  - `useDebt(id)`: kunci `['debts', 'one', id]`, `initialData` dari cache daftar.
  - `useDebtSchedule(id)`: kunci `['debts', 'jadwal', id]`, `from('debt_schedule')` diurutkan `jatuh_tempo`.
  - `useDebtTransactions(id)`: kunci `['transactions', 'debt', id]`, transaksi `debt_id = id` (kolom penuh termasuk porsi), terbaru dulu.
  - `useUpdateDebt()`: `update` `pemberi | diarsip | bunga_persen_bulanan | metode | pokok_awal` → invalidasi `['debts']` dan `['transactions']`.
  - `useDeleteDebt()`: `delete` → invalidasi `['debts']`, `['transactions']`, `['wallets']`.
  - `useTambahJadwal()`: `rpc('tambah_jadwal', …)`.
  - Semua galat lewat `toAppError` (aksi `'baca'` untuk query, `'simpan-transaksi'` untuk mutasi). **`errors.ts` tidak diubah.**

- [ ] **Step 1: Tulis tes yang gagal** (pola `transactions.test.tsx`):
  - `useDebts` memetakan baris `{sisa_pokok: '1100000', bunga_persen_bulanan: '2.00'}` menjadi angka;
  - `useDebts({arsip:false})` memanggil `.eq('diarsip', false)`;
  - `useDeleteDebt` menginvalidasi ketiga kunci;
  - `useSaveTransactions` meneruskan `debt_id` dan `hutang` apa adanya;
  - galat P0001 `'Pembayaran melebihi sisa hutang'` → `AppError` `validasi` dengan pesan yang sama.
- [ ] **Step 2:** Jalankan tes terkait. Harus FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npx jest`, `npx tsc --noEmit`, dan `npx expo lint`. Harus PASS.
- [ ] **Step 5: Commit** `feat(hutang): lapisan data hutang dan jadwal`

### Task 5: Tab Hutang dan detail hutang

**Files:**
- Modify: `app/(tabs)/hutang.tsx` (ganti placeholder), `app/_layout.tsx` (daftarkan `hutang/baru`, `hutang/[id]`, `hutang/bayar`, `hutang/sesuaikan` sebagai `presentation: "modal"`; **hanya task ini yang menyentuh file ini**)
- Create: `app/hutang/[id].tsx`, `src/components/KartuHutang.tsx`, `src/components/BarisTagihan.tsx`
- Test: `src/__tests__/screens/hutang.test.tsx`, `src/__tests__/screens/hutang-detail.test.tsx`, `src/components/__tests__/KartuHutang.test.tsx`

**Interfaces:**
- Consumes: `useDebts`, `useDebt`, `useDebtSchedule`, `useDebtTransactions`, `useUpdateDebt`, `useDeleteDebt` (Task 4); `ringkasHutang`, `labelJatuhTempo`, `perkiraanBebas`, `labelBulan` (Task 3); `TxRow`, `KeadaanKosong`, `Tombol`, `Ikon`, `useGulirPulau('hutang')`, `spacerNav`.
- Produces:
  - **`KartuHutang({ hutang, hariIni, onPress })`** mengikuti kit `.debt-card`:
    - baris atas: ikon `nav-hutang` + `pemberi` + badge `labelJatuhTempo` (ikon `status-jatuh-tempo`, `warnInk`); lunas (sisa 0) → badge "Lunas" (`status-lunas`);
    - nominal besar `formatRupiah(sisa_pokok)`;
    - sub cicilan: `'Sisa pokok · {lunas} dari {jumlah} cicilan lunas'`; sub berbunga: `'Sisa pokok · bunga {x}%/bln {flat|efektif}'`.
  - **Tab Hutang** (`ScrollView` + `useGulirPulau`), dari atas:
    1. judul "Hutang" dan tombol "Tambah" → `router.push('/hutang/baru')`;
    2. kartu ringkasan: "Total sisa hutang" `formatRupiah(totalSisa)`, bar progres lunas (`acc`) + `'{n}% lunas'`, dan `'Perkiraan bebas hutang: {labelBulan}'` (atau `'Perkiraan bebas hutang belum bisa dihitung'` bila `bebasPada` null dan ada sisa);
    3. daftar `KartuHutang` yang tidak diarsip → ketuk → `router.push({ pathname: '/hutang/[id]', params: { id } })`;
    4. tautan "Tampilkan yang diarsip (N)" bila ada;
    5. keadaan kosong: `KeadaanKosong` ikon `nav-hutang` `'Belum ada hutang tercatat. Tambahkan paylater atau cicilan kalau ada.'` + `Tombol` primer "Tambah hutang".
  - **Detail `hutang/[id]`** (modal):
    - kepala: pemberi, sisa pokok, info tipe (`'Cicilan Rp100.000 × 12 bulan'` / `'Pokok awal Rp1.000.000 · bunga 2%/bln efektif'`), dan total bunga dibayar (berbunga);
    - tombol primer "Bayar" → `/hutang/bayar?id=`; tombol "Sesuaikan sisa" (berbunga saja) → `/hutang/sesuaikan?id=`;
    - "Jadwal tagihan": daftar `BarisTagihan` (tanggal, nominal, status "Lunas" atau `labelJatuhTempo`). Berbunga tanpa jadwal → teks `'Belum ada jadwal.'` + tombol "Tambah tagihan", yang membuka isian tanggal + nominal → `useTambahJadwal`;
    - "Riwayat pembayaran": `TxRow` + sub `'Bunga RpX · Pokok RpY'` untuk berbunga; ketuk → `/transaksi/[id]` (sudah ada);
    - "Arsipkan" / "Aktifkan lagi";
    - "Hapus hutang" → `Alert` `'Hapus hutang ini? Semua pembayarannya ikut terhapus dan saldo dompet dihitung ulang.'` → `useDeleteDebt` → tutup.

- [ ] **Step 1: Tulis tes yang gagal** (`@/data/debts` dan `expo-router` di-mock):
  - **Tab Hutang:**
    - 2 hutang (Kredivo cicilan sisa 1.100.000, jatuh tempo 3 hari lagi; Pinjaman Andi berbunga sisa 600.000) → `'Rp1.700.000'`, `'3 hari lagi'`, `'Sisa pokok · 1 dari 12 cicilan lunas'`;
    - daftar kosong → teks keadaan kosong + tombol → `router.push('/hutang/baru')`;
    - galat → pesan galat;
    - hutang diarsip tidak tampil di daftar utama.
  - **`KartuHutang`:** sisa 0 → `'Lunas'`.
  - **Detail:**
    - jadwal 12 baris dengan 1 `'Lunas'`;
    - "Bayar" → push `/hutang/bayar`;
    - "Sesuaikan sisa" tidak tampil untuk cicilan;
    - hapus → konfirmasi → `useDeleteDebt` dipanggil;
    - riwayat menampilkan `'Bunga Rp20.000 · Pokok Rp280.000'`.
- [ ] **Step 2:** Jalankan tes terkait. Harus FAIL.
- [ ] **Step 3:** Implementasi. Untuk API Expo Router (`Stack.Screen` modal, `useLocalSearchParams`, `router.push` dengan `pathname`/`params`), cek dokumentasi SDK 58 dan pola `app/dompet/[id].tsx` yang sudah ada.
- [ ] **Step 4:** Jalankan `npx jest`, `npx tsc --noEmit`, dan `npx expo lint`. Harus PASS.
- [ ] **Step 5: Commit** `feat(hutang): tab hutang dan detail jadwal`

### Task 6: Form tambah hutang, bayar, dan sesuaikan sisa

**Files:**
- Create: `app/hutang/baru.tsx`, `app/hutang/bayar.tsx`, `app/hutang/sesuaikan.tsx`, `src/components/FormHutang.tsx`
- Test: `src/__tests__/screens/hutang-baru.test.tsx`, `src/__tests__/screens/hutang-bayar.test.tsx`, `src/__tests__/screens/hutang-sesuaikan.test.tsx`

**Interfaces:**
- Consumes: `useSaveTransactions`, `newTxId` (Task 4 / sudah ada); `useDebt`, `useDebtTransactions` (Task 4); `pecahPembayaran`, `bungaBulanIni` (Task 3); `AmountInput`, `Chip`, `Tombol`, `useWallets`, `hariIni`, `tanggalValid`. Rute modal didaftarkan oleh Task 5. Jika Task 5 belum merge, tes layar tetap berjalan karena merender komponen layar langsung.
- Produces:
  - **`hutang/baru`:**
    - **Isian:**
      - pemberi (teks, maks 60);
      - tipe chip "Cicilan tetap" (bawaan) / "Berbunga";
      - **cicilan:** nominal cicilan, sisa tenor (bulan, 1–60), jatuh tempo berikutnya (YYYY-MM-DD, bawaan +1 bulan dari hari ini), dan teks bantu `'Total Rp1.200.000'`;
      - **berbunga:** pokok awal, bunga %/bulan (`keyboardType="decimal-pad"`, koma atau titik), metode chip "Efektif" (bawaan) / "Flat", toggle "Sudah berjalan" → isian sisa pokok sekarang;
      - "Uangnya masuk ke dompet?": chip dompet aktif + chip "Tidak masuk dompet" (bawaan untuk cicilan; untuk berbunga wajib pilih salah satu), lalu nominal dana masuk (bawaan = pokok awal untuk berbunga, = total untuk cicilan; bisa diubah);
      - tanggal mulai (bawaan hari ini); catatan.
    - **Simpan:**
      - satu item `{ id: txId, tanggal: tanggal_mulai, jenis: 'hutang_baru', kategori: pemberi, nominal: danaMasuk, wallet_id, wallet_tujuan_id: null, debt_id, hutang: {...}, catatan, transkrip: null, sumber: 'manual' }`;
      - `txId` dan `debt_id` dibuat sekali saat layar dibuka dan dipakai ulang setiap percobaan;
      - sukses → `router.replace({ pathname: '/hutang/[id]', params: { id: debt_id } })`.
    - **Validasi di app:** Simpan nonaktif sampai isian wajib valid; sisa pokok > pokok awal → `'Sisa pokok tidak boleh lebih dari pokok awal'`.
  - **`hutang/bayar?id=`:**
    - **Isian:**
      - nominal, bawaan `nominal_berikutnya` bila ada; berbunga tanpa jadwal → kosong;
      - dompet (chip dompet aktif, wajib), tanggal (bawaan hari ini), catatan.
    - **Pratinjau berbunga:** `'Bunga RpX · Pokok RpY'` dari `pecahPembayaran`. `sudahBayarBulanIni` dihitung dari `useDebtTransactions`: ada `hutang_bayar` di bulan `tanggal` yang dipilih.
    - **Lebih bayar:** `lebih` → peringatan `'Melebihi sisa hutang (RpZ)'` dan Simpan nonaktif.
    - **Simpan:**
      - item `{ id, tanggal, jenis: 'hutang_bayar', kategori: pemberi, nominal, wallet_id, wallet_tujuan_id: null, debt_id, catatan, transkrip: null, sumber: 'manual' }`;
      - id stabil, sukses → tutup;
      - galat server (misalnya hutang diarsip) → pesan, dan isian tetap.
  - **`hutang/sesuaikan?id=`** (berbunga):
    - isian "Sisa pokok sebenarnya" dan tampilan `'Rp600.000 → Rp550.000'`;
    - Simpan → item `penyesuaian` `{ debt_id, wallet_id: null, nominal: sisaLama − sisaBaru, kategori: 'penyesuaian', catatan: 'Sesuaikan sisa hutang' }`;
    - selisih 0 → `'Sudah sama'` dan Simpan nonaktif.

- [ ] **Step 1: Tulis tes yang gagal:**
  - **`hutang/baru`:**
    - cicilan "Kredivo" 100.000 × 12 → teks `'Total Rp1.200.000'`;
    - Simpan → `save_transactions` dipanggil sekali dengan `hutang.tipe 'cicilan_tetap'`, `tenor_bulan 12`, `wallet_id null`;
    - Simpan dua kali cepat → tetap satu panggilan;
    - gagal lalu coba lagi → `id` dan `debt_id` sama;
    - berbunga tanpa memilih dompet/"Tidak masuk dompet" → Simpan nonaktif;
    - bunga `'2,5'` → `bunga_persen_bulanan 2.5`;
    - "Sudah berjalan" dengan sisa > pokok → pesan galat dan Simpan nonaktif.
  - **`hutang/bayar`:**
    - cicilan → nominal bawaan `'Rp100.000'`;
    - berbunga flat 2%/1.000.000, belum bayar bulan ini, isi 300.000 → `'Bunga Rp20.000 · Pokok Rp280.000'`;
    - sudah ada pembayaran bulan ini → `'Bunga Rp0 · Pokok Rp300.000'`;
    - lebih → peringatan dan Simpan nonaktif;
    - tanpa dompet → Simpan nonaktif;
    - Simpan → item `hutang_bayar` dengan `debt_id`.
  - **`hutang/sesuaikan`:**
    - sisa 600.000 → 550.000 → item `penyesuaian` `nominal 50000`, `wallet_id null`;
    - 600.000 → 650.000 → `nominal -50000`;
    - sama → `'Sudah sama'`.
- [ ] **Step 2:** Jalankan tes terkait. Harus FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npx jest`, `npx tsc --noEmit`, dan `npx expo lint`. Harus PASS.
- [ ] **Step 5: Commit** `feat(hutang): form tambah, bayar, dan sesuaikan hutang`

### Task 7: Kartu hutang di Beranda dan tampilan transaksi hutang

**Files:**
- Modify: `app/(tabs)/index.tsx`, `src/components/TxRow.tsx`, `src/components/TxForm.tsx` (teks kunci saja)
- Test: ubah `src/__tests__/screens/beranda.test.tsx` dan `src/components/__tests__/TxRow.test.tsx`

**Interfaces:**
- Consumes: `useDebts({ arsip: false })`, `ringkasHutang`, `labelJatuhTempo`, `labelBulan` (Task 3–4); `kekayaanBersih(saldo, totalHutang)` (sudah ada).
- Produces:
  - **Beranda:**
    - `HeroCard` menerima `kekayaan = kekayaanBersih(saldo, ringkas.totalSisa)`. Bila `useDebts` masih memuat atau gagal, pakai 0 dan beri tanda: teks kekayaan `'Kekayaan bersih …'` tetap tampil, dan galat hutang tidak memblokir Beranda.
    - Di bawah "Bulan ini" tampil kartu hutang (pola `.debt-card`) bila ada hutang bersisa:
      - judul "Hutang";
      - `'{pemberi} · {formatRupiah(nominal)}'` dan badge `labelJatuhTempo` untuk jatuh tempo berikutnya;
      - `'Sisa {formatRupiah(totalSisa)} · bebas hutang {labelBulan}'` (atau tanpa bagian bebas bila null).
    - Ketuk kartu → `router.navigate('/hutang')`. Tanpa hutang → kartu tidak tampil.
  - **`TxRow`:**
    - jenis `hutang_*` memakai ikon `nav-hutang`;
    - `hutang_baru` tanpa dompet tidak diberi tanda `+`;
    - `penyesuaian` dengan `debt_id` menampilkan meta `'Sisa hutang'` dan nominal tanpa tanda.
  - **`TxForm`:** teks kunci untuk `hutang_*` menjadi `'Transaksi hutang · hanya tanggal dan catatan yang dapat diubah. Ubah hutangnya dari tab Hutang.'`. Perilakunya tetap sama, dan perubahan tanggal dihitung ulang oleh trigger.

- [ ] **Step 1: Tulis tes yang gagal:**
  - **Beranda:**
    - wallets total 288.000 + hutang sisa 1.100.000 → `'Kekayaan bersih -Rp812.000'`, `'Kredivo · Rp100.000'`, `'3 hari lagi'`;
    - tanpa hutang → kartu hutang tidak ada;
    - `useDebts` galat → Beranda tetap menampilkan sisa uang.
  - **`TxRow`:**
    - `hutang_bayar` kategori `'Kredivo'` → `'-Rp100.000'`;
    - `hutang_baru` `wallet_id null` → `'Rp1.200.000'` tanpa tanda.
- [ ] **Step 2:** Jalankan tes terkait. Harus FAIL.
- [ ] **Step 3:** Implementasi. Cek dulu format negatif `formatRupiah`; jika belum mendukung minus, tambahkan di `src/domain/money.ts` beserta tesnya.
- [ ] **Step 4:** Jalankan `npx jest`, `npx tsc --noEmit`, dan `npx expo lint`. Harus PASS.
- [ ] **Step 5: Commit** `feat(hutang): kartu hutang di beranda dan kekayaan bersih`

### Task 8: Panduan deploy dan uji Rencana 3

**Files:**
- Create: `docs/uji-manual-rencana-3.md`

- [ ] **Step 1:** Tulis langkah untuk Rafli:
  1. `npx supabase db push --remote`.
  2. `npm run test:integration`.
  3. `npx expo start --dev-client`. APK dev **tidak perlu** dibangun ulang (tanpa paket native baru).
- [ ] **Step 2:** Daftar uji (centang):
  - tambah Kredivo cicilan 100rb × 12 tanpa dompet → saldo dompet tetap, kekayaan bersih turun 1,2 jt, kartu Beranda menampilkan jatuh tempo;
  - bayar cicilan dari GoPay → GoPay −100rb, "1 dari 12 cicilan lunas";
  - tambah pinjaman Andi berbunga efektif 2%, pokok 1 jt masuk Cash → Cash +1 jt;
  - bayar 300rb → pratinjau dan hasil "Bunga Rp20.000 · Pokok Rp280.000";
  - bayar lagi bulan yang sama → bunga 0;
  - hapus pembayaran pertama dari Riwayat → pecahan pembayaran kedua berubah;
  - sesuaikan sisa;
  - arsipkan hutang lunas;
  - hapus hutang → saldo kembali;
  - mode pesawat saat bayar → pesan offline, tidak tersimpan dobel setelah coba lagi.
- [ ] **Step 3:** Bagian "Ditunda dari Rencana 3":
  - pengingat push (Rencana 5);
  - tambah hutang di onboarding;
  - draf AI hutang dan koreksi sisa hutang lewat suara (Task 9);
  - ubah tenor/nominal cicilan setelah dibuat (sekarang: hapus lalu buat ulang);
  - laporan email status hutang (Rencana 6).
- [ ] **Step 4:** Jalankan `npx jest`, `npx tsc --noEmit`, dan `npx expo lint`. Harus PASS.
- [ ] **Step 5: Commit** `docs: panduan deploy dan uji rencana 3`

### Task 9 (DIBLOKIR — menunggu Rencana 2 di `main`): Draf AI untuk hutang

> Jangan mulai sebelum branch `rencana-2` (termasuk layar `rekam` dan `cek`) di-merge ke `main`. Detail antarmuka harus dicocokkan ulang dengan kode Rencana 2 yang sudah final, bukan ditebak dari dokumen ini.

**Files (perkiraan):** `supabase/functions/_shared/parsing.ts`, `supabase/functions/_shared/handler.ts` (konteks + daftar hutang), `src/ai/tipe.ts`, `app/cek.tsx`, `src/components/EditorDraf.tsx`, beserta tesnya.

**Garis besar:**
- `Konteks` mendapat `hutang: { id; pemberi; tipe }[]` dari `v_hutang` yang tidak diarsip. `buatPrompt` mencantumkan nama pemberi.
- **`hutang_bayar`:** cocokkan `kategori` (nama pemberi) ke hutang dengan aturan seperti `cocokkanDompet`. Cocok → draf `hutang_bayar` + `debt_id`; tidak cocok → peringatan `'Hutang "X" belum ada, pilih hutang'`, dan Simpan nonaktif sampai dipilih.
- **`hutang_baru`:** draf dengan isian tambahan di "Cek dulu" (tipe bawaan `cicilan_tetap` tanpa bunga, tenor/nominal cicilan), sesuai `docs/spec.md` §5.5.
- **Koreksi sisa hutang** ("sisa hutang kredivo 1,2jt"), hanya untuk hutang berbunga → draf koreksi "sebelum → sesudah" → item `penyesuaian` dengan `debt_id` (§5.7).
- `tidakDidukung` untuk hutang dihapus.
- **Commit:** `feat(ai): draf hutang dari catat suara`.
