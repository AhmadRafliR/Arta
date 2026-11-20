# Rencana 4: Budget, dana darurat, investasi, laporan email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pengguna memasang budget bulanan per kategori pengeluaran dan melihat progresnya (aman / ≥80% / lewat), termasuk peringatan saat mencatat dan kategori paling kritis di Beranda. Pengguna mengelola dana darurat (target, setor, tarik, cukup untuk berapa bulan) dan investasi (nilai, modal, untung, beli/jual, update nilai). Pengguna Pro bisa menambah maksimal 3 penerima laporan yang harus diverifikasi lewat email, mengirim laporan bulanan bergaya invoice sekarang juga, dan menerima laporan otomatis setiap tanggal 1.

**Architecture:**
- **Server (Postgres):**
  - tabel `budgets` (RLS biasa);
  - tabel `report_recipients` (pengguna hanya boleh menyisipkan kolom `email` dan menghapus; kolom `terverifikasi` hanya bisa diubah service role) dan `report_log` (hanya dibaca pengguna);
  - fungsi `security definer` kecil untuk batas laju: `mulai_kirim_laporan`, `selesai_kirim_laporan`, `tandai_verifikasi_dikirim`.
- **Logika murni app** (`src/domain/budget.ts`, `danaDarurat.ts`, `investasi.ts`) dites tanpa server.
- **Edge Function** (Deno, tipis) dengan logika di `supabase/functions/_shared/laporan/` (tanpa API Deno, dependensi disuntikkan, dites Jest):
  - `report-send` (token pengguna): `aksi: 'kirim'` membangun dan mengirim laporan ke penerima terverifikasi; `aksi: 'verifikasi'` mengirim email verifikasi ke satu penerima.
  - `report-verify` (publik, `verify_jwt = false`): tautan dari email. `GET` menampilkan halaman konfirmasi, `POST` memverifikasi atau berhenti berlangganan. Token bertanda tangan HMAC, jadi tidak perlu tabel token.
  - `report-monthly` (dipanggil `pg_cron` tiap jam, dilindungi header `x-cron-secret`): kirim laporan bulan lalu untuk pengguna Pro yang waktunya sudah lewat tanggal 1 pukul 08.00 di zona waktunya.
- **Email** lewat adapter `PengirimEmail`. Bawaan `EMAIL_MODE=log`: hanya mencatat metadata ke log, **tidak mengirim apa pun**. Adapter Resend hanya aktif bila `EMAIL_MODE=resend` dan `RESEND_API_KEY` diisi Rafli sendiri. Tes memakai adapter memori.
- **App:** layar `budget`, `budget/ubah`, `dana-darurat`, `investasi`, `investasi/nilai`, `pindah-dana`, `laporan`; kartu budget kritis di Beranda; peringatan budget di form catat; menu di Akun.

**Tech Stack:** Expo SDK 58 + Expo Router, Supabase JS (`from`, `rpc`, `functions.invoke`), TanStack Query, NativeWind. **Tidak ada dependensi baru**, jadi `package.json`, `package-lock.json`, dan APK dev tidak berubah. Edge Function: Deno + `npm:@supabase/supabase-js@2`, WebCrypto HMAC, Resend REST (opsional). Tes: Jest + RNTL v14, tes integrasi DB (`npm run test:integration`, menunggu `db push`).

**Spec:** `docs/spec.md` §1 (USP 3), §5.1 (laporan = Pro, maks 3 penerima), §5.3 layar 1 (kategori budget paling kritis, kekayaan bersih) dan 6 (budget, dana darurat, investasi, laporan & penerima), §5.4 (`report-send`, `report-monthly`, `pg_cron` tgl 1 pukul 08.00 zona pengguna, Resend), §5.5 (`budgets`, `report_recipients`, dompet tipe `darurat`/`investasi`, setor/beli = `transfer`, update nilai = `penyesuaian`), §5.6 (peringatan budget ≥80%/lewat, isi laporan), §5.8 (penerima wajib terverifikasi). Acuan visual: `docs/design/arta/kit.html` (bar progres budget + ikon `status-budget-aman|waspada|lewat`, ikon `wallet-darurat`/`wallet-investasi`, ilustrasi `laporan`).

## Keputusan Claude (dicatat karena pengguna menyerahkan semua keputusan)

1. **Budget per kategori pengeluaran, batas tetap tiap bulan.** Satu baris per kategori (`unique (user_id, lower(kategori))`). Pencocokan kategori transaksi ↔ budget tanpa peduli huruf besar dan spasi tepi. Layar Budget hanya menampilkan bulan berjalan.
2. **Ambang status:** `persen = terpakai / batas`. `aman` < 80%, `waspada` 80%–100% (termasuk tepat 100%), `lewat` bila `terpakai > batas`. Pengeluaran yang terpakai hanya `jenis = 'pengeluaran'` di bulan itu (transfer, penyesuaian, hutang tidak dihitung).
3. **Peringatan budget tidak memblokir simpan.** Muncul di form catat (pengeluaran) bila setelah transaksi ini status kategori menjadi `waspada` atau `lewat`. Integrasi ke layar "Cek dulu" Rencana 2 ditunda sampai Rencana 2 di-merge; fungsi murni `peringatanBudget` sudah menerima banyak item sekaligus.
4. **Dana darurat dan investasi tetap dompet bertipe khusus** (spec §5.5). Setor/tarik dan beli/jual = `transfer` antar dompet lewat RPC `save_transactions` yang sudah ada. Update nilai investasi = `penyesuaian` sebesar selisih (`adjustmentFor`). Tidak ada tabel baru.
5. **Modal investasi** = `saldo_awal + Σ transfer masuk − Σ transfer keluar + Σ hutang_baru − Σ hutang_bayar` di dompet itu. **Untung** = nilai sekarang − modal (mencakup update nilai, pemasukan seperti dividen, dan pengeluaran seperti biaya). Persen untung hanya ditampilkan bila modal > 0. Tidak ada perhitungan harga rata-rata atau unit; menjual mengurangi modal sebesar nilai jual.
6. **Cakupan dana darurat** = total saldo dompet darurat ÷ rata-rata pengeluaran 3 bulan kalender penuh terakhir (bulan yang tidak punya pengeluaran sama sekali tidak ikut dirata-rata). Tidak ditampilkan bila tidak ada data pengeluaran.
7. **Laporan seluruhnya fitur Pro**, termasuk mengelola penerima, agar email verifikasi tidak bisa dipakai menyepam. Status Pro dibaca dari `useKuotaAi().data.pro` (Rencana 2) di app dan dari `entitlements` di server. Non-Pro melihat penjelasan + badge Pro + "Pro segera hadir" (paywall asli di Rencana 5).
8. **Verifikasi penerima dengan token HMAC** (`LAPORAN_SECRET`), bukan tabel token: `tujuan.recipientId.exp.sig`, `sig = HMAC-SHA256(secret, tujuan.recipientId.email.exp)` base64url. Verifikasi berlaku 7 hari; tautan berhenti berlangganan 400 hari. `GET` hanya menampilkan halaman dengan tombol (supaya pemindai tautan email tidak memverifikasi otomatis); `POST` yang bertindak. Berhenti berlangganan = baris penerima dihapus.
9. **Batas laju:** kirim laporan manual maks 3 kali per 24 jam (yang tidak gagal); email verifikasi ke penerima yang sama maks sekali per 10 menit. Keduanya dijaga fungsi `security definer` yang hanya bisa membatasi pemanggilnya sendiri.
10. **Isi "Kirim sekarang"**: bulan berjalan sampai hari ini (bawaan) atau bulan lalu (pilihan di layar). Laporan otomatis selalu untuk bulan lalu.
11. **Jadwal otomatis:** `report-monthly` dijalankan tiap jam. Pengguna ikut bila Pro aktif, punya ≥1 penerima terverifikasi, tanggal lokal antara 1 dan 7 dan (bila tanggal 1) jam lokal ≥ 8, dan belum ada `report_log` `bulanan` untuk bulan itu. Baris log disisipkan lebih dulu (indeks unik) agar dua eksekusi bersamaan tidak mengirim dobel. SQL `cron.schedule` **tidak** dijadikan migrasi (butuh URL project dan rahasia); disimpan di `supabase/sql/jadwal-laporan.sql` untuk dijalankan Rafli sendiri.
12. **"Sisa uang" di laporan** mengikuti spec §5.6 (= total semua dompet di akhir bulan), diberi label "Total saldo semua dompet" supaya tidak tertukar dengan "Sisa uang" di Beranda (hanya dompet harian).
13. **Hutang di laporan** dibaca dari view `v_hutang` (Rencana 3) bila ada; bila view belum ada (Rencana 3 belum di-merge) bagian hutang dilewati tanpa galat dan total hutang = 0. Status hutang adalah kondisi saat laporan dibuat, bukan per akhir bulan.
14. **Satu email per penerima**, supaya setiap penerima mendapat tautan berhenti berlangganan miliknya sendiri (header `List-Unsubscribe` juga diisi).
15. **Layar baru tidak didaftarkan di `app/_layout.tsx`** (Rencana 2 dan 3 sama-sama mengubah blok `<Stack>`); layar dibuka sebagai halaman stack biasa dengan tombol "Kembali"/"Batal" sendiri. Ini menghindari konflik merge.

## Global Constraints

- Uang = bilangan bulat rupiah (`bigint` di Postgres, `number` di TS). Format tampilan `formatRupiah` (`Rp1.200.000`, `-Rp49.000`).
- **Nomor migrasi mulai `20261120000020`** (000006–000019 milik Rencana 2/3, 000040+ milik Rencana 5): `…0020_budget.sql`, `…0021_laporan.sql`.
- Semua tabel milik pengguna: `user_id uuid not null default auth.uid() references auth.users on delete cascade`, RLS `user_id = (select auth.uid())`, `GRANT` eksplisit (konvensi `20261119000002_grants.sql`), `revoke … from anon, public`. Fungsi: `set search_path = ''`.
- Edge Function memakai **token pengguna** (RLS berlaku). Service role hanya di `report-verify` (tautan publik, setara webhook) dan `report-monthly` (job terjadwal), sesuai spec §5.8.
- **Tidak pernah mengirim email sungguhan** dalam tes atau secara bawaan. Kunci (`RESEND_API_KEY`, `LAPORAN_SECRET`, `LAPORAN_CRON_SECRET`) hanya di secret Edge Function, diisi Rafli sendiri; tidak ada di app atau repo.
- Logika `_shared/laporan/*` **tanpa import selain file relatif `.ts`** di `_shared` (Deno dan Jest sama-sama memakainya). Tidak mengimpor dari `src/` (Deno butuh ekstensi file dan tidak mengenal alias `@/`).
- **Gaya:** teks UI bahasa Indonesia; setiap `<Text`/`<TextInput` wajib `font-sans` (dijaga `src/__tests__/font.test.ts`); aksen `acc` hanya untuk tombol utama dan bar progres; status `waspada` memakai `warn`/`warnInk`, `lewat` memakai `danger`/`dangerInk`; status tidak bergantung pada warna saja (ikon `status-budget-*` + teks). Ikuti token di `src/theme/tokens.ts` dan komponen yang ada (`Tombol`, `Chip`, `AmountInput`, `KeadaanKosong`, `Ikon`, `BadgeTier`).
- Jangan reformat file yang bukan milik rencana ini; perubahan pada file bersama (`app/(tabs)/index.tsx`, `app/(tabs)/akun.tsx`, `src/components/TxForm.tsx`, `app/dompet/baru.tsx`, `supabase/config.toml`) dibatasi pada hunk kecil yang disebut di task.
- **Sebelum setiap commit:** `npx jest`, `npx tsc --noEmit`, `npx expo lint`. Migrasi di-push oleh Rafli (`npx supabase db push --remote`); tes integrasi dijalankan setelah push. Edge Function di-deploy oleh Rafli.

## Titik bentrok dengan rencana lain

| File | Rencana lain | Rencana 4 | Penanganan |
|---|---|---|---|
| `supabase/migrations/` | R2: 0006–0007; R3: 0008+; R5: 0040+ | 0020, 0021 | Tidak tumpang tindih. |
| `app/_layout.tsx` | R2 dan R3 mendaftarkan modal | **tidak diubah** | Keputusan 15. |
| `app/(tabs)/index.tsx` | R3 menambah kartu hutang + kekayaan bersih; sesi desain merombak UI | satu import + satu elemen `<KartuBudgetKritis … />` di bawah kartu "Bulan ini" | Saat merge ambil kedua sisi. |
| `app/(tabs)/akun.tsx` | R5 (langganan, ekspor, hapus akun); sesi desain | satu import + satu blok `<MenuRencana />` sebelum "Tampilan" | Menu ada di komponen terpisah `src/components/MenuRencana.tsx`. |
| `src/components/TxForm.tsx` | R3 mengubah teks kunci hutang | satu import + satu elemen `<PeringatanBudget … />` di atas tombol Simpan | Hunk berbeda. |
| `app/dompet/baru.tsx` | — | membaca param `tipe` awal (`useLocalSearchParams`) | Hunk kecil. |
| `supabase/config.toml` | R5 mungkin menambah `[functions.revenuecat-webhook]` | menambah `[functions.report-verify]` dan `[functions.report-monthly]` `verify_jwt = false` di akhir file | Tambahan di akhir file. |
| `src/data/ai.ts` (`useKuotaAi`) | milik R2; R5 bisa menggantinya dengan hook status Pro | hanya dipakai (dibaca) | Saat R5 merge, ganti pemanggilan di `app/laporan.tsx`. |
| `app/cek.tsx` | milik R2 (belum ada di branch ini) | tidak disentuh | Tindak lanjut: pasang `PeringatanBudget` untuk banyak draf. |

## Pembagian kerja paralel

- **Gelombang A** (empat subagent paralel, file tidak beririsan): Task 1 (migrasi + tes integrasi), Task 2 (domain murni app), Task 3 (lapisan data app; supabase di-mock, kontrak dari dokumen ini), Task 4 (inti laporan murni di `_shared/laporan`).
- **Gelombang B** (empat subagent paralel setelah A): Task 5 (handler + Edge Function, butuh Task 4), Task 6 (UI budget + Beranda + TxForm), Task 7 (UI dana darurat + investasi + pindah dana + `dompet/baru`), Task 8 (UI laporan + menu Akun).
- **Penutup:** Task 9 (panduan uji + tindak lanjut), lalu review akhir (lint, tsc, jest).

## Review Focus

1. **Penerima belum terverifikasi tidak pernah menerima laporan**, dan pengguna tidak bisa menandai sendiri `terverifikasi = true` (insert/update kolom ditolak). Tes di Task 1 dan Task 5.
2. **Laporan bulanan tidak terkirim dobel** walau `report-monthly` berjalan dua kali bersamaan atau diulang (indeks unik `report_log`). Tes di Task 1 dan Task 5.
3. **Batas 80% dan lewat** benar di tepi: 79,9% aman, 80% waspada, 100% waspada, 100% + Rp1 lewat. Tes di Task 2.
4. **Token verifikasi palsu, kedaluwarsa, atau milik email lain** ditolak; `GET` tidak mengubah apa pun. Tes di Task 4 dan Task 5.
5. **Tidak ada email sungguhan** dalam tes maupun dalam mode bawaan (`EMAIL_MODE` tidak diisi → adapter log). Tes di Task 4 dan Task 5.
6. **Setor/beli tersimpan sekali** walau Simpan ditekan dua kali atau dicoba ulang (id transaksi stabil). Tes di Task 7.

---

### Task 1: Skema budget dan laporan

**Files:**
- Create: `supabase/migrations/20261120000020_budget.sql`, `supabase/migrations/20261120000021_laporan.sql`
- Test: `tests/integration/budget.test.ts`, `tests/integration/laporan.test.ts`

**Interfaces:**
- `public.budgets (id uuid pk default gen_random_uuid(), user_id …, kategori text not null check (btrim(kategori) <> '' and length(kategori) <= 50), batas_bulanan bigint not null check (batas_bulanan > 0 and batas_bulanan <= 1000000000000), created_at timestamptz not null default now())` + `create unique index budgets_user_kategori_unik on public.budgets (user_id, lower(btrim(kategori)))`. RLS select/insert/update/delete milik sendiri; `grant select, insert, update, delete … to authenticated`.
- `public.report_recipients (id uuid pk default gen_random_uuid(), user_id …, email text not null check (email = lower(btrim(email)) and length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'), terverifikasi boolean not null default false, diverifikasi_pada timestamptz, verifikasi_dikirim_pada timestamptz, created_at timestamptz not null default now(), unique (user_id, email))`.
  - Trigger `before insert` (fungsi `security definer`): `pg_advisory_xact_lock(hashtext('penerima:' || new.user_id))`, lalu bila sudah ada 3 baris → `raise exception 'Maksimal 3 penerima laporan'`. Juga paksa `new.terverifikasi := false; new.diverifikasi_pada := null; new.verifikasi_dikirim_pada := null` kecuali `current_user` adalah `service_role`/`postgres` (lapis kedua selain grant kolom).
  - RLS: select, insert (with check milik sendiri), delete milik sendiri. **Tidak ada policy update.**
  - Grant: `grant select, delete on public.report_recipients to authenticated; grant insert (email) on public.report_recipients to authenticated; grant all … to service_role`.
- `public.report_log (id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, bulan text not null check (bulan ~ '^\d{4}-\d{2}$'), jenis text not null check (jenis in ('bulanan','manual')), status text not null default 'proses' check (status in ('proses','terkirim','gagal')), jumlah_penerima int not null default 0, created_at timestamptz not null default now())` + `create unique index report_log_bulanan_unik on public.report_log (user_id, bulan) where jenis = 'bulanan'`. RLS select milik sendiri; `grant select … to authenticated`; `grant all … to service_role`.
- Fungsi (`security definer`, `set search_path = ''`, `revoke execute … from public, anon`, `grant execute … to authenticated`, memakai `auth.uid()`, `raise exception 'Tidak terautentikasi'` bila null):
  - `public.mulai_kirim_laporan(p_bulan text) returns uuid`: validasi format bulan (`'Bulan tidak valid'`); kunci advisory per pengguna; bila jumlah `report_log` `jenis='manual'` milik pengguna dengan `created_at > now() - interval '24 hours'` dan `status <> 'gagal'` ≥ 3 → `raise exception 'Batas kirim laporan 3 kali per hari'`; selain itu sisipkan baris `manual`/`proses` dan kembalikan id.
  - `public.selesai_kirim_laporan(p_id uuid, p_status text, p_jumlah int) returns void`: `p_status in ('terkirim','gagal')`; update hanya baris milik pengguna yang masih `proses`.
  - `public.tandai_verifikasi_dikirim(p_recipient uuid) returns boolean`: baris harus milik pengguna (`'Penerima tidak ditemukan'`), dan belum terverifikasi (`'Penerima sudah terverifikasi'`); bila `verifikasi_dikirim_pada > now() - interval '10 minutes'` → `false`; selain itu set `now()` dan `true`.

- [ ] **Step 1: Tulis tes integrasi yang gagal** (pola `tests/integration/rls.test.ts` dan `kuota_ai.test.ts`, helper `createTestUser`, `cleanupUsers`):
  - budget: insert `makan` 800000 → terbaca; insert `Makan ` lagi → ditolak (unik); `batas_bulanan` 0 → ditolak; B tidak bisa membaca/mengubah/menghapus budget A; `anon` tidak bisa select.
  - penerima: insert `ortu@example.com` → `terverifikasi` false; insert dengan `terverifikasi: true` → ditolak (privilege kolom); `update` apa pun → ditolak/0 baris; insert ke-4 → `Maksimal 3 penerima laporan`; email `bukan-email` atau `A@Example.com` → ditolak; B tidak bisa membaca penerima A; delete milik sendiri berhasil.
  - log: `mulai_kirim_laporan('2026-11')` 3× → 3 id; ke-4 → `Batas kirim laporan 3 kali per hari`; setelah `selesai_kirim_laporan(id,'gagal',0)` pada salah satunya → boleh lagi; insert langsung ke `report_log` oleh `authenticated` → ditolak; service role: dua insert `bulanan` bulan sama → yang kedua melanggar unik.
  - `tandai_verifikasi_dikirim`: pertama `true`, langsung kedua `false`; id penerima milik B → `Penerima tidak ditemukan`; `anon` tidak bisa memanggil.
- [ ] **Step 2:** Tulis kedua migrasi. Jalankan `npx tsc --noEmit` dan `npx jest`; harus PASS (tes integrasi tidak ikut Jest biasa).
- [ ] **Step 3: Commit** `feat(db): tabel budget, penerima laporan, dan log laporan`. Verifikasi integrasi menunggu `db push` oleh Rafli.

### Task 2: Domain budget, dana darurat, investasi (fungsi murni)

**Files:**
- Create: `src/domain/budget.ts`, `src/domain/danaDarurat.ts`, `src/domain/investasi.ts`
- Test: `src/domain/__tests__/budget.test.ts`, `danaDarurat.test.ts`, `investasi.test.ts` (pakai `src/domain/testFactories.ts` bila cocok; jangan ubah fabrik yang ada, boleh tambah file fabrik lokal di tes)

**Interfaces:**
- `budget.ts`:
  - `type Budget = { id: string; kategori: string; batas_bulanan: number }`
  - `type StatusBudget = 'aman' | 'waspada' | 'lewat'`
  - `statusBudget(terpakai: number, batas: number): StatusBudget` (keputusan 2)
  - `type PemakaianBudget = { id: string; kategori: string; batas: number; terpakai: number; sisa: number /* batas − terpakai, bisa negatif */; persen: number /* 0..∞, bilangan bulat dibulatkan ke bawah */; status: StatusBudget }`
  - `pemakaianBudget(budgets: Budget[], txs: Pick<Tx,'tanggal'|'jenis'|'kategori'|'nominal'>[], bulan: string): PemakaianBudget[]` → urut `persen` menurun, lalu nama kategori.
  - `kategoriKritis(p: PemakaianBudget[]): PemakaianBudget | null` → persen tertinggi (null bila kosong).
  - `type ItemRencana = { kategori: string | null; nominal: number; tanggal: string }`
  - `type PeringatanBudget = { kategori: string; status: 'waspada' | 'lewat'; persen: number; terpakai: number; batas: number; pesan: string }`
  - `peringatanBudget(budgets, txs, items: ItemRencana[], abaikanTxId?: string): PeringatanBudget[]` → status setelah item dijumlahkan per kategori+bulan (item bisa lintas bulan); tx dengan `id === abaikanTxId` tidak dihitung (mode ubah). Pesan: waspada `'Budget makan jadi 85% (Rp680.000 dari Rp800.000)'`, lewat `'Lewat budget makan Rp90.000'`. Hanya kategori ber-budget yang statusnya waspada/lewat.
- `danaDarurat.ts`:
  - `type RingkasDarurat = { dompet: { id: string; nama: string; saldo: number; target: number | null; persen: number | null }[]; total: number; totalTarget: number | null /* null bila tidak ada target sama sekali */; persen: number | null; cakupanBulan: number | null /* 1 desimal */ }`
  - `ringkasDarurat(wallets: Wallet[], balances: Record<string, number>, txs: Pick<Tx,'tanggal'|'jenis'|'nominal'>[], bulanIni: string): RingkasDarurat` → hanya `tipe === 'darurat' && !diarsip`; persen = `floor(saldo/target*100)` bila target > 0; cakupan sesuai keputusan 6 (3 bulan penuh sebelum `bulanIni`, pakai `geserBulan` dari `@/lib/tanggal`).
- `investasi.ts`:
  - `type RingkasAset = { id: string; nama: string; nilai: number; modal: number; untung: number; persen: number | null /* 1 desimal */ }`
  - `ringkasAset(wallet: Wallet, nilai: number, txs: BalanceTx[]): RingkasAset` (keputusan 5)
  - `ringkasInvestasi(wallets: Wallet[], balances, txs): { aset: RingkasAset[]; totalNilai: number; totalModal: number; totalUntung: number; persen: number | null }` → hanya `tipe === 'investasi' && !diarsip`.

- [ ] **Step 1: Tulis tes yang gagal:**
  - `statusBudget`: (799,1000) aman, (800,1000) waspada, (1000,1000) waspada, (1001,1000) lewat, (0,1000) aman.
  - `pemakaianBudget`: budget `makan` 800.000 & `Rokok` 300.000; tx pengeluaran `Makan` 320.000 (Nov), `rokok` 390.000 (Nov), `makan` 50.000 (Okt), pemasukan `makan` 1jt, transfer → makan 40% aman sisa 480.000, rokok 130% lewat sisa −90.000; urutan rokok, makan; budget tanpa pengeluaran → terpakai 0.
  - `kategoriKritis` → rokok; `[]` → null.
  - `peringatanBudget`: transport 264.000/300.000 + item 10.000 → waspada `'Budget transport jadi 91% (Rp274.000 dari Rp300.000)'`; item 50.000 → lewat `'Lewat budget transport Rp14.000'`; kategori tanpa budget → `[]`; item aman → `[]`; dua item makan yang bersama-sama lewat → satu peringatan; `abaikanTxId` mengecualikan tx lama; item bulan Desember tidak dijumlah dengan tx November.
  - `ringkasDarurat`: dua dompet darurat 1.200.000 (target 3.000.000) dan 300.000 (tanpa target) → total 1.500.000, totalTarget 3.000.000, persen dompet pertama 40, persen total 50; pengeluaran Agu 1.000.000, Sep 2.000.000, Okt 0 (tanpa tx), bulanIni `2026-11` → cakupan 1.500.000/1.500.000 = 1.0; tanpa pengeluaran → null; dompet diarsip dan harian diabaikan.
  - `ringkasAset`: saldo_awal 1.000.000, transfer masuk 500.000, transfer keluar 200.000, penyesuaian +150.000 → nilai 1.450.000, modal 1.300.000, untung 150.000, persen 11.5; modal 0 → persen null; `ringkasInvestasi` menjumlah dan mengabaikan dompet arsip.
- [ ] **Step 2:** `npx jest src/domain` → FAIL. **Step 3:** Implementasi. **Step 4:** `npx jest`, `npx tsc --noEmit`, `npx expo lint` → PASS.
- [ ] **Step 5: Commit** `feat(budget): domain budget, dana darurat, dan investasi`

### Task 3: Lapisan data budget dan laporan (app)

**Files:**
- Create: `src/data/budgets.ts`, `src/data/laporan.ts`
- Test: `src/data/__tests__/budgets.test.tsx`, `src/data/__tests__/laporan.test.tsx` (pola `src/data/__tests__/ai.test.tsx` dan `transactions.test.tsx`: `@/lib/supabase` di-mock, `QueryClientProvider` di wrapper)

**Interfaces:**
- `budgets.ts`: `useBudgets()` kunci `['budgets']` → `Budget[]` (`from('budgets').select('id,kategori,batas_bulanan').order('kategori')`, angka → `number`); `useSimpanBudget()` mutasi `{ id?: string; kategori: string; batas_bulanan: number }` → `id` ada: `update({batas_bulanan}).eq('id', id)`, tidak ada: `insert({kategori: kategori.trim(), batas_bulanan})`; `useHapusBudget()` mutasi `id` → `delete().eq('id', id)`. Sukses → invalidasi `['budgets']`. Galat lewat `toAppError`. `pesanBudget(e)`: kode Postgres `23505` → `'Budget untuk kategori ini sudah ada'`, selain itu pesan `AppError`.
- `laporan.ts`:
  - `type Penerima = { id: string; email: string; terverifikasi: boolean; verifikasi_dikirim_pada: string | null }`
  - `usePenerima()` kunci `['penerima-laporan']`, urut `created_at`.
  - `useTambahPenerima()` mutasi `email` → normalisasi `trim().toLowerCase()`, validasi lokal (regex sama dengan SQL; salah → `AppError` pesan `'Alamat email tidak valid'`), `insert({ email }).select(...).single()`, lalu panggil `kirimVerifikasi(id)` (galat verifikasi tidak menggagalkan penambahan; dikembalikan sebagai `{ penerima, verifikasiTerkirim: boolean, pesanVerifikasi?: string }`). Pesan galat: `23505` → `'Email ini sudah ada di daftar'`, pesan `Maksimal 3 penerima laporan` diteruskan.
  - `useHapusPenerima()` mutasi `id`.
  - `kirimVerifikasi(recipientId)` → `functions.invoke('report-send', { body: { aksi: 'verifikasi', recipient_id } })`; `useKirimVerifikasi()`.
  - `useKirimLaporan()` mutasi `{ bulan: string }` → `functions.invoke('report-send', { body: { aksi: 'kirim', bulan } })` → `{ terkirim: number; bulan: string }`.
  - Galat non-2xx dari `functions.invoke`: baca `{ galat, pesan }` dari `error.context` (`Response`) seperti `src/data/ai.ts`; kode `bukan_pro` → `AppError` dengan `pesan` dari server; offline → pesan offline yang ada. Jangan menambah `kind` baru ke `src/data/errors.ts` (milik bersama); pakai kind yang ada.
- Kontrak respons `report-send` (dari Task 5): 200 `{ terkirim: number, bulan: string }` untuk `kirim`; 200 `{ terkirim: true }` untuk `verifikasi`; galat `{ galat: 'unauthorized'|'bad_request'|'bukan_pro'|'tanpa_penerima'|'batas'|'tidak_ditemukan'|'server', pesan }` dengan status 401/400/403/409/429/404/500.

- [ ] **Step 1: Tulis tes yang gagal** untuk tiap hook (bentuk panggilan supabase, normalisasi email, validasi lokal tidak memanggil supabase, pemetaan galat 23505/batas/`bukan_pro`, invalidasi setelah sukses, tambah penerima tetap sukses bila verifikasi gagal).
- [ ] **Step 2:** FAIL. **Step 3:** Implementasi. **Step 4:** `npx jest`, `npx tsc --noEmit`, `npx expo lint` → PASS.
- [ ] **Step 5: Commit** `feat(laporan): lapisan data budget dan penerima laporan`

### Task 4: Inti laporan murni (isi, HTML, token, email)

**Files:**
- Create: `supabase/functions/_shared/laporan/isi.ts`, `html.ts`, `token.ts`, `email.ts`
- Test: `supabase/functions/_shared/__tests__/laporan-isi.test.ts`, `laporan-html.test.ts`, `laporan-token.test.ts`, `laporan-email.test.ts`

**Interfaces:**
- `isi.ts` (tanpa import selain relatif):
  - Input `DataLaporan = { nama: string | null; zona: string; wallets: { id; nama; tipe: 'harian'|'darurat'|'investasi'; saldo_awal: number; target: number | null; diarsip: boolean }[]; txs: { id; tanggal; jenis; kategori: string|null; nominal: number; wallet_id: string|null; wallet_tujuan_id: string|null; catatan: string|null }[]; budgets: { kategori: string; batas_bulanan: number }[]; hutang: { pemberi: string; sisa_pokok: number; jatuh_tempo_berikutnya: string|null; nominal_berikutnya: number|null; diarsip: boolean }[] | null }`
  - `buatIsiLaporan(d: DataLaporan, bulan: string, sampai?: string /* 'YYYY-MM-DD', bawaan akhir bulan */): IsiLaporan` dengan `IsiLaporan = { bulan; labelBulan /* 'November 2026' */; sampai; nama; ringkasan: { pemasukan; pengeluaran; setorDarurat; tarikDarurat; bayarHutang; selisih; totalSaldo }; kategori: { kategori; total; batas: number|null; persen: number|null; status: 'aman'|'waspada'|'lewat'|null }[]; terbesar: { tanggal; kategori; nominal; catatan; dompet }[] /* 5 pengeluaran terbesar */; danaDarurat: { saldo; target: number|null; persen: number|null } | null; investasi: { nama; nilai; untung }[]; hutang: { pemberi; sisa; jatuhTempo: string|null; nominal: number|null }[] | null; totalHutang; kekayaanBersih }`.
  - Aturan: transaksi bulan = `tanggal` di `[bulan-01, sampai]`. Saldo per dompet per `sampai` = `saldo_awal` + efek tx dengan `tanggal <= sampai` (efek sama dengan `src/domain/balances.ts`; salin logikanya). `setorDarurat` = Σ transfer bulan itu dari dompet non-darurat ke dompet darurat; `tarikDarurat` kebalikannya. `bayarHutang` = Σ `hutang_bayar`. `selisih` = pemasukan − pengeluaran. `totalSaldo` = Σ saldo semua dompet. Kategori = semua kategori pengeluaran bulan itu ∪ kategori ber-budget, urut total menurun (pencocokan tanpa huruf besar; status dengan ambang keputusan 2). Investasi: nilai = saldo, untung sesuai keputusan 5 dihitung atas tx `<= sampai`. Hutang: `null` bila input `null`; hanya yang tidak diarsip dan `sisa_pokok > 0`. `kekayaanBersih = totalSaldo − totalHutang`.
  - `formatRupiah` lokal (sama persis keluaran `src/domain/money.ts`: `Rp1.200.000`, `-Rp49.000`) dan `labelBulanPanjang('2026-11') = 'November 2026'`.
- `html.ts`: `renderLaporan(isi: IsiLaporan, opsi: { urlBerhenti: string; namaApp?: 'arta' }): { subjek: string; html: string; teks: string }`. Subjek `'Laporan keuangan November 2026 · <nama atau "arta">'`. HTML gaya invoice: tabel inline-style (aman untuk klien email, tanpa `<style>` eksternal/gambar remote), warna terang arta (`#0B424F` teks, `#52C3BF` aksen, `#EEF3F5` latar), bagian sesuai `IsiLaporan` (bagian kosong dilewati), catatan kaki "Kamu menerima email ini karena <nama> menambahkanmu sebagai penerima laporan di arta." + tautan berhenti. **Semua teks dari pengguna di-escape** (`& < > " '`). `teks` = versi teks biasa.
- `token.ts`: `type Tujuan = 'verif' | 'henti'`; `buatToken(t: { tujuan; recipientId; email; exp: number /* detik epoch */ }, tandatangan: (pesan: string) => Promise<string>): Promise<string>`; `bacaToken(token: string, ambilEmail: (recipientId: string) => Promise<string | null>, tandatangan, sekarangDetik: number): Promise<{ ok: true; tujuan; recipientId } | { ok: false; alasan: 'format' | 'kedaluwarsa' | 'tidak_ditemukan' | 'tanda_tangan' }>`. Perbandingan tanda tangan waktu-konstan. `MASA_VERIF = 7*86400`, `MASA_HENTI = 400*86400`.
- `email.ts`: `type PesanEmail = { ke: string; subjek: string; html: string; teks: string; header?: Record<string,string> }`; `type PengirimEmail = { kirim(p: PesanEmail): Promise<{ id: string }> }`; `buatPengirimMemori(): PengirimEmail & { terkirim: PesanEmail[] }`; `buatPengirimLog(log: (baris: string) => void): PengirimEmail` (hanya mencatat `ke` yang disamarkan `o***@example.com` dan subjek; id `log-<n>`); `buatPengirimResend(o: { apiKey: string; dari: string; fetch: typeof fetch }): PengirimEmail` (`POST https://api.resend.com/emails` JSON `{ from, to: [ke], subject, html, text, headers }`, non-2xx → `throw new Error('resend <status>')` tanpa isi respons); `pilihPengirim(env: (k: string) => string | undefined, fetch, log): PengirimEmail` → `resend` hanya bila `EMAIL_MODE === 'resend'` dan `RESEND_API_KEY` dan `EMAIL_FROM` terisi; selain itu log.

- [ ] **Step 1: Tulis tes yang gagal:**
  - isi: data contoh (GoPay 152.000, Cash 106.000, Dana darurat 1.000.000 target 3.000.000, Saham 500.000; tx Nov: pemasukan ortu 1.500.000, pengeluaran makan 320.000 / rokok 390.000 / parkir 2.000 ×3 / transport 50.000, transfer GoPay→Dana darurat 100.000, transfer Cash→Saham 200.000, penyesuaian Saham +30.000, tx Des diabaikan; budget makan 800.000, rokok 300.000, kuliah 500.000; hutang Kredivo sisa 1.200.000 + satu lunas sisa 0) → angka ringkasan, urutan kategori (rokok lewat, makan aman, kuliah 0), 5 terbesar, dana darurat 1.100.000 persen 36, investasi Saham nilai 730.000 untung 30.000, totalHutang 1.200.000, kekayaan bersih; `hutang: null` → bagian null dan totalHutang 0; `sampai` di tengah bulan memotong tx.
  - html: subjek; memuat `Rp1.500.000`, `November 2026`, `Lewat`; catatan `<script>alert(1)</script>` tampil ter-escape; tautan berhenti ada; tanpa dana darurat/investasi/hutang → judul bagian itu tidak ada.
  - token: buat → baca ok; ubah satu karakter tanda tangan → `tanda_tangan`; email berbeda dari `ambilEmail` → `tanda_tangan`; lewat `exp` → `kedaluwarsa`; recipient hilang → `tidak_ditemukan`; `'abc'` → `format`; tujuan selain verif/henti → `format`. `tandatangan` palsu di tes (mis. hash string deterministik), bukan WebCrypto.
  - email: memori mencatat pesan; log menyamarkan alamat dan tidak memuat HTML; resend memanggil `fetch` palsu dengan URL/headers/body yang benar, galat 422 → throw tanpa isi; `pilihPengirim` tanpa env → log, `EMAIL_MODE=resend` tanpa kunci → log.
- [ ] **Step 2:** `npx jest supabase/functions/_shared` → FAIL. **Step 3:** Implementasi. **Step 4:** `npx jest`, `npx tsc --noEmit`, `npx expo lint` → PASS.
- [ ] **Step 5: Commit** `feat(laporan): isi laporan, template email, token verifikasi, dan adapter email`

### Task 5: Edge Function `report-send`, `report-verify`, `report-monthly`

**Files:**
- Create: `supabase/functions/_shared/laporan/handlerKirim.ts`, `handlerVerifikasi.ts`, `handlerBulanan.ts`, `muat.ts`; `supabase/functions/report-send/index.ts`, `report-send/deno.json`, `report-verify/index.ts`, `report-verify/deno.json`, `report-monthly/index.ts`, `report-monthly/deno.json`; `supabase/sql/jadwal-laporan.sql`
- Modify: `supabase/config.toml` (tambah di akhir: `[functions.report-verify]` dan `[functions.report-monthly]` dengan `verify_jwt = false`)
- Test: `supabase/functions/_shared/__tests__/laporan-handler-kirim.test.ts`, `laporan-handler-verifikasi.test.ts`, `laporan-handler-bulanan.test.ts`, `laporan-muat.test.ts`

**Interfaces:**
- `muat.ts`: `type SbLike` (struktural, cukup `from(t).select(c).eq(k,v)…` yang dipakai); `muatDataLaporan(sb: SbLike, userId: string): Promise<DataLaporan>` — selalu `.eq('user_id', userId)` (berlaku untuk klien token pengguna maupun service role), `profiles` pakai `.eq('id', userId)`; transaksi diambil berhalaman 1000 (`range`) sampai habis; `v_hutang` galat apa pun → `hutang: null`.
- `handlerKirim.ts`: `buatHandlerKirim(deps: { db(token: string): DbKirim; email: PengirimEmail; tandatangan; urlVerify: string; sekarang(): Date }): (req: Request) => Promise<Response>`, `DbKirim = { userId(): Promise<string> /* lempar GalatSesi */; pro(): Promise<boolean>; data(): Promise<DataLaporan>; penerima(): Promise<{ id; email; terverifikasi }[]>; mulaiKirim(bulan): Promise<string>; selesaiKirim(id, status, jumlah): Promise<void>; tandaiVerifikasi(recipientId): Promise<boolean> }`. Pakai ulang `GalatSesi`, `CORS`, `tanggalDiZona` dari `../handler.ts` bila ada; kalau tidak ada di branch, salin kecil ke `laporan/http.ts`.
  - `OPTIONS` → 200 CORS. Selain `POST` → 400. Tanpa `Authorization: Bearer` → 401 `'Sesi habis, masuk lagi.'`.
  - Non-Pro → 403 `bukan_pro` `'Laporan email khusus Pro.'` (untuk kedua aksi).
  - `aksi: 'verifikasi'` + `recipient_id`: penerima tidak ada → 404 `tidak_ditemukan`; sudah terverifikasi → 409; `tandaiVerifikasi` false → 429 `batas` `'Tunggu 10 menit sebelum mengirim ulang verifikasi.'`; selain itu kirim email verifikasi (subjek `'Konfirmasi penerima laporan arta'`, tautan `urlVerify?t=<token verif>`, teks menyebut nama pengguna) → 200 `{ terkirim: true }`.
  - `aksi: 'kirim'` + `bulan?` (bawaan bulan berjalan di zona pengguna; hanya bulan berjalan atau lalu yang diterima, selain itu 400): tanpa penerima terverifikasi → 409 `tanpa_penerima` `'Belum ada penerima terverifikasi.'`; `mulaiKirim` melempar pesan batas → 429 `batas`; bangun `buatIsiLaporan` (`sampai` = hari ini bila bulan berjalan), render dan kirim satu email per penerima terverifikasi dengan `urlBerhenti` = token `henti`; header `List-Unsubscribe`; semua gagal → `selesaiKirim(id,'gagal',0)` + 502 `server`; sebagian/semua berhasil → `selesaiKirim(id,'terkirim',n)` + 200 `{ terkirim: n, bulan }`.
  - Log hanya kode status dan jumlah; tidak mencatat email atau isi laporan.
- `handlerVerifikasi.ts`: `buatHandlerVerifikasi(deps: { ambilEmail(id): Promise<string|null>; tandaiTerverifikasi(id): Promise<void>; hapus(id): Promise<void>; tandatangan; sekarang(): Date })`:
  - `GET ?t=` → token valid → halaman HTML (`text/html; charset=utf-8`) dengan judul sesuai tujuan dan `<form method="post">` berisi `t` tersembunyi + tombol "Ya, konfirmasi" / "Ya, berhenti menerima". Token tidak valid → 400 halaman `'Tautan tidak valid atau sudah kedaluwarsa.'`. **GET tidak memanggil `tandaiTerverifikasi`/`hapus`.**
  - `POST` (form `application/x-www-form-urlencoded`, field `t`) → valid `verif` → `tandaiTerverifikasi` + halaman `'Terima kasih, email kamu sudah terkonfirmasi.'`; valid `henti` → `hapus` + `'Kamu tidak akan menerima laporan ini lagi.'`.
- `handlerBulanan.ts`: `buatHandlerBulanan(deps: { rahasiaCron: string; kandidat(): Promise<{ userId; zona }[]> /* pro aktif + ≥1 penerima terverifikasi */; klaim(userId, bulan): Promise<string | null> /* insert report_log bulanan; null bila sudah ada (23505) */; data(userId); penerima(userId); selesai(id, status, jumlah); email; tandatangan; urlVerify; sekarang() })`:
  - Header `x-cron-secret` ≠ `rahasiaCron` (atau rahasia kosong) → 401.
  - Per kandidat: hitung tanggal & jam lokal (`Intl`, zona tidak valid → Asia/Jakarta); ikut bila keputusan 11 terpenuhi; bulan laporan = bulan lalu; `klaim` → null lewati; kirim seperti `kirim`; galat satu pengguna tidak menghentikan pengguna lain. Respons `{ diproses, terkirim, dilewati, gagal }`.
- `index.ts` (tiga file, tipis, dikecualikan tsc lewat pola `supabase/functions/*/index.ts`): isi deps dengan supabase-js (`SUPABASE_URL`, `SUPABASE_ANON_KEY` untuk token pengguna; `SUPABASE_SERVICE_ROLE_KEY` hanya di verify/monthly), `pilihPengirim(Deno.env.get, fetch, console.log)`, `tandatangan` = HMAC-SHA256 WebCrypto dengan `LAPORAN_SECRET` (kosong → lempar galat konfigurasi), `urlVerify = ${SUPABASE_URL}/functions/v1/report-verify`. `deno.json` sama dengan `parse/deno.json`.
- `supabase/sql/jadwal-laporan.sql`: komentar langkah + `create extension if not exists pg_cron; create extension if not exists pg_net;` + simpan rahasia di Vault (`vault.create_secret('<URL project>', 'laporan_url')`, `vault.create_secret('<LAPORAN_CRON_SECRET>', 'laporan_cron_secret')`) + `cron.schedule('laporan-bulanan', '5 * * * *', $$ select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'laporan_url') || '/functions/v1/report-monthly', headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'laporan_cron_secret')), body := '{}'::jsonb) $$);`. Placeholder diisi Rafli; bukan migrasi.

- [ ] **Step 1: Tulis tes yang gagal** dengan deps palsu dan `buatPengirimMemori` (tidak ada jaringan):
  - kirim: tanpa token 401; non-Pro 403 tanpa email terkirim; tanpa penerima terverifikasi 409; 2 terverifikasi + 1 belum → tepat 2 email ke yang terverifikasi, `selesaiKirim(…,'terkirim',2)`, 200 `{terkirim:2}`; satu email gagal → `terkirim:1`; semua gagal → 502 + `'gagal'`; batas → 429; bulan `'2026-09'` saat sekarang November → 400; email memuat tautan `report-verify?t=` bertujuan `henti` dan header `List-Unsubscribe`.
  - verifikasi aksi: belum terverifikasi → email verifikasi 1×; `tandaiVerifikasi` false → 429 tanpa email; sudah terverifikasi → 409; id asing → 404.
  - verify: GET valid → 200 HTML berisi form, deps aksi tidak dipanggil; POST verif → `tandaiTerverifikasi`; POST henti → `hapus`; token rusak/kedaluwarsa → 400.
  - bulanan: rahasia salah → 401; zona Asia/Jakarta, sekarang 2026-12-01 00:30 UTC (07.30 WIB) → dilewati; 01:30 UTC (08.30 WIB) → laporan `2026-11`; 2026-12-09 → dilewati; `klaim` null → tidak ada email; galat data pengguna A tidak menghentikan pengguna B.
  - muat: SbLike palsu merekam `eq('user_id', id)` di setiap tabel, paginasi 1000+ baris, `v_hutang` galat → `hutang: null`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasi (handler + index + SQL + config). Tulis `index.ts` hati-hati karena tidak bisa dijalankan di sini (tidak ada Deno/Docker); jaga tetap tipis.
- [ ] **Step 4:** `npx jest`, `npx tsc --noEmit`, `npx expo lint` → PASS.
- [ ] **Step 5: Commit** `feat(laporan): edge function kirim, verifikasi, dan laporan bulanan`

### Task 6: UI budget, kartu kritis di Beranda, peringatan di form catat

**Files:**
- Create: `app/budget/index.tsx`, `app/budget/ubah.tsx`, `src/components/BarBudget.tsx`, `src/components/KartuBudgetKritis.tsx`, `src/components/PeringatanBudget.tsx`
- Modify: `app/(tabs)/index.tsx` (hunk kecil, lihat tabel bentrok), `src/components/TxForm.tsx` (hunk kecil)
- Test: `src/__tests__/screens/budget.test.tsx`, `src/components/__tests__/BarBudget.test.tsx`, `src/components/__tests__/PeringatanBudget.test.tsx`, tambah kasus di `src/__tests__/screens/beranda.test.tsx` (mock `@/data/budgets`)

**Interfaces:**
- `BarBudget({ p: PemakaianBudget, onPress? })`: baris kit "Bar progres budget": nama kategori (huruf awal kapital), nilai `'Rp320.000 / Rp800.000'`, bar (lebar `min(persen,100)%`, warna `acc` / `warn` / `danger`), baris status dengan ikon `status-budget-aman|waspada|lewat` + teks `'Aman, 40% terpakai'` / `'Hampir habis, 88% terpakai'` / `'Lewat budget Rp90.000'`. `accessibilityLabel` lengkap.
- `app/budget/index.tsx`: judul "Budget" + "Kembali"; label bulan (`labelBulan`), total `'Terpakai Rp… dari Rp…'`; daftar `BarBudget` (ketuk → `/budget/ubah?id=`); tombol "Tambah budget" (`/budget/ubah`); kosong → `KeadaanKosong` (ikon `status-budget-aman`) `'Belum ada budget. Pasang batas bulanan per kategori supaya pengeluaran tetap terkendali.'`. Data: `useBudgets`, `useTransactions(bulan)`, `pemakaianBudget`.
- `app/budget/ubah.tsx`: param `id` opsional. Baru: chip kategori pengeluaran (`useCategories('pengeluaran')`) yang belum punya budget; ubah: kategori tetap (teks). `AmountInput` batas; "Simpan" (`useSimpanBudget`); mode ubah ada "Hapus budget" dengan konfirmasi `Alert` `'Hapus budget <kategori>?'`. Galat → `pesanBudget`.
- `KartuBudgetKritis()`: memakai `useBudgets` + `useTransactions(bulan)` (bulan dari profil zona). Tidak ada budget atau masih memuat/galat → `null` (tidak memblokir Beranda). Selain itu kartu `bg-card` `'Budget paling kritis'` + `BarBudget` dari `kategoriKritis`, ketuk → `router.push('/budget')`.
- `PeringatanBudget({ kategori, nominal, tanggal, abaikanTxId? })`: `useBudgets` + `useTransactions(tanggal.slice(0,7))` → `peringatanBudget`; render tiap pesan dengan ikon status dan warna `warnInk`/`dangerInk`; kosong → `null`. Di `TxForm` dipasang hanya bila jenis = pengeluaran dan nominal > 0, di atas tombol Simpan, `abaikanTxId` = id tx saat mode ubah.
- Beranda: `<KartuBudgetKritis />` tepat setelah kartu "Bulan ini".

- [ ] **Step 1: Tulis tes yang gagal** (mock seperti `src/__tests__/screens/dompet.test.tsx`): daftar tampil urut dengan teks status; kosong → teks keadaan kosong; tambah budget → `useSimpanBudget` dipanggil `{kategori:'makan', batas_bulanan:800000}`; kategori yang sudah punya budget tidak muncul di chip; ubah → hapus dengan konfirmasi; Beranda menampilkan `'Budget paling kritis'` dan kategori kritis, dan tidak menampilkannya tanpa budget; `PeringatanBudget` menampilkan `'Lewat budget transport Rp14.000'`; `BarBudget` lebar bar dibatasi 100%.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasi. **Step 4:** `npx jest`, `npx tsc --noEmit`, `npx expo lint` → PASS (termasuk `font.test.ts`).
- [ ] **Step 5: Commit** `feat(budget): layar budget, kartu kritis beranda, dan peringatan saat catat`

### Task 7: UI dana darurat, investasi, pindah dana

**Files:**
- Create: `app/dana-darurat.tsx`, `app/investasi/index.tsx`, `app/investasi/nilai.tsx`, `app/pindah-dana.tsx`, `src/components/KartuAset.tsx`
- Modify: `app/dompet/baru.tsx` (param `tipe` awal: `harian|darurat|investasi`, nilai lain diabaikan)
- Test: `src/__tests__/screens/dana-darurat.test.tsx`, `src/__tests__/screens/investasi.test.tsx`, `src/__tests__/screens/pindah-dana.test.tsx`, tambah kasus param tipe di `src/__tests__/screens/dompet.test.tsx`

**Interfaces:**
- `app/pindah-dana.tsx`: param `ke` **atau** `dari` (id dompet darurat/investasi) dan `mode` (`setor|tarik|beli|jual`). Judul: `'Setor dana darurat'`, `'Tarik dana darurat'`, `'Beli investasi'`, `'Jual investasi'`. Pilih dompet pasangan dari dompet `harian` tidak diarsip (chip + saldo ringkas). `AmountInput` nominal; tanggal = `hariIni`; catatan bawaan sama dengan judul + nama dompet. Simpan → `useSaveTransactions` satu item `{ id (dibuat sekali saat layar dibuka, dipakai ulang), tanggal, jenis: 'transfer', kategori: 'transfer', nominal, wallet_id: asal, wallet_tujuan_id: tujuan, catatan, transkrip: null, sumber: 'manual' }`. Tombol nonaktif saat sibuk / belum valid; tekan dua kali → satu panggilan. Galat → pesan; sukses → kembali.
- `app/dana-darurat.tsx`: data `useWallets`, `useAllTransactions`, `walletBalances`, `ringkasDarurat` (bulan dari profil). Kartu total: `formatRupiah(total)`, `'dari target Rp…'` + bar progres `acc` (bila ada target), `'Cukup untuk 2,5 bulan pengeluaran'` (bila ada). Per dompet: nama, saldo, target/persen, tombol "Setor" (`/pindah-dana?ke=<id>&mode=setor`), "Tarik" (`/pindah-dana?dari=<id>&mode=tarik`), "Ubah target" (inline `AmountInput` + simpan `useUpdateWallet({id, patch:{target}})`, 0 = hapus target → `null`). Kosong → `KeadaanKosong` ikon `wallet-darurat` `'Belum ada dana darurat. Sisihkan sedikit tiap bulan untuk jaga-jaga.'` + `Tombol` "Buat dana darurat" → `/dompet/baru?tipe=darurat`.
- `KartuAset({ a: RingkasAset, onBeli, onJual, onNilai })`: nama, nilai besar, `'Modal Rp…'`, untung bertanda (`+Rp30.000 (+11,5%)` warna `accInk`, rugi `dangerInk`), tiga tombol kecil "Beli", "Jual", "Update nilai".
- `app/investasi/index.tsx`: kartu total (nilai, untung total); daftar `KartuAset`; "Tambah aset" → `/dompet/baru?tipe=investasi`; kosong → `KeadaanKosong` ikon `wallet-investasi` `'Belum ada investasi. Tambahkan aset seperti reksa dana, saham, atau emas.'`.
- `app/investasi/nilai.tsx`: param `id`. Tampilkan nilai sekarang; `AmountInput` nilai baru (boleh 0); pratinjau `'Untung jadi +Rp…'`; Simpan → `useSaveTransactions` `{ jenis: 'penyesuaian', kategori: 'penyesuaian', nominal: adjustmentFor(nilai, baru), wallet_id: id, wallet_tujuan_id: null, catatan: 'Update nilai investasi', … }`; selisih 0 → tombol nonaktif dengan teks `'Nilainya sama'`.

- [ ] **Step 1: Tulis tes yang gagal:** dana darurat total/persen/cakupan tampil; tombol Setor → `router.push` dengan param benar; ubah target memanggil `useUpdateWallet`; kosong → tombol buat dompet; investasi menampilkan untung `+Rp30.000`; update nilai mengirim penyesuaian `+150.000` dan nonaktif bila sama; pindah dana setor mengirim transfer harian→darurat, tekan Simpan dua kali → satu panggilan, coba ulang setelah gagal memakai id sama; `dompet/baru?tipe=darurat` memilih chip Darurat sejak awal.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasi. **Step 4:** `npx jest`, `npx tsc --noEmit`, `npx expo lint` → PASS.
- [ ] **Step 5: Commit** `feat(dana): layar dana darurat, investasi, dan pindah dana`

### Task 8: UI laporan dan menu Akun

**Files:**
- Create: `app/laporan.tsx`, `src/components/MenuRencana.tsx`
- Modify: `app/(tabs)/akun.tsx` (satu import + `<MenuRencana />` sebelum blok "Tampilan")
- Test: `src/__tests__/screens/laporan.test.tsx`, `src/components/__tests__/MenuRencana.test.tsx`

**Interfaces:**
- `MenuRencana()`: judul bagian `'Rencana keuangan'`; baris berikon (chevron) "Budget" (`status-budget-aman`) → `/budget`, "Dana darurat" (`wallet-darurat`) → `/dana-darurat`, "Investasi" (`wallet-investasi`) → `/investasi`, "Laporan email" (ikon yang cocok dari `NamaIkon`, + `BadgeTier` Pro bila komponennya mendukung) → `/laporan`.
- `app/laporan.tsx`: judul "Laporan email" + "Kembali".
  - Memuat `useKuotaAi()` (status Pro). Non-Pro: `KeadaanKosong ilustrasi="laporan"` `'Kirim ringkasan keuangan bulanan ke orang tua, pasangan, atau teman sebagai pengingat. Fitur ini khusus Pro.'` + teks `'Pro segera hadir.'`; tidak ada aksi kirim/tambah.
  - Pro: penjelasan singkat (laporan otomatis tiap tanggal 1 pukul 08.00); daftar penerima (maks 3): email, status `'Terverifikasi'` (ikon `status-lunas`) atau `'Menunggu konfirmasi'` + tombol "Kirim ulang" (`useKirimVerifikasi`, pesan 429 tampil), tombol hapus dengan konfirmasi; formulir tambah (TextInput email `keyboardType="email-address"`, `autoCapitalize="none"`) disembunyikan bila sudah 3 → teks `'Maksimal 3 penerima.'`; setelah tambah → `'Email konfirmasi dikirim ke <email>.'` (atau pesan verifikasi gagal).
  - "Kirim sekarang": chip `Bulan ini` / `Bulan lalu`, `Tombol primary` "Kirim laporan" nonaktif bila tidak ada penerima terverifikasi (dengan alasan `'Belum ada penerima terverifikasi.'`); sukses → `'Laporan <label bulan> terkirim ke N penerima.'`; galat → pesan server.
- `app/(tabs)/akun.tsx`: hanya hunk di tabel bentrok.

- [ ] **Step 1: Tulis tes yang gagal:** non-Pro → teks Pro dan tanpa tombol kirim; Pro dengan 1 terverifikasi + 1 menunggu → kedua status tampil; tambah email → `useTambahPenerima` dipanggil `'ortu@example.com'` lalu pesan konfirmasi; 3 penerima → form hilang; kirim bulan lalu → `useKirimLaporan({bulan: geserBulan(bulanIni,-1)})` dan pesan sukses; tanpa penerima terverifikasi → tombol nonaktif; `MenuRencana` mendorong rute yang benar; `akun` merender `'Rencana keuangan'`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasi. **Step 4:** `npx jest`, `npx tsc --noEmit`, `npx expo lint` → PASS.
- [ ] **Step 5: Commit** `feat(laporan): layar laporan email dan menu rencana keuangan di akun`

### Task 9: Panduan deploy & uji Rencana 4

**Files:**
- Create: `docs/uji-manual-rencana-4.md`
- Modify: dokumen ini (bagian Status)

- [ ] **Step 1:** Panduan dengan perintah yang dijalankan Rafli sendiri, satu per baris: `npx supabase db push --remote`; `npm run test:integration`; secret `LAPORAN_SECRET`, `LAPORAN_CRON_SECRET` (acak, diketik sendiri), opsional `EMAIL_MODE=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (butuh domain terverifikasi di Resend); `npx supabase functions deploy report-send`, `report-verify --no-verify-jwt`, `report-monthly --no-verify-jwt`; jalankan `supabase/sql/jadwal-laporan.sql` di SQL editor setelah mengisi placeholder; set Pro untuk akun uji lewat SQL editor (`insert into entitlements (user_id, pro_aktif, sumber) values ('<uid>', true, 'uji') on conflict (user_id) do update set pro_aktif = true`). APK dev tidak perlu dibangun ulang (tanpa paket native baru).
- [ ] **Step 2:** Daftar uji (centang): budget tambah/ubah/hapus dan status tepi; Beranda kartu kritis; peringatan saat catat; dana darurat setor/tarik/target/cakupan; investasi beli/jual/update nilai dan untung; kekayaan bersih Beranda tetap = total semua dompet − hutang; laporan non-Pro terkunci; Pro tambah penerima → (mode log) lihat log function untuk tautan… (mode log tidak mencatat tautan; pakai mode resend dengan email sendiri untuk uji ujung-ke-ujung); verifikasi dari HP/laptop; kirim sekarang; batas 3/hari; berhenti berlangganan; `report-monthly` manual dengan header rahasia.
- [ ] **Step 3:** `npx jest`, `npx tsc --noEmit`, `npx expo lint` → PASS. **Step 4: Commit** `docs: panduan deploy dan uji rencana 4`

---

## Status

_Diperbarui setiap task selesai. Saat melanjutkan sesi: baca bagian ini dan `git log --oneline` dulu._

- [x] Task 1 — skema budget & laporan (`7bfac49`; trigger penerima = security invoker; tes integrasi menunggu `db push`)
- [x] Task 2 — domain murni (`0122ff0`)
- [x] Task 3 — lapisan data app (`3bae456`; galat server → `kind: 'lain'` + pesan server)
- [x] Task 4 — inti laporan murni (`c90df43`)
- [ ] Task 5 — edge function
- [ ] Task 6 — UI budget
- [ ] Task 7 — UI dana darurat & investasi
- [ ] Task 8 — UI laporan & menu Akun
- [ ] Task 9 — panduan uji

**Catatan sesi 2026-11-20 (terhenti karena batas pemakaian):**
- Selesai: dokumen rencana ini (commit `docs: rencana 4 …`). Belum ada kode.
- Worktree awalnya tanpa `node_modules`; `npm ci` dijalankan di latar belakang. Jika folder `node_modules` belum lengkap, jalankan ulang `npm ci` sebelum `npx jest`/`npx tsc --noEmit`/`npx expo lint`.
- Baseline lint/tsc/jest belum dicek. Galat tsc lama yang diketahui (milik Rencana 2, belum di-commit di checkout lain) tidak ada di branch ini.
- `supabase/functions/_shared/handler.ts` sudah mengekspor `GalatSesi`, `CORS`, `tanggalDiZona` (bisa dipakai Task 5).

**Langkah berikutnya:** Gelombang B (Task 5–8) sedang berjalan paralel, lalu Task 9.

**Catatan baseline:** `npx jest` di worktree ini ikut menjalankan `tests/integration/*` (gagal tanpa `.env.test`; sudah begitu sebelum rencana 4). Proyek belum punya konfigurasi ESLint, sehingga `npx expo lint` belum memeriksa apa pun (dibereskan Rencana 2).
