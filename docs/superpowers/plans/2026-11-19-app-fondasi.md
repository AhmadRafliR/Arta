# App Keuangan: Rencana 1 (Fondasi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat app Android (Expo) yang sudah bisa: masuk akun, membuat dompet dengan saldo awal, mencatat transaksi manual, melihat Beranda (sisa uang, kekayaan bersih, ringkasan bulan ini) dan Riwayat (ubah/hapus), serta berganti mode terang/gelap. Datanya ada di Supabase dan terlindungi per pengguna.

**Architecture:** Expo Router app (TypeScript) berbicara langsung ke Supabase lewat supabase-js; keamanan per pengguna dijaga Row Level Security, dan penyimpanan transaksi lewat satu fungsi Postgres (RPC) yang memvalidasi kepemilikan dompet. Perhitungan uang (saldo, ringkasan) adalah fungsi TypeScript murni di `src/domain/` supaya bisa diuji tanpa server.

**Tech Stack:** Expo SDK terbaru stabil (`create-expo-app@latest`), Expo Router, TypeScript strict, NativeWind v4 (token warna via CSS variables), TanStack Query v5, supabase-js v2, `@react-native-async-storage/async-storage`, Jest (`jest-expo`) + React Native Testing Library, Supabase CLI (migrasi ke project hosted).

**Spec:** `C:\projek\n8n\docs\specs\2026-11-19-app-keuangan-design.md` (disalin ke `docs/spec.md` di repo baru pada Task 1).

**Rangkaian rencana:** Rencana 1 Fondasi (ini) → Rencana 2 Catat pakai AI + kuota → Rencana 3 Hutang & jadwal → Rencana 4 Budget, dana darurat, investasi, laporan email → Rencana 5 Langganan, pengingat push, ekspor, hapus akun, rilis Play Store.

## Global Constraints

- Repo baru: `C:\projek\keuangan-app` (nama kerja `keuangan-app`; nama app belum ditentukan). Git di branch `main`, commit tiap task.
- Uang disimpan sebagai **bilangan bulat rupiah** (`bigint` di Postgres, `number` di TS). Tidak ada desimal.
- Format tampilan: `Rp288.000`, negatif `-Rp49.000` (tanda minus di depan "Rp"), pemisah ribuan titik (`id-ID`).
- Semua tabel milik pengguna punya kolom `user_id uuid not null default auth.uid()` dan RLS `user_id = auth.uid()` untuk select/insert/update/delete.
- `jenis` transaksi (enum, lengkap sejak awal): `pemasukan`, `pengeluaran`, `transfer`, `hutang_baru`, `hutang_bayar`, `penyesuaian`. Rencana 1 hanya membuat/mengubah `pemasukan`, `pengeluaran`, `transfer`, `penyesuaian`.
- `tipe` dompet: `harian`, `darurat`, `investasi`.
- Kategori bawaan pengeluaran: `rokok, makan, parkir, kuliah, transport, lainnya`; pemasukan: `ortu, gaji, lainnya`.
- Token warna (persis dari spec 5.2):
  - Terang: latar `#EEF3F5`, hero gradien `#0B424F → #1F6A76` (teks putih), kartu `#FFFFFF`, teks `#0B424F`, aksen `#52C3BF`, garis `#DDE7EA`, teks sekunder `#5B7C84`.
  - Gelap: latar `#0B0B0C`, hero `#FFFFFF` (teks `#0B0B0C`), kartu `#161618`, teks `#FFFFFF`, aksen `#C6F432`, garis `#26262A`, teks sekunder `#8A8A8F`.
- Aksen hanya untuk: tombol mic, tombol utama, progres, nominal uang masuk.
- Navigasi bawah: **Beranda · Riwayat · [Mic] · Hutang · Akun**. Di Rencana 1, Mic membuka formulir catat manual; Hutang menampilkan "Segera hadir".
- Online-only: simpan tanpa koneksi ditolak dengan pesan jelas; data terakhir tetap tampil dari cache.
- Bahasa UI: Indonesia.
- Kunci rahasia (service role, OAuth secret) **tidak pernah** masuk app atau commit; hanya di `.env.test` lokal (di-gitignore) dan Supabase dashboard. Rafli yang memasukkan sendiri semua kunci.

**Keputusan rencana ini (menyempurnakan spec 5.5):** saldo dompet = `saldo_awal` + efek **semua** transaksi di dompet itu, tanpa memfilter tanggal. Ini menghindari bug transaksi di hari yang sama dari versi Sheets. `tanggal_saldo_awal` disimpan hanya untuk ditampilkan. Data lama diimpor dengan `saldo_awal = 0` ditambah transaksinya.

**Prasyarat yang dikerjakan Rafli (Claude tidak membuat akun atau memasukkan kunci):**
1. Akun Supabase + project `keuangan-dev` (region Singapore). URL, anon key, dan service role key ditempel sendiri ke `.env.test`.
2. Akun Expo (untuk EAS Build) dan HP Android untuk uji.
3. Google Cloud: OAuth client (Android + Web) untuk masuk dengan Google, dimasukkan ke Supabase Auth → Providers → Google. Bisa menyusul; masuk dengan email OTP jalan tanpa ini.

## Review Focus

1. **Format nominal ketikan** "25rb", "1,5jt", "153.267", "Rp 30.000", "2.000.000" → harus terbaca 25000, 1500000, 153267, 30000, 2000000; "abc", "0", "-5" ditolak. (Task 3, `parseNominal`)
2. **Simpan ganda saat koneksi putus dan pengguna menekan Simpan lagi** → tidak boleh ada transaksi dobel. Id transaksi dibuat di app, dan RPC memakai `on conflict (id) do nothing`. (Task 4 + Task 9)
3. **Transfer ke dompet yang sama, atau ke dompet milik orang lain** → ditolak server. (Task 4)
4. **Transaksi pukul 23.30 WIB tanggal 30 Nov** → masuk ringkasan November, bukan Desember. `tanggal` adalah `date` di zona waktu pengguna, bukan timestamp UTC. (Task 3, `monthSummary`)
5. **Mengarsipkan dompet yang masih ada saldonya** → ditolak dengan pesan "Pindahkan dulu saldonya", supaya total tidak diam-diam berubah. (Task 11)

---

### Task 1: Scaffold repo Expo + Jest

**Files:**
- Create: `C:\projek\keuangan-app\` (via `npx create-expo-app@latest keuangan-app --template default`)
- Create: `docs/spec.md` (salinan spec), `.gitignore` (tambah `.env*`, `!.env.example`), `.env.example`
- Modify: `package.json` (scripts `test`, `typecheck`), `tsconfig.json` (`"strict": true`, path alias `@/*` → `src/*`)
- Test: `src/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: alias impor `@/…`, perintah `npm test` dan `npm run typecheck`.

- [ ] **Step 1:** Buat project, hapus contoh bawaan template (`app/(tabs)` contoh, `components/` contoh) supaya `app/` kosong kecuali `_layout.tsx`.
- [ ] **Step 2:** Pasang `jest-expo`, `@testing-library/react-native`, `@types/jest`; set `"jest": { "preset": "jest-expo" }`.
- [ ] **Step 3: Tulis smoke test**

```ts
test('alias @ jalan', () => {
  const { APP_NAME } = require('@/config');
  expect(APP_NAME).toBe('keuangan-app');
});
```

- [ ] **Step 4:** `npm test` → FAIL (`@/config` belum ada). Buat `src/config.ts` dengan `export const APP_NAME = 'keuangan-app'`. Jalankan `npm test` → PASS, lalu `npm run typecheck` → tanpa error.
- [ ] **Step 5:** `git init -b main`, commit `chore: scaffold expo app`.

### Task 2: Skema database + RLS

**Files:**
- Create: `supabase/migrations/20261119000001_init.sql`
- Create: `tests/integration/helpers.ts`, `tests/integration/rls.test.ts`
- Create: `jest.integration.config.js` (testMatch `tests/integration/**`, tanpa preset expo, env dari `.env.test`)
- Modify: `package.json` (script `test:integration`)

**Interfaces:**
- Produces tabel:
  - `profiles(id uuid pk references auth.users on delete cascade, nama text, zona_waktu text default 'Asia/Jakarta', mode_tampilan text check in ('sistem','terang','gelap') default 'sistem', onboarding_selesai boolean default false, created_at timestamptz default now())`
  - `wallets(id uuid pk default gen_random_uuid(), user_id, nama text not null, tipe text check in ('harian','darurat','investasi') default 'harian', saldo_awal bigint not null default 0, tanggal_saldo_awal date not null default current_date, target bigint, diarsip boolean default false, created_at timestamptz default now(), unique(user_id, nama))`
  - `categories(id uuid pk, user_id, jenis text check in ('pemasukan','pengeluaran'), nama text, unique(user_id, jenis, nama))`
  - `transactions(id uuid pk, user_id, tanggal date not null, jenis text not null check in (6 jenis), kategori text, nominal bigint not null, wallet_id uuid references wallets, wallet_tujuan_id uuid references wallets, debt_id uuid, porsi_bunga bigint, porsi_pokok bigint, catatan text, transkrip text, sumber text check in ('ai','manual','import') default 'manual', created_at timestamptz default now(), check (nominal <> 0), check (jenis = 'penyesuaian' or nominal > 0))`
  - Index `transactions(user_id, tanggal desc)`.
  - Trigger `on auth.users insert` → buat `profiles` + kategori bawaan (lihat Global Constraints).
- Produces helper: `createTestUser(): Promise<{ client: SupabaseClient; userId: string }>` (pakai service role admin API, lalu sign in dengan password acak); `cleanupUsers()`.

- [ ] **Step 1: Tulis tes RLS yang gagal**

```ts
test('pengguna B tidak bisa membaca dompet A', async () => {
  const a = await createTestUser(); const b = await createTestUser();
  await a.client.from('wallets').insert({ nama: 'GoPay', saldo_awal: 152000 });
  const { data } = await b.client.from('wallets').select('*');
  expect(data).toEqual([]);
});
test('pengguna B tidak bisa menyisipkan dompet atas nama A', async () => {
  const a = await createTestUser(); const b = await createTestUser();
  const { error } = await b.client.from('wallets').insert({ nama: 'X', user_id: a.userId });
  expect(error).not.toBeNull();
});
test('pengguna baru langsung punya profil dan 9 kategori bawaan', async () => {
  const a = await createTestUser();
  const { data: p } = await a.client.from('profiles').select('*').single();
  expect(p.mode_tampilan).toBe('sistem');
  const { count } = await a.client.from('categories').select('*', { count: 'exact', head: true });
  expect(count).toBe(9);
});
test('nominal pengeluaran negatif ditolak, penyesuaian negatif diterima', async () => { /* insert langsung, cek error / tidak */ });
```

- [ ] **Step 2:** `npm run test:integration` → FAIL (tabel belum ada).
- [ ] **Step 3:** Tulis migrasi sesuai Interfaces. Rafli menjalankan `npx supabase login` sendiri, lalu `npx supabase link --project-ref <ref>` dan `npx supabase db push`.
- [ ] **Step 4:** `npm run test:integration` → PASS (4 tes).
- [ ] **Step 5:** Commit `feat(db): skema awal + RLS`.

### Task 3: Domain uang (fungsi murni)

**Files:**
- Create: `src/domain/types.ts`, `src/domain/money.ts`, `src/domain/balances.ts`, `src/domain/summary.ts`
- Test: `src/domain/__tests__/money.test.ts`, `balances.test.ts`, `summary.test.ts`

**Interfaces:**
- Produces:
  - `type Jenis`, `type TipeDompet`, `type Wallet`, `type Tx` (bentuk sama dengan kolom Task 2, nama snake_case)
  - `formatRupiah(n: number): string`
  - `formatRingkas(n: number): string` → `152rb`, `1,5jt`, `-25rb` (untuk chip & daftar)
  - `parseNominal(input: string): number | null`
  - `walletBalances(wallets: Wallet[], txs: Tx[]): Record<string, number>`
  - `sisaUang(wallets: Wallet[], balances: Record<string, number>): number` (hanya tipe `harian`, termasuk yang diarsip)
  - `kekayaanBersih(balances: Record<string, number>, totalHutang = 0): number`
  - `monthSummary(txs: Tx[], bulan: string /* 'YYYY-MM' */): { masuk: number; keluar: number; selisih: number }` (masuk = pemasukan; keluar = pengeluaran; transfer & penyesuaian tidak dihitung)

- [ ] **Step 1: Tulis tes yang gagal**

```ts
expect(formatRupiah(288000)).toBe('Rp288.000');
expect(formatRupiah(-49000)).toBe('-Rp49.000');
expect(formatRingkas(152000)).toBe('152rb');
expect(formatRingkas(1500000)).toBe('1,5jt');
expect(formatRingkas(-25000)).toBe('-25rb');
for (const [s, n] of [['25rb',25000],['1,5jt',1500000],['153.267',153267],['Rp 30.000',30000],['2.000.000',2000000],['2rb',2000]] as const)
  expect(parseNominal(s)).toBe(n);
for (const s of ['abc', '0', '-5', '']) expect(parseNominal(s)).toBeNull();

// saldo dari data Rafli
const w = [W('gopay',152000), W('cash',106000), W('spay',30000)];
expect(sisaUang(w, walletBalances(w, []))).toBe(288000);
// efek tiap jenis
const txs = [T('pengeluaran',25000,'gopay'), T('pemasukan',1500000,'cash'),
             T('transfer',50000,'cash','spay'), T('penyesuaian',-1000,'gopay')];
expect(walletBalances(w, txs)).toEqual({ gopay: 126000, cash: 1556000, spay: 80000 });
// dompet darurat tidak masuk sisa uang tapi masuk kekayaan bersih
const w2 = [...w, W('darurat',100000,'darurat')];
const b2 = walletBalances(w2, []);
expect(sisaUang(w2, b2)).toBe(288000);
expect(kekayaanBersih(b2, 1365283)).toBe(388000 - 1365283);
// batas bulan memakai tanggal lokal
expect(monthSummary([T('pengeluaran',2000,'cash',null,'2026-11-30')], '2026-11').keluar).toBe(2000);
expect(monthSummary([T('pengeluaran',2000,'cash',null,'2026-11-30')], '2026-12').keluar).toBe(0);
expect(monthSummary(txs.map(t => ({...t, tanggal:'2026-11-19'})), '2026-11'))
  .toEqual({ masuk: 1500000, keluar: 25000, selisih: 1475000 });
```

(`W(id, saldo, tipe='harian')` dan `T(jenis, nominal, wallet, tujuan?, tanggal='2026-11-19')` adalah fabrik kecil di file tes.)

- [ ] **Step 2:** `npm test src/domain` → FAIL.
- [ ] **Step 3:** Implementasi. `parseNominal`: buang `Rp`/spasi; akhiran `rb|ribu|k` ×1.000, `jt|juta` ×1.000.000 (koma = desimal); tanpa akhiran, titik/koma dianggap pemisah ribuan; hasil harus bilangan bulat > 0.
- [ ] **Step 4:** `npm test src/domain` → PASS.
- [ ] **Step 5:** Commit `feat(domain): perhitungan saldo dan ringkasan`.

### Task 4: RPC `save_transactions`

**Files:**
- Create: `supabase/migrations/20261119000002_save_transactions.sql`
- Test: `tests/integration/save_transactions.test.ts`

**Interfaces:**
- Produces: `save_transactions(items jsonb) returns setof transactions`, `security invoker`. Setiap item: `{ id uuid, tanggal, jenis, kategori, nominal, wallet_id, wallet_tujuan_id, catatan, transkrip, sumber }`. Semua item disimpan dalam satu transaksi database (semua atau tidak sama sekali). Duplikat `id` diabaikan (`on conflict (id) do nothing`). Validasi (raise exception dengan pesan Indonesia):
  - `wallet_id` wajib dan harus milik `auth.uid()`
  - `transfer` wajib `wallet_tujuan_id` milik pengguna dan ≠ `wallet_id`
  - Rencana 1 hanya menerima `pemasukan|pengeluaran|transfer|penyesuaian`; jenis hutang ditolak dengan pesan "belum didukung"
- Rencana 3 akan mengganti fungsi ini dengan versi yang menangani hutang (nama dan bentuk item sama).

- [ ] **Step 1: Tulis tes yang gagal**

```ts
test('menyimpan 2 item sekaligus', …expect(data).toHaveLength(2));
test('id sama dikirim dua kali → tetap 1 baris', …);
test('transfer ke dompet yang sama ditolak', …expect(error.message).toMatch(/dompet tujuan/));
test('transfer ke dompet milik pengguna lain ditolak', …);
test('satu item tidak valid → tidak ada yang tersimpan', …expect(count).toBe(0));
```

- [ ] **Step 2:** `npm run test:integration -- save_transactions` → FAIL.
- [ ] **Step 3:** Tulis migrasi, lalu Rafli menjalankan `npx supabase db push`.
- [ ] **Step 4:** Tes → PASS.
- [ ] **Step 5:** Commit `feat(db): rpc save_transactions`.

### Task 5: Tema terang/gelap

**Files:**
- Create: `src/theme/tokens.ts`, `src/theme/ThemeProvider.tsx`, `tailwind.config.js`, `global.css`, `babel.config.js`/`metro.config.js` (setup NativeWind v4)
- Test: `src/theme/__tests__/theme.test.tsx`

**Interfaces:**
- Produces:
  - `tokens: Record<'terang'|'gelap', { bg; card; fg; mid; line; acc; accFg; heroFrom; heroTo; heroFg }>` (nilai persis dari Global Constraints; di mode gelap `heroFrom = heroTo = '#FFFFFF'`)
  - `resolveMode(pref: 'sistem'|'terang'|'gelap', system: 'light'|'dark'|null): 'terang'|'gelap'`
  - `<ThemeProvider>` + `useTheme(): { mode; t: tokens[mode]; pref; setPref(p) }`. `setPref` menyimpan ke AsyncStorage `tema_pref` dan memanggil prop opsional `onPrefChange(p)`. Task 6 menyambungkan `onPrefChange` ke update `profiles.mode_tampilan`, dan saat masuk mengambil `mode_tampilan` dari profil.
  - Kelas Tailwind: `bg-bg`, `bg-card`, `text-fg`, `text-mid`, `border-line`, `bg-acc`, `text-acc`, dipetakan ke CSS variables yang ditukar `ThemeProvider` lewat `vars()`.

- [ ] **Step 1: Tes yang gagal**

```ts
expect(tokens.terang.bg).toBe('#EEF3F5'); expect(tokens.terang.acc).toBe('#52C3BF');
expect(tokens.gelap.bg).toBe('#0B0B0C');  expect(tokens.gelap.acc).toBe('#C6F432');
expect(resolveMode('sistem','dark')).toBe('gelap');
expect(resolveMode('sistem',null)).toBe('terang');
expect(resolveMode('terang','dark')).toBe('terang');
```

- [ ] **Step 2:** FAIL → **Step 3:** implementasi → **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(ui): token tema terang/gelap`.

### Task 6: Klien Supabase + masuk (email OTP & Google)

**Files:**
- Create: `src/lib/supabase.ts`, `src/auth/AuthProvider.tsx`, `app/(auth)/masuk.tsx`, `app/(auth)/kode.tsx`
- Modify: `app/_layout.tsx` (QueryClientProvider, ThemeProvider, AuthProvider, redirect: belum masuk → `/(auth)/masuk`; masuk tapi `onboarding_selesai=false` → `/(onboarding)/dompet-awal`; selainnya → `/(tabs)`)
- Test: `src/auth/__tests__/redirect.test.ts`

**Interfaces:**
- Produces: `supabase` (persist session di AsyncStorage, `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`), `useAuth(): { session; profile; loading; signOut() }`, `routeFor(state: { session: boolean; onboardingSelesai: boolean | null }): '/(auth)/masuk' | '/(onboarding)/dompet-awal' | '/(tabs)' | null` (null = masih memuat).

- [ ] **Step 1:** Tes `routeFor` untuk 4 keadaan (tanpa sesi; sesi + onboarding false; sesi + true; sesi + null → null) → FAIL.
- [ ] **Step 2:** Implementasi `routeFor`, provider, layar masuk (tombol "Masuk dengan Google" dan isian email → `signInWithOtp`, layar `kode` untuk 6 digit → `verifyOtp`). Google pakai `@react-native-google-signin/google-signin` + `signInWithIdToken`; tombolnya disembunyikan jika `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` kosong.
- [ ] **Step 3:** Tes → PASS; `npm run typecheck` bersih.
- [ ] **Step 4:** Commit `feat(auth): masuk email OTP dan Google`.

### Task 7: Hook data (TanStack Query)

**Files:**
- Create: `src/data/wallets.ts`, `src/data/transactions.ts`, `src/data/categories.ts`, `src/data/errors.ts`
- Test: `src/data/__tests__/errors.test.ts`, `src/data/__tests__/transactions.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 6), tipe dari Task 3.
- Produces:
  - `useWallets(): UseQueryResult<Wallet[]>`, `useCreateWallet()`, `useUpdateWallet()`
  - `useTransactions(bulan: string): UseQueryResult<Tx[]>`, `useAllTransactions()` (untuk saldo, dengan kolom terbatas)
  - `useSaveTransactions(): UseMutationResult<Tx[], AppError, NewTx[]>` → memanggil RPC `save_transactions`; saat sukses meng-invalidate `['transactions']` dan `['wallets']`
  - `useUpdateTransaction()`, `useDeleteTransaction()` (update/delete biasa, dilindungi RLS)
  - `useCategories(jenis)`
  - `newTxId(): string` (uuid v4 dari `expo-crypto`)
  - `toAppError(e: unknown): AppError` dengan `{ kind: 'offline' | 'validasi' | 'lain'; pesan: string }`. Pesan offline: "Tidak ada koneksi. Transaksi belum tersimpan, coba lagi." Pesan dari RPC diteruskan apa adanya sebagai `validasi`.

- [ ] **Step 1:** Tes `toAppError`: `TypeError('Network request failed')` → kind `offline`; error Postgres `{ code: 'P0001', message: 'Dompet tujuan tidak boleh sama' }` → kind `validasi`, pesan sama. Tes hook: mutasi gagal karena offline lalu diulang dengan payload yang sama → RPC dipanggil dua kali dengan **id yang sama** (supabase di-mock). → FAIL.
- [ ] **Step 2:** Implementasi → PASS.
- [ ] **Step 3:** Commit `feat(data): hook dompet dan transaksi`.

### Task 8: Onboarding dompet awal

**Files:**
- Create: `app/(onboarding)/dompet-awal.tsx`, `src/components/AmountInput.tsx`
- Test: `src/components/__tests__/AmountInput.test.tsx`, `app/(onboarding)/__tests__/dompet-awal.test.tsx`

**Interfaces:**
- Consumes: `parseNominal`, `formatRupiah` (Task 3); `useCreateWallet` (Task 7).
- Produces: `<AmountInput value onChange(n: number|null) />` (menampilkan pratinjau `formatRupiah` di bawah isian, error "Nominal tidak valid" jika null dan tidak kosong).

Layar: isian nama (sapaan) → daftar dompet (bawaan terisi: GoPay, Cash, ShopeePay; bisa tambah/hapus) dengan saldo awal masing-masing → "Mulai". Saat Mulai, buat dompet lalu set `profiles.onboarding_selesai = true` dan `nama`.

- [ ] **Step 1:** Tes: ketik "153.267" → pratinjau "Rp153.267"; ketik "abc" → error tampil; tombol Mulai nonaktif kalau tidak ada dompet atau ada nominal tidak valid. → FAIL.
- [ ] **Step 2:** Implementasi → PASS.
- [ ] **Step 3:** Commit `feat(onboarding): dompet awal`.

### Task 9: Tab + Beranda + Catat manual

**Files:**
- Create: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx` (Beranda), `app/(tabs)/hutang.tsx` (placeholder "Segera hadir"), `app/catat.tsx` (modal), `src/components/HeroCard.tsx`, `src/components/WalletChips.tsx`, `src/components/TxRow.tsx`, `src/components/MicButton.tsx`, `src/lib/greeting.ts`
- Test: `src/lib/__tests__/greeting.test.ts`, `app/__tests__/catat.test.tsx`, `src/components/__tests__/HeroCard.test.tsx`

**Interfaces:**
- Consumes: Task 3, 5, 7, 8.
- Produces: `sapaan(jam: number): 'Selamat pagi'|'Selamat siang'|'Selamat sore'|'Selamat malam'` (<11 pagi, <15 siang, <18 sore, sisanya malam; sama seperti PANTRA); `<MicButton onPress />` (bulat 52px, warna aksen, menonjol di tengah tab bar).

Beranda (mengikuti mockup `dua-mode.html`): sapaan + nama; HeroCard "SISA UANG · SEMUA DOMPET" `formatRupiah(sisaUang)` + "Kekayaan bersih …"; WalletChips (dompet harian aktif, `formatRingkas`); kartu "Bulan ini" (masuk dengan warna aksen, keluar); 5 transaksi terbaru + "Semua ›" ke Riwayat. Mic → `router.push('/catat')`.

Catat manual: pilihan jenis (Pengeluaran / Pemasukan / Transfer), AmountInput, kategori (chip dari `useCategories`), dompet (+ dompet tujuan untuk transfer, tanpa dompet asal), tanggal (default hari ini, zona waktu profil), catatan. Id dibuat sekali saat layar dibuka (`newTxId`) dan dipakai ulang untuk semua percobaan simpan. Gagal → tampilkan `AppError.pesan`, isian tetap utuh.

- [ ] **Step 1:** Tes: `sapaan(10)`='Selamat pagi', `sapaan(14)`='Selamat siang', `sapaan(17)`='Selamat sore', `sapaan(21)`='Selamat malam'. HeroCard dengan data Rafli menampilkan "Rp288.000". Catat: Simpan dengan RPC yang di-mock gagal offline → pesan offline tampil, nominal masih terisi; Simpan kedua mengirim id yang sama. → FAIL.
- [ ] **Step 2:** Implementasi → PASS.
- [ ] **Step 3:** Commit `feat(ui): beranda dan catat manual`.

### Task 10: Riwayat (lihat, filter, ubah, hapus)

**Files:**
- Create: `app/(tabs)/riwayat.tsx`, `app/transaksi/[id].tsx`, `src/lib/filterTx.ts`
- Test: `src/lib/__tests__/filterTx.test.ts`, `app/__tests__/riwayat.test.tsx`

**Interfaces:**
- Consumes: `useTransactions`, `useUpdateTransaction`, `useDeleteTransaction`, `TxRow`.
- Produces: `filterTx(txs: Tx[], f: { jenis?: Jenis; kategori?: string; walletId?: string }): Tx[]` (walletId cocok dengan `wallet_id` atau `wallet_tujuan_id`).

Riwayat: pemilih bulan (‹ Nov 2026 ›), chip filter, daftar dikelompokkan per tanggal dengan total harian. Ketuk → `transaksi/[id]` memakai formulir yang sama dengan Catat (komponen dibagi), plus tombol Hapus dengan konfirmasi "Hapus transaksi ini? Saldo dompet akan dihitung ulang."

- [ ] **Step 1:** Tes `filterTx` (transfer cash→spay muncul untuk filter `spay`); tes layar: hapus → konfirmasi → mutasi delete dipanggil dengan id itu. → FAIL.
- [ ] **Step 2:** Implementasi → PASS.
- [ ] **Step 3:** Commit `feat(ui): riwayat transaksi`.

### Task 11: Akun (dompet, sesuaikan saldo, tema, keluar)

**Files:**
- Create: `app/(tabs)/akun.tsx`, `app/dompet/[id].tsx`, `app/dompet/baru.tsx`, `src/domain/adjust.ts`
- Test: `src/domain/__tests__/adjust.test.ts`, `app/__tests__/dompet.test.tsx`

**Interfaces:**
- Consumes: Task 3, 5, 7.
- Produces:
  - `adjustmentFor(saldoSekarang: number, saldoBaru: number): number | null` → selisih (boleh negatif), `null` jika sama.
  - `canArchive(saldo: number): boolean` → `saldo === 0`.

Akun: daftar dompet per tipe (harian/darurat/investasi) dengan saldo; Tambah dompet (nama, tipe, saldo awal, target untuk darurat); detail dompet: ubah nama, **Sesuaikan saldo** (isi saldo sebenarnya → simpan transaksi `penyesuaian` sebesar `adjustmentFor`, kategori `penyesuaian`, catatan "Penyesuaian saldo"), Arsipkan (ditolak jika `!canArchive`, pesan "Pindahkan dulu saldonya ke dompet lain"). Pilihan tampilan Sistem/Terang/Gelap (`setPref`). Tombol Keluar.

- [ ] **Step 1:** Tes `adjustmentFor(152000,150000) = -2000`, `adjustmentFor(100,100) = null`, `canArchive(0) = true`, `canArchive(5000) = false`; tes layar: arsip dompet bersaldo menampilkan pesan dan tidak memanggil update. → FAIL.
- [ ] **Step 2:** Implementasi → PASS.
- [ ] **Step 3:** Commit `feat(ui): akun, dompet, tema`.

### Task 12: Build development APK + uji di HP

**Files:**
- Create: `eas.json` (profil `development`: developmentClient, distribution internal, android buildType apk), `app.json` (package `com.keuanganapp.dev` sementara, ikon placeholder, `userInterfaceStyle: "automatic"`)
- Create: `docs/uji-manual-rencana-1.md`

- [ ] **Step 1:** `npm test` dan `npm run test:integration` → semua PASS; `npm run typecheck` bersih.
- [ ] **Step 2:** Rafli menjalankan `npx eas login` sendiri, lalu `npx eas build -p android --profile development`. Hasilnya APK; pasang di HP.
- [ ] **Step 3:** Jalankan daftar uji manual dan centang hasilnya di `docs/uji-manual-rencana-1.md`:
  - masuk dengan email OTP
  - onboarding dengan GoPay 152.000, Cash 106.000, ShopeePay 30.000 → Beranda "Rp288.000"
  - catat "rokok 25rb GoPay" → Beranda Rp263.000, chip GoPay 127rb
  - transfer Cash→ShopeePay 10.000 → total tetap
  - mode pesawat → Simpan → pesan offline; nyalakan lagi → Simpan → hanya 1 transaksi
  - Riwayat: ubah nominal, hapus
  - sesuaikan saldo GoPay
  - ganti tema Terang/Gelap/Sistem
  - keluar lalu masuk lagi → data tetap ada
- [ ] **Step 4:** Commit `chore: build dev + uji manual rencana 1`.
