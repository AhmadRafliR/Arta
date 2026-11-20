# Rencana 5: Langganan, pengingat push, ekspor, hapus akun, rilis Play Store — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** arta siap dirilis di Play Store dengan model gratis + Pro:
- pengguna bisa mencoba Pro 14 hari lalu berlangganan lewat Google Play;
- pengguna Pro bisa mendapat pengingat jatuh tempo hutang lewat push dan mengekspor datanya ke Excel/CSV;
- pengguna bisa menghapus akunnya beserta semua datanya, baik dari app maupun dari web;
- konfigurasi build/submit dan checklist rilis siap, sehingga yang tersisa hanya langkah yang wajib dilakukan Rafli sendiri.

**Architecture:**
- **Langganan:**
  - App berbicara ke RevenueCat (`react-native-purchases`) lewat antarmuka `PenyediaLangganan`. Antarmuka ini punya implementasi mock untuk dev/tes, sehingga paywall bisa diuji tanpa akun RevenueCat atau Play Console.
  - Sumber kebenaran status Pro tetap ada di server, yaitu tabel `entitlements`. Tabel ini ditulis Edge Function `revenuecat-webhook` dengan service role.
  - App membaca status lewat RPC `status_langganan()`.
- **Push:**
  - App mendaftarkan Expo push token ke `push_tokens` lewat RPC.
  - Edge Function `debt-reminders` dijalankan `pg_cron` tiap jam. Fungsi ini memilih pengguna Pro yang pengingatnya aktif dan jam lokalnya cocok, mengambil tagihan lewat kontrak RPC `tagihan_untuk_pengingat` (disediakan Rencana 3), lalu mengirim lewat Expo Push API.
  - Logika murni ada di `_shared/pengingat.ts`.
- **Ekspor:** dibuat di app (data sudah bisa dibaca lewat RLS).
  - Registri sumber ekspor ada di satu tempat (`src/ekspor/sumber.ts`).
  - Penulis CSV dan XLSX minimal (zip store + CRC32) ditulis tanpa dependensi.
  - File ditulis dengan `expo-file-system` (API `File`/`Paths`) lalu dibagikan dengan `expo-sharing`.
- **Hapus akun:**
  - Edge Function `delete-account` memverifikasi token pengguna, menghapus subscriber RevenueCat (opsional), lalu `auth.admin.deleteUser`. Semua tabel pengguna ikut terhapus lewat `on delete cascade`.
  - RPC audit `audit_fk_pengguna()` dan `sisa_data_pengguna()` menemukan tabel pengguna (termasuk tabel rencana 3/4) secara otomatis dari katalog, sehingga tabel baru yang lupa diberi cascade ketahuan di tes integrasi.
  - Halaman web statis `web/hapus-akun.html` memakai alur OTP email yang sama.
- **Rilis:**
  - `app.config.ts` membaca `app.json` dan hanya menimpa nama/paket per varian (`APP_VARIANT`).
  - `eas.json` diberi profil production (AAB, autoIncrement, submit ke track internal sebagai draft).
  - Checklist di `docs/rilis-play-store.md`.

**Tech Stack:**
- Expo SDK 58: `expo-notifications` ~58.1, `expo-sharing` ~58.0, `expo-file-system` ~58.0 (API baru `File`/`Paths`), `expo-device`, `expo-constants`.
- `react-native-purchases` (RevenueCat), Supabase Edge Functions (Deno), Postgres (`pg_cron` + `pg_net` hanya di panduan, bukan di migrasi).
- Jest + RNTL v14, tes integrasi DB.

**Spec:** `docs/spec.md`
- §5.1 (gratis vs Pro, uji coba 14 hari, harga usulan Rp19.000/bulan + tahunan)
- §5.3 layar 6 (Akun: langganan, ekspor, kebijakan privasi, hapus akun) dan 8 (paywall)
- §5.4 (RevenueCat → `entitlements`, Edge Functions `debt-reminders`, `revenuecat-webhook`, `export`, `delete-account`, `pg_cron`)
- §5.5 (`entitlements`, `push_tokens`)
- §5.8 (hapus akun dari app dan web)
- §5.9 (Pro berakhir → data utuh)
- §6 (format ekspor, halaman web statis)
- §3/§4 (kebijakan Play: billing, privasi, Data Safety, deklarasi keuangan, uji tertutup)

Acuan visual: `docs/design/arta/premium-trial.html` (layar Premium), komponen `MarkPremium`, `BadgeTier`, `Tombol`, `KeadaanKosong`, dan token `src/theme/tokens.ts`.

## Keputusan (diambil Claude; Rafli sedang tidak di tempat, bisa dikoreksi)

| # | Keputusan | Alasan |
|---|---|---|
| K1 | RevenueCat sesuai spec, di balik antarmuka `PenyediaLangganan` + `MockPenyedia`. Tanpa `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, build dev memakai mock; build rilis tanpa kunci menampilkan "Langganan belum tersedia" dan tidak crash. | Akun RevenueCat/Play belum ada dan tidak boleh dibuat oleh Claude, tetapi paywall tetap harus bisa diuji. |
| K2 | Entitlement RevenueCat bernama **`pro`**. Paket offering `$rc_monthly` dan `$rc_annual`. Uji coba 14 hari dipasang sebagai *free trial offer* di base plan Google Play, bukan di kode. | Konvensi RevenueCat. Trial dari Play menjamin pengguna tidak bisa mengulang trial. |
| K3 | `app_user_id` RevenueCat = `auth.users.id` (UUID) lewat `Purchases.logIn`. Webhook mengabaikan event yang tidak berisi UUID (anonim). | Webhook harus bisa memetakan event ke pengguna tanpa tabel tambahan. |
| K4 | Webhook bersifat idempoten dan tahan urutan: event diterapkan hanya bila `event_timestamp_ms` ≥ yang tersimpan. `pro = type ≠ EXPIRATION && (expiration_at_ms null \|\| > sekarang)`. CANCELLATION/BILLING_ISSUE/PAUSED tetap Pro sampai kedaluwarsa. TRANSFER mencabut Pro dari `transferred_from`. | RevenueCat bisa mengirim ulang atau mengirim event tidak berurutan. Refund datang sebagai CANCELLATION dengan kedaluwarsa lampau. |
| K5 | Webhook diautentikasi header `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` (perbandingan waktu-konstan) dan `verify_jwt = false`. | RevenueCat mendukung header otorisasi kustom; webhook tidak membawa JWT Supabase. |
| K6 | Pengingat: pengguna memilih **Hari H / H-1 / H-3** dan jam kirim (default **H-1, 08.00**, aktif). Tagihan yang jatuh tempo pada hari target **dan** hari H dikirim, sehingga maksimal 2 pengingat per tagihan. Satu notifikasi per pengguna per putaran; beberapa tagihan digabung. Dedup lewat `log_pengingat`. | Pengingat yang terlalu sering membuat orang mematikan notifikasi. Cron bisa berjalan ulang. |
| K7 | Data tagihan diambil lewat **kontrak RPC** `tagihan_untuk_pengingat(p_user uuid, p_tanggal date[])` yang **dibuat Rencana 3**. Bila RPC belum ada (PGRST202), fungsi mencatat log dan mengirim 0 pesan. | Tabel `debts`/`debt_schedule` belum ada di branch ini; skemanya tidak ditebak. |
| K8 | `pg_cron`/`pg_net` dan jadwal cron **tidak** dimasukkan ke migrasi, tetapi ke panduan (SQL yang dijalankan Rafli). | Butuh ekstensi, URL project, dan secret vault yang berbeda per project; migrasi yang gagal di `db push` menghalangi rencana lain. |
| K9 | Ekspor dibuat **di app**, bukan di Edge Function `export`. **XLSX** berisi semua data, satu sheet per sumber. **CSV** hanya berisi transaksi (UTF-8 BOM, koma, CRLF). Penulis XLSX minimal ditulis sendiri tanpa dependensi. Sel teks yang diawali `= + - @` diberi awalan `'` (anti formula injection). Rentang yang bisa dipilih: Semua / Tahun ini / Bulan ini. | Data sudah bisa dibaca lewat RLS, jadi tidak perlu biaya server. XLSX dibuka benar di Excel lokal Indonesia (pemisah `;`) dan Google Sheets. Gerbang Pro di sisi app cukup karena datanya milik pengguna sendiri. |
| K10 | Hapus akun = `auth.admin.deleteUser` (hard delete). Semua tabel pengguna wajib `references auth.users on delete cascade`, dan ini dijaga RPC audit + tes integrasi. Langganan Google Play **tidak** ikut batal: app memperingatkan dan menautkan ke halaman langganan Play. Konfirmasi dengan mengetik `HAPUS`. | Satu sumber kebenaran, dan tabel rencana 3/4 otomatis tercakup. Langganan Play hanya bisa dibatalkan pengguna atau lewat API Play. |
| K11 | Web hapus akun: `web/hapus-akun.html` statis, supabase-js dari CDN dengan versi terkunci, OTP email dengan `shouldCreateUser: false`, lalu memanggil `delete-account`. Ada juga `web/kebijakan-privasi.html` (draf). Di-host gratis (GitHub Pages/Netlify) oleh Rafli. | Play mewajibkan tautan web untuk penghapusan akun. |
| K12 | Paket rilis **`id.arta.keuangan`** (nama "arta"); varian dev tetap `com.keuanganapp.dev` (nama "arta dev"). Varian dipilih lewat `APP_VARIANT` di `eas.json`. `app.json` tetap menjadi sumber utama; `app.config.ts` hanya menimpa sedikit. | Paket tidak bisa diganti setelah upload pertama. Dev dan rilis bisa terpasang berdampingan. Perubahan kecil pada `app.json` menghindari bentrok dengan sesi desain/rencana 2. Rafli wajib mengonfirmasi ID paket sebelum upload pertama (checklist). |
| K13 | `google-services.json` **tidak** dipasang di `app.json` sekarang karena filenya belum ada dan prebuild akan gagal. `app.config.ts` memasangnya otomatis bila file `./google-services.json` ada. | Konfigurasi tetap bisa dibangun sebelum Firebase disiapkan. |
| K14 | Logout melepas push token perangkat (`hapus_push_token`) sebelum `signOut`, dan `push_tokens.token` adalah primary key. Mendaftar ulang memindahkan token ke pengguna baru. | Pengingat akun lama tidak boleh muncul di HP yang sudah dipakai akun lain. |

## Global Constraints

- Semua aturan Rencana 1 & 2 tetap berlaku:
  - uang integer rupiah, format `Rp288.000`;
  - teks UI bahasa Indonesia;
  - setiap `<Text`/`<TextInput` wajib `font-sans`;
  - aksen hanya untuk tombol utama/progres;
  - RLS `user_id = (select auth.uid())`.
- **Migrasi** mulai `20261120000040`. Rentang di bawahnya milik rencana 2–4. Migrasi tidak di-push oleh Claude; tes integrasi ditulis tetapi baru dijalankan setelah Rafli `npx supabase db push --remote`.
- **Edge Function:**
  - logika murni di `supabase/functions/_shared/*.ts` (tanpa API Deno, dites Jest);
  - `<nama>/index.ts` hanya penyambung (dikecualikan dari tsc);
  - tidak ada deploy.
- **Tidak ada push sungguhan, build EAS, submit, atau update.** Pengirim Expo Push selalu disuntikkan di tes.
- **Rahasia** (`REVENUECAT_WEBHOOK_SECRET`, `REVENUECAT_SECRET_KEY`, `CRON_SECRET`, kunci service role) hanya di secret Supabase, tidak pernah di repo atau app. Kunci publik RevenueCat (`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`) boleh di env app.
- **Paket native baru** (`expo-notifications`, `react-native-purchases`, `expo-sharing`) mengharuskan APK dev dibangun ulang (dicatat di panduan uji). Paket dipasang dengan `npx expo install`.
- **Kerja paralel:** subagent tidak commit dan hanya menyentuh file di task-nya. Orkestrator meng-commit per task. `app/_layout.tsx`, `app/(tabs)/akun.tsx`, `src/auth/*`, `app.json`, dan `supabase/config.toml` hanya diubah orkestrator (Task 0/1/9).
- **Sebelum setiap commit:** `npx jest` (tes terkait) dan `npx tsc --noEmit`. Di akhir: `npx expo lint`.

## Review Focus

1. **Status Pro hanya dari server.** Mock tidak pernah membuat pengguna menjadi Pro di server. Event webhook lama tidak menimpa yang baru. Refund dan kedaluwarsa mencabut Pro. Tes di Task 1 dan Task 2.
2. **Hapus akun menghapus semuanya,** termasuk tabel yang dibuat rencana lain (audit katalog). Tidak bisa dipicu tanpa token valid dan konfirmasi `HAPUS`. Pengguna Pro diperingatkan bahwa langganan Play tidak otomatis batal. Tes di Task 1 dan Task 7.
3. **Push tidak bocor antar akun** (K14). Pengguna non-Pro atau yang pengingatnya mati tidak dikirimi. Cron yang berjalan dua kali tidak mengirim dua kali. Token `DeviceNotRegistered` dihapus. Tes di Task 1, Task 4, dan Task 5.
4. **Ekspor benar dan aman:** lebih dari 1000 baris (paginasi), koma/kutip/baris baru di catatan, formula injection, nominal sebagai angka, dan XLSX valid (CRC benar). Tes di Task 6.
5. **Tanpa kunci/kredensial,** app dev tetap jalan (mock), rilis tidak crash, dan fungsi menolak permintaan tanpa secret. Tes di Task 2, Task 3, dan Task 5.

## Titik integrasi dengan rencana lain

- **Rencana 2:**
  - Kartu "kuota habis" di `app/rekam.tsx` (teks "Pro … segera hadir") diganti tombol "Lihat Pro" → `router.push('/premium?dari=kuota')`.
  - `kuota_ai()` sudah membaca `entitlements`; logika pro di sana sama dengan `public.pro_aktif()` (Task 1), dan bisa disatukan nanti.
- **Rencana 3:**
  - Buat RPC `public.tagihan_untuk_pengingat(p_user uuid, p_tanggal date[]) returns table (tagihan_id uuid, debt_id uuid, pemberi text, jatuh_tempo date, nominal bigint)`:
    - hanya tagihan `status = 'belum'` milik `p_user` dengan `jatuh_tempo = any(p_tanggal)` dari hutang yang tidak diarsip;
    - `security definer`, `set search_path = ''`, `grant execute` hanya ke `service_role`.
  - Layar Hutang boleh menampilkan `<PengaturanPengingat>` (Task 4).
  - Tabel `debts`/`debt_schedule` wajib `user_id ... references auth.users on delete cascade` (dicek `audit_fk_pengguna`).
  - Tambahkan sumber ekspor `hutang` dan `jadwal_hutang` di `src/ekspor/sumber.ts`.
- **Rencana 4:**
  - Tambahkan sumber ekspor `budget` (dan penerima laporan bila perlu) di `src/ekspor/sumber.ts`.
  - Tabel baru wajib cascade.
  - Edge Function laporan memakai `public.pro_aktif(user)` untuk gerbang Pro.
- **Desain:** layar Premium mengikuti `premium-trial.html`; tidak ada reformat massal.

---

### Task 0: Paket native & konfigurasi dasar (orkestrator)

**Files:** `package.json`, `package-lock.json`, `app.json` (plugin `expo-notifications`), `supabase/config.toml` (`[functions.*]`)

- [ ] `npx expo install expo-notifications expo-sharing react-native-purchases`.
- [ ] Tambahkan plugin `["expo-notifications", { "color": "#0B424F", "defaultChannel": "pengingat" }]` ke `app.json`. Ikon notifikasi putih 96×96 menyusul (checklist).
- [ ] Tambahkan blok `[functions.revenuecat-webhook] verify_jwt = false`, `[functions.debt-reminders] verify_jwt = false`, dan `[functions.delete-account] verify_jwt = true` ke `supabase/config.toml`.
- [ ] Tambahkan mock Jest global untuk `react-native-purchases`, `expo-notifications`, dan `expo-sharing` di `jest.setup.js`.
- [ ] Commit `chore: pasang expo-notifications, expo-sharing, react-native-purchases`.

### Task 1: Migrasi langganan, push, audit hapus akun + hook status (orkestrator)

**Files:**
- Create: `supabase/migrations/20261120000040_langganan.sql`, `20261120000041_push_pengingat.sql`, `20261120000042_audit_hapus_akun.sql`, `src/data/langganan.ts`
- Test: `tests/integration/langganan.test.ts`, `tests/integration/push_pengingat.test.ts`, `tests/integration/hapus_akun.test.ts`, `src/data/__tests__/langganan.test.tsx`

**Interfaces (SQL):**
- **0040 — langganan:**
  - `entitlements` + kolom `produk text`, `periode text check (periode in ('normal','trial','intro'))`, `akan_diperpanjang boolean`, `event_terakhir_ms bigint`, `diperbarui_at timestamptz default now()`.
  - `public.pro_aktif(p_user uuid) returns boolean`: stable, security definer; hanya untuk `service_role`.
  - `public.status_langganan() returns jsonb`: `{pro, berlaku_sampai, periode, produk, akan_diperpanjang}` untuk `authenticated` (auth.uid()); `pro` sama dengan aturan `kuota_ai`.
  - `public.terapkan_event_langganan(p_user uuid, p_pro boolean, p_berlaku_sampai timestamptz, p_produk text, p_periode text, p_akan_diperpanjang boolean, p_event_ms bigint, p_sumber text) returns boolean`: upsert hanya bila `event_terakhir_ms is null or p_event_ms >= event_terakhir_ms`; kembalikan apakah diterapkan. Hanya `service_role`.
- **0041 — push & pengingat:**
  - `push_tokens (token text primary key, user_id uuid not null default auth.uid() references auth.users on delete cascade, platform text not null check (platform in ('android','ios','web')), diperbarui_at timestamptz not null default now())`. RLS: select/delete milik sendiri. `authenticated` tidak punya grant insert/update.
  - `simpan_push_token(p_token text, p_platform text) returns void`: security definer, upsert dengan `user_id = auth.uid()` (memindahkan token); token harus `ExponentPushToken[...]`/`ExpoPushToken[...]` dan ≤ 200 karakter.
  - `hapus_push_token(p_token text) returns void`: hanya token milik sendiri.
  - `pengaturan_pengingat (user_id uuid primary key default auth.uid() references auth.users on delete cascade, aktif boolean not null default true, hari_sebelum smallint not null default 1 check (hari_sebelum in (0,1,3)), jam smallint not null default 8 check (jam between 0 and 23), diperbarui_at timestamptz not null default now())`. RLS select/insert/update milik sendiri.
  - `log_pengingat (user_id uuid references auth.users on delete cascade, kunci text, dikirim_at timestamptz default now(), primary key (user_id, kunci))`. Hanya `service_role`.
  - `penerima_pengingat() returns table (user_id uuid, tokens text[], hari_sebelum smallint, jam smallint, zona_waktu text)`: pengguna Pro yang punya ≥1 token dan pengaturan aktif (tanpa baris = default aktif H-1 08.00). Hanya `service_role`.
- **0042 — audit hapus akun:**
  - `audit_fk_pengguna() returns table (tabel text)`: tabel `public` yang punya kolom `user_id` tetapi tanpa FK `user_id → auth.users` ber-`on delete cascade`. Tabel `profiles` dicek lewat `id`.
  - `sisa_data_pengguna(p_user uuid) returns table (tabel text, jumlah bigint)`: dinamis lewat `information_schema`, hanya baris > 0.
  - Keduanya hanya `service_role`.

**Interfaces (app):**
- `src/data/langganan.ts`:
  - `type StatusLangganan = { pro: boolean; berlakuSampai: string | null; periode: 'normal'|'trial'|'intro'|null; produk: string|null; akanDiperpanjang: boolean|null }`
  - `useStatusLangganan()`: query `['langganan']` → `rpc('status_langganan')`
  - `usePro(): { pro: boolean; memuat: boolean }`
  - `muatUlangLangganan(qc)`: invalidasi `['langganan']` dan `['kuota-ai']`.

- [ ] Tulis tes integrasi:
  - `status_langganan` pengguna baru → `pro:false`;
  - `terapkan_event_langganan` oleh `authenticated` → ditolak; lewat service role → pro; event lebih lama tidak menimpa;
  - `simpan_push_token` memindahkan token antar pengguna; B tidak bisa membaca/menghapus token A; token tidak valid → galat;
  - `penerima_pengingat` hanya Pro + token + aktif;
  - `audit_fk_pengguna()` kosong;
  - setelah `admin.deleteUser`, `sisa_data_pengguna` kosong.
- [ ] Tulis tes Jest hook (supabase di-mock), lalu tulis migrasi + hook.
- [ ] Commit `feat(db): langganan, push token, pengingat, audit hapus akun`.

### Task 2: Edge Function `revenuecat-webhook` (subagent, paralel)

**Files:** Create `supabase/functions/_shared/revenuecat.ts`, `supabase/functions/revenuecat-webhook/index.ts`, `supabase/functions/revenuecat-webhook/deno.json`; Test `supabase/functions/_shared/__tests__/revenuecat.test.ts`

**Interfaces:**
- `tafsirkanEvent(body: unknown, sekarangMs: number, entitlement = 'pro'): Perubahan[] | { abaikan: string }`, dengan `Perubahan = { userId; pro; berlakuSampai: string|null; produk; periode; akanDiperpanjang; eventMs; sumber: 'revenuecat'|'revenuecat_sandbox' }` (sesuai K3/K4).
- `buatHandlerWebhook(deps: { rahasia: string; terapkan(p: Perubahan): Promise<boolean>; sekarang(): number })`:
  - 405 bila bukan POST;
  - 401 bila secret salah atau kosong;
  - 400 bila JSON rusak;
  - 200 `{diterapkan: n, diabaikan?: alasan}`;
  - 500 bila `terapkan` melempar, supaya RevenueCat mencoba ulang.
- `index.ts`: service role client → `rpc('terapkan_event_langganan', …)`.

- [ ] Tes:
  - INITIAL_PURCHASE trial (period_type TRIAL) → pro, periode `trial`;
  - RENEWAL;
  - CANCELLATION dengan kedaluwarsa masa depan → pro, `akanDiperpanjang:false`;
  - CANCELLATION refund (kedaluwarsa lampau) → bukan pro;
  - EXPIRATION → bukan pro;
  - TEST → abaikan;
  - `app_user_id` `$RCAnonymousID:…` dengan alias UUID → pakai alias; tanpa UUID → abaikan;
  - `entitlement_ids` tanpa `pro` → abaikan;
  - TRANSFER → cabut `transferred_from`;
  - environment SANDBOX → sumber sandbox;
  - secret salah → 401 dan `terapkan` tidak dipanggil;
  - `terapkan` melempar → 500.
- [ ] Jest + tsc PASS. Orkestrator commit `feat(langganan): webhook revenuecat`.

### Task 3: Lapisan langganan app + layar Premium (subagent, paralel)

**Files:**
- Create: `src/langganan/tipe.ts`, `src/langganan/revenuecat.ts`, `src/langganan/mock.ts`, `src/langganan/penyedia.ts`, `src/langganan/LanggananProvider.tsx`, `src/langganan/useBeli.ts`, `app/premium.tsx`
- Test: `src/langganan/__tests__/*.test.ts(x)`, `src/__tests__/screens/premium.test.tsx`

**Interfaces:**
- `type Paket = { id: string; jenis: 'bulanan'|'tahunan'|'lain'; harga: string; hargaPerBulan: string|null; ujiCobaHari: number|null }`
- `type HasilBeli = { status: 'sukses'|'batal'|'tertunda'|'galat'; pesan?: string }`
- `interface PenyediaLangganan { nama: 'revenuecat'|'mock'|'tidak-tersedia'; masuk(userId: string): Promise<void>; keluar(): Promise<void>; paket(): Promise<Paket[]>; beli(paketId: string): Promise<HasilBeli>; pulihkan(): Promise<HasilBeli>; urlKelola(): Promise<string|null> }`
- `pilihPenyedia({ apiKey, platform, dev })`:
  - ada kunci & android → RevenueCat;
  - tanpa kunci & dev → mock;
  - selain itu → `tidak-tersedia` (semua aksi mengembalikan galat ramah).
- `LanggananProvider`: memanggil `masuk(session.user.id)`/`keluar()` saat sesi berubah; `useLangganan()` → penyedia.
- `useBeli()` → `{ beli, pulihkan, sibuk, pesan }`. Setelah sukses, `muatUlangLangganan` dan polling `['langganan']` tiap 3 detik maksimal 10× sampai `pro` (webhook bisa terlambat). Bila belum aktif, tampil `'Pembayaran diterima. Status Pro akan aktif dalam beberapa menit.'`
- `/premium` (modal, parameter opsional `dari`), mengikuti `premium-trial.html`:
  - crest `MarkPremium`, judul "Coba Premium", besar "14 hari", sub teks;
  - tabel banding "Tanpa Pro" vs "Pro" (baris spec §5.1);
  - pilihan paket (chip bulanan/tahunan + harga dari toko);
  - tombol utama "Mulai uji coba 14 hari" bila paket ber-trial, selain itu "Langganan {harga}";
  - catatan ketentuan Google Play, "Batalkan kapan saja, tanpa biaya.", dan tautan "Pulihkan pembelian";
  - sudah Pro → kartu "Pro aktif" (+ "Uji coba sampai {tanggal}" bila trial) dan tombol "Kelola langganan" (`urlKelola()` atau `https://play.google.com/store/account/subscriptions`);
  - mode mock → label kecil "Mode uji: pembayaran tidak sungguhan".

- [ ] Tes:
  - `pilihPenyedia` ketiga cabang;
  - adapter RevenueCat (modul di-mock): `userCancelled` → `batal`, paket `$rc_monthly` → `bulanan` dengan `ujiCobaHari` 14 dari `introPrice`/`subscriptionOptions` free phase;
  - layar: harga tampil, tombol trial memanggil `beli`, batal tidak menampilkan galat, sudah Pro menampilkan "Kelola langganan", `tidak-tersedia` menampilkan pesan;
  - polling berhenti saat pro.
- [ ] Orkestrator commit `feat(langganan): penyedia revenuecat/mock dan layar premium`.

### Task 4: Push di app + pengaturan pengingat (subagent, paralel)

**Files:**
- Create: `src/notifikasi/push.ts`, `src/notifikasi/penangan.ts`, `src/data/pengingat.ts`, `src/components/PengaturanPengingat.tsx`
- Test: `src/notifikasi/__tests__/push.test.ts`, `src/data/__tests__/pengingat.test.tsx`, `src/components/__tests__/PengaturanPengingat.test.tsx`

**Interfaces:**
- `SALURAN_PENGINGAT = 'pengingat'`; `siapkanSaluran()` (Android, `AndroidImportance.HIGH`, nama "Pengingat jatuh tempo").
- `daftarkanPush(): Promise<{status:'aktif'; token: string} | {status:'ditolak'} | {status:'tidak-didukung'; alasan: string}>`:
  - urutan langkah: `Device.isDevice` → saluran → izin (`getPermissionsAsync`, lalu `requestPermissionsAsync` bila perlu) → `getExpoPushTokenAsync({ projectId })` dengan `projectId` dari `Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId` → `rpc('simpan_push_token')`;
  - token disimpan di AsyncStorage `arta.pushToken`.
- `lepasPush()`: `rpc('hapus_push_token', { p_token })` dengan token tersimpan; galat ditelan; hapus kunci storage.
- `pasangPenangan(router)`:
  - `setNotificationHandler` (`shouldShowBanner/List: true, shouldPlaySound: true, shouldSetBadge: false`);
  - listener respons → `router.push(data.url)` hanya bila `url` diawali `/`;
  - kembalikan fungsi cleanup.
- `usePengaturanPengingat()`: query `['pengingat']`, select `pengaturan_pengingat`; tanpa baris → default `{aktif:true, hari_sebelum:1, jam:8}`.
- `useSimpanPengingat()`: upsert.
- `<PengaturanPengingat pro onBukaPremium />`:
  - non-Pro → baris terkunci "Pengingat jatuh tempo · Pro" → `onBukaPremium`;
  - Pro → `Switch` aktif, chip "Hari H"/"H-1"/"H-3", dan chip jam 07.00/08.00/12.00/19.00;
  - menyalakan → `daftarkanPush()`; ditolak → `'Izin notifikasi ditolak. Buka Pengaturan untuk mengizinkan.'` + "Buka Pengaturan"; tidak didukung (emulator/web) → alasan.

- [ ] Tes:
  - izin granted → token disimpan via RPC;
  - izin ditolak → `ditolak` tanpa RPC;
  - bukan perangkat → `tidak-didukung`;
  - `lepasPush` memanggil RPC dengan token tersimpan;
  - penangan hanya mengikuti `url` relatif;
  - komponen: non-Pro terkunci, toggle memanggil daftar + simpan, chip H-3 menyimpan `hari_sebelum: 3`.
- [ ] Orkestrator commit `feat(notifikasi): daftar push dan pengaturan pengingat`.

### Task 5: Edge Function `debt-reminders` (subagent, paralel)

**Files:** Create `supabase/functions/_shared/pengingat.ts`, `supabase/functions/debt-reminders/index.ts`, `supabase/functions/debt-reminders/deno.json`; Test `supabase/functions/_shared/__tests__/pengingat.test.ts`

**Interfaces:**
- Tipe:
  - `Penerima = { userId; tokens: string[]; hariSebelum: 0|1|3; jam: number; zona: string|null }`
  - `Tagihan = { tagihanId; debtId; pemberi; jatuhTempo: string; nominal: number }`
  - `PesanExpo = { to: string; title; body; data: { url: '/hutang' }; channelId: 'pengingat'; priority: 'high'; sound: 'default' }`
- `jamLokal(sekarang, zona)` dan `tanggalLokal(sekarang, zona, tambahHari)`: zona tidak valid → Asia/Jakarta.
- `tanggalTarget(p, sekarang)`: `[hari ini + hariSebelum, hari ini]` (unik).
- `susunPesan(p, tagihan, hariIni)`:
  - teks untuk 1 tagihan: `'Tagihan {pemberi} {besok|hari ini|3 hari lagi}'` / `'{Rp…} jatuh tempo {Kamis, 21 Nov}.'`;
  - teks untuk beberapa tagihan: `'{n} tagihan jatuh tempo'` / `'Total {Rp…}. Terdekat: {pemberi} {kapan}.'`;
  - satu pesan per token.
- `kunciDedup(t, hariIni)` = `` `${t.tagihanId}:${t.jatuhTempo}:${hariIni}` ``.
- `buatHandlerPengingat(deps: { rahasia: string; penerima(): Promise<Penerima[]>; tagihan(userId, tanggal: string[]): Promise<Tagihan[] | null>; sudahDikirim(userId, kunci: string[]): Promise<Set<string>>; catatDikirim(userId, kunci: string[]): Promise<void>; kirim(pesan: PesanExpo[]): Promise<TiketExpo[]>; hapusToken(tokens: string[]): Promise<void>; sekarang(): Date })`:
  - header `Authorization: Bearer <CRON_SECRET>` wajib (401);
  - hanya penerima yang `jamLokal === jam` yang diproses;
  - `tagihan` → `null` berarti kontrak Rencana 3 belum tersedia; respons 200 `{dikirim:0, catatan:'tagihan_untuk_pengingat belum tersedia'}`;
  - kirim per potongan 100 pesan;
  - tiket `DeviceNotRegistered` → `hapusToken`;
  - `catatDikirim` hanya untuk pengguna yang minimal satu tiketnya `ok`;
  - respons `{diproses, dikirim, dilewati, tokenDihapus}`.
- `index.ts`:
  - service role;
  - `penerima` → `rpc('penerima_pengingat')`;
  - `tagihan` → `rpc('tagihan_untuk_pengingat', {p_user, p_tanggal})` (PGRST202 → null);
  - `log_pengingat` lewat tabel;
  - `kirim` → `fetch('https://exp.host/--/api/v2/push/send')` dengan `EXPO_ACCESS_TOKEN` opsional.

- [ ] Tes:
  - jam tidak cocok → tidak diproses;
  - H-1: tagihan besok → 1 pesan berteks "besok";
  - dua tagihan → digabung;
  - sudah dikirim → dilewati;
  - 230 pesan → 3 panggilan kirim;
  - DeviceNotRegistered → token dihapus;
  - kontrak null → 200 dengan catatan;
  - rahasia salah → 401;
  - zona `'Asia/Makassar'` menggeser jam.
- [ ] Orkestrator commit `feat(notifikasi): edge function pengingat jatuh tempo`.

### Task 6: Ekspor CSV/XLSX (subagent Opus, paralel)

**Files:**
- Create: `src/ekspor/csv.ts`, `src/ekspor/xlsx.ts`, `src/ekspor/zip.ts`, `src/ekspor/sumber.ts`, `src/ekspor/ambil.ts`, `src/ekspor/bagikan.ts`, `app/ekspor.tsx`
- Test: `src/ekspor/__tests__/*.test.ts`, `src/__tests__/screens/ekspor.test.tsx`

**Interfaces:**
- `zip.ts`: `crc32(bytes)`, `buatZip(berkas: {nama: string; isi: Uint8Array}[]): Uint8Array` (metode store, UTF-8 flag, tanpa kompresi).
- `xlsx.ts`: `type Sel = string|number|null`; `buatXlsx(sheet: {nama: string; baris: Sel[][]}[]): Uint8Array`.
  - Isinya `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/styles.xml` (header tebal), dan `xl/worksheets/sheetN.xml`.
  - Teks ditulis sebagai `inlineStr` yang di-escape XML, termasuk membuang karakter kontrol ilegal. Angka ditulis sebagai `<v>`.
  - Nama sheet dibersihkan dari `[]:*?/\`, maksimal 31 karakter, dan unik.
- `csv.ts`: `buatCsv(baris: Sel[][]): string` (BOM, CRLF, kutip RFC4180); `amankanSel(s)` (awalan `'` untuk `= + - @`, tab, CR; hanya teks).
- `sumber.ts`: `SUMBER_EKSPOR: SumberEkspor[]` dengan `SumberEkspor = { id; judul; tabel; select; urut: { kolom: string; naik: boolean }; filterTanggal?: string; kolom: { judul: string; nilai(baris, ctx): Sel }[] }`.
  - Sumber awal: `transaksi` (Tanggal, Jenis, Kategori, Nominal, Dompet, Dompet tujuan, Catatan, Sumber), `dompet` (Nama, Tipe, Saldo awal, Tanggal saldo awal, Target, Diarsip), `kategori`.
  - Komentar titik tambah untuk Rencana 3/4.
  - `ctx` berisi peta id → nama dompet.
- `ambil.ts`: `ambilSemua(tabel, select, urut, filter?)` dengan paginasi `.range()` per 1000 sampai halaman < 1000.
- `bagikan.ts`: `simpanDanBagikan(nama, isi: string|Uint8Array, mime)` lewat `new File(Paths.cache, nama)` (`create({overwrite:true})`, `write`) → `Sharing.isAvailableAsync` → `shareAsync(uri, {mimeType, dialogTitle:'Ekspor data arta'})`.
- `/ekspor` (modal):
  - pilih format "Excel (.xlsx), semua data" / "CSV, transaksi";
  - pilih rentang Semua / Tahun ini / Bulan ini (filter transaksi);
  - tombol "Ekspor";
  - non-Pro (`usePro`) → `KeadaanKosong` + "Lihat Pro" → `/premium?dari=ekspor`;
  - nama file `arta-ekspor-YYYY-MM-DD.xlsx|csv`.

- [ ] Tes:
  - `crc32('123456789') === 0xCBF43926`;
  - zip bisa di-parse ulang (header lokal + central directory cocok);
  - xlsx berisi entri yang diharapkan dan XML valid untuk teks `<&>"`;
  - csv kutip/baris baru/BOM;
  - formula injection;
  - paginasi 2500 baris → 3 panggilan;
  - layar: non-Pro terkunci; Pro → `shareAsync` dipanggil dengan mime xlsx.
- [ ] Orkestrator commit `feat(ekspor): ekspor xlsx dan csv`.

### Task 7: Hapus akun (function + layar + halaman web) (subagent, paralel)

**Files:**
- Create: `supabase/functions/_shared/hapusAkun.ts`, `supabase/functions/delete-account/index.ts`, `supabase/functions/delete-account/deno.json`, `src/data/akun.ts`, `app/hapus-akun.tsx`, `web/hapus-akun.html`, `web/kebijakan-privasi.html`, `web/README.md`
- Test: `supabase/functions/_shared/__tests__/hapusAkun.test.ts`, `src/data/__tests__/akun.test.ts`, `src/__tests__/screens/hapus-akun.test.tsx`

**Interfaces:**
- `buatHandlerHapusAkun(deps: { pengguna(token): Promise<string|null>; hapusRevenueCat(userId): Promise<void>; hapusPengguna(userId): Promise<void>; sisaData(userId): Promise<{tabel: string; jumlah: number}[]> })`:
  - OPTIONS → CORS;
  - POST dengan body `{konfirmasi:'HAPUS'}` wajib (400 `'Ketik HAPUS untuk konfirmasi.'`);
  - token tidak valid → 401;
  - `hapusRevenueCat` gagal → dicatat dan lanjut;
  - `hapusPengguna` gagal → 500 `'Akun belum terhapus, coba lagi.'`;
  - `sisaData` tidak kosong → log nama tabel saja dan tetap 200 (akun auth sudah hilang);
  - 200 `{terhapus:true}`.
- `index.ts`:
  - `pengguna` = `createClient(anon).auth.getUser(token)`;
  - `hapusPengguna` = service role `auth.admin.deleteUser(id)`;
  - `hapusRevenueCat` = `DELETE https://api.revenuecat.com/v1/subscribers/{id}` dengan `REVENUECAT_SECRET_KEY`, dilewati bila tidak diset;
  - `sisaData` = `rpc('sisa_data_pengguna')`.
- `src/data/akun.ts`: `hapusAkun(): Promise<void>` → `functions.invoke('delete-account', {body:{konfirmasi:'HAPUS'}})` (galat dipetakan seperti `ai.ts`), lalu `supabase.auth.signOut({ scope: 'local' })`.
- `/hapus-akun` (modal):
  - daftar yang akan dihapus (dompet, transaksi, kategori, hutang & jadwal, budget, pengaturan, kuota, token notifikasi, status langganan);
  - bila `usePro().pro` → kartu peringatan `'Menghapus akun tidak membatalkan langganan Google Play. Batalkan dulu di Play Store agar tidak ditagih lagi.'` + tombol "Kelola langganan";
  - `TextInput` "Ketik HAPUS";
  - tombol "Hapus akun permanen" (gaya `danger`, aktif hanya bila teks = `HAPUS`) → `hapusAkun()`;
  - sukses → `queryClient.clear()`, AuthGate mengarah ke layar masuk;
  - galat → pesan.
- Web:
  - `hapus-akun.html`:
    - satu file, token warna arta, supabase-js UMD dari jsdelivr dengan versi terkunci;
    - konstanta `SUPABASE_URL`/`SUPABASE_ANON_KEY` placeholder;
    - email → `signInWithOtp({email, options:{shouldCreateUser:false}})` → kode 6 digit → `verifyOtp` → ketik HAPUS → `functions.invoke('delete-account')`;
    - plus alternatif email kontak.
  - `kebijakan-privasi.html`: draf bahasa Indonesia mencakup:
    - data apa saja yang dikumpulkan (email, data keuangan yang diketik, audio diproses lalu dibuang, token push, status langganan);
    - pemroses: Supabase, OpenAI, RevenueCat, Google Play, Expo push;
    - tujuan, retensi, hak menurut UU PDP, cara hapus, kontak;
    - placeholder `[EMAIL KONTAK]` dan `[TANGGAL]`.

- [ ] Tes:
  - handler: tanpa token 401, konfirmasi salah 400, sukses memanggil urutan RevenueCat → hapus → sisa;
  - RevenueCat gagal tetap sukses;
  - hapus gagal 500;
  - `hapusAkun` memanggil invoke + signOut;
  - layar: tombol nonaktif sampai `HAPUS`, peringatan Pro tampil, sukses memanggil `hapusAkun`.
- [ ] Orkestrator commit `feat(akun): hapus akun dari app dan web`.

### Task 8: Konfigurasi rilis & checklist Play Store (subagent, paralel)

**Files:**
- Create: `app.config.ts`, `docs/rilis-play-store.md`, `docs/store/listing-id.md`
- Modify: `eas.json`

**Interfaces:**
- `app.config.ts`: `export default ({ config }: ConfigContext): ExpoConfig`.
  - Bila `APP_VARIANT === 'production'` → `name: 'arta'`, `android.package: 'id.arta.keuangan'`; selain itu name `'arta dev'` dan paket `com.keuanganapp.dev`.
  - Bila `./google-services.json` ada → `android.googleServicesFile`.
  - Field lain dari `app.json` tidak diubah.
- `eas.json`:
  - `development`/`preview`: `env.APP_VARIANT = development|preview` (preview memakai paket dev);
  - `production`: `env.APP_VARIANT=production`, `autoIncrement: true`, `buildType: app-bundle`;
  - `submit.production.android`: `{ track: 'internal', releaseStatus: 'draft' }`, dengan `serviceAccountKeyPath` dijelaskan di checklist dan tidak di-commit.
- `docs/rilis-play-store.md`: checklist bercentang, dikelompokkan menjadi "Sudah disiapkan Claude" dan "Harus dilakukan Rafli":
  - **akun & identitas:** akun Play Console pribadi + verifikasi identitas; konfirmasi ID paket `id.arta.keuangan`; cek PSE Lingkup Privat & OJK;
  - **Firebase/FCM:** project Firebase, `google-services.json` di root, unggah kunci FCM V1 lewat `eas credentials`;
  - **RevenueCat:**
    - project + app Android, kredensial service account Play di RevenueCat;
    - entitlement `pro`, produk langganan `arta_pro` dengan base plan bulanan Rp19.000 dan tahunan + free trial 14 hari, offering default `$rc_monthly`/`$rc_annual`;
    - webhook ke `https://<ref>.supabase.co/functions/v1/revenuecat-webhook` dengan header otorisasi;
    - kunci publik `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` di env EAS;
  - **Supabase:**
    - `db push`;
    - secrets `REVENUECAT_WEBHOOK_SECRET`, `REVENUECAT_SECRET_KEY`, `CRON_SECRET`, `EXPO_ACCESS_TOKEN` (opsional);
    - deploy 3 fungsi;
    - aktifkan `pg_cron` + `pg_net`, lalu SQL jadwal pengingat per jam (disertakan);
    - tes integrasi;
  - **halaman web:** host `web/` dan isi URL kebijakan privasi & hapus akun;
  - **listing toko:** judul, deskripsi pendek/panjang (`docs/store/listing-id.md`), ikon 512, feature graphic 1024×500, minimal 2 screenshot, kategori Keuangan;
  - **Play Console App content:** kebijakan privasi, akses app (akun uji untuk reviewer), iklan = tidak, rating konten, target audiens 18+, Data safety (jawaban disertakan per jenis data), deklarasi Financial features (personal finance / budgeting, bukan pinjaman), penghapusan akun (URL web), pemerintahan = tidak;
  - **build & uji:**
    - `npx eas-cli@latest build -p android --profile production`;
    - upload AAB pertama **manual** ke Internal testing;
    - license testing untuk penguji (pembelian sandbox);
    - Closed testing dengan ≥12 penguji selama ≥14 hari berturut-turut (cek angka di Console);
    - ajukan akses produksi;
    - submit lewat `eas submit`;
    - rollout bertahap.
- `docs/store/listing-id.md`: draf judul (≤30), deskripsi pendek (≤80), deskripsi panjang (≤4000), dan catatan "Apa yang baru".

- [ ] Verifikasi: `npx expo config --type public` sukses untuk varian default dan `APP_VARIANT=production` (paket benar). Jalankan `npx tsc --noEmit`.
- [ ] Orkestrator commit `chore(rilis): varian app, profil eas production, checklist play store`.

### Task 9: Integrasi Akun, rute, logout, panduan uji (orkestrator)

**Files:**
- Modify: `app/_layout.tsx`, `app/(tabs)/akun.tsx`, `src/auth/AuthProvider.tsx` (logout melepas push)
- Create: `docs/uji-manual-rencana-5.md`
- Test: perbarui/tambah `src/__tests__/screens/akun.test.tsx`

- [ ] `_layout.tsx`:
  - daftarkan `premium`, `ekspor`, `hapus-akun` sebagai modal;
  - bungkus dengan `LanggananProvider`;
  - pasang `pasangPenangan(router)` sekali.
- [ ] Akun:
  - bagian **Langganan**: `BadgeTier` + status (Free / Pro / Uji coba sampai …) + tombol ke `/premium`;
  - bagian **Pengingat**: `<PengaturanPengingat>`;
  - bagian **Data**: "Ekspor data" → `/ekspor`, "Kebijakan privasi" → `WebBrowser.openBrowserAsync(URL_KEBIJAKAN)`;
  - **Hapus akun** → `/hapus-akun`;
  - Keluar → `lepasPush()` lalu `signOut`.
  - URL web di `src/config.ts` (`URL_KEBIJAKAN_PRIVASI`, `URL_HAPUS_AKUN`) dari env `EXPO_PUBLIC_URL_*` dengan placeholder.
- [ ] `docs/uji-manual-rencana-5.md`:
  - perintah deploy yang dijalankan Rafli, satu per baris;
  - uji paywall mode mock, uji pembelian sandbox (license tester), pengingat (SQL isi tagihan uji / panggil fungsi manual dengan `curl` + CRON_SECRET), ekspor (buka di Excel & Sheets), dan hapus akun (app & web, cek `sisa_data_pengguna`);
  - catatan build ulang APK dev.
- [ ] Jalankan `npx jest`, `npx tsc --noEmit`, `npx expo lint`; semua PASS.
- [ ] Commit `feat(akun): langganan, pengingat, ekspor, dan hapus akun di Akun` + `docs: panduan uji rencana 5`.

---

## Status

> Diperbarui orkestrator setiap kali task selesai. Saat melanjutkan: baca bagian ini, `git log --oneline`, dan `git status`.

| Task | Status | Commit | Catatan |
|---|---|---|---|
| 0 Paket & konfigurasi | selesai | `298ea16` | expo-notifications ~58.1.9, expo-sharing ~58.0.23, react-native-purchases ^11.0.4; mock Jest global di `jest.setup.js`. |
| 1 Migrasi + hook status | selesai (tes integrasi belum dijalankan) | `108f8ff`, `cf9805e` | Tes integrasi menunggu `db push` oleh Rafli. |
| 2 Webhook RevenueCat | selesai | `2ae0ac0` | 28 tes. |
| 3 Langganan app + Premium | selesai | `5a3ddca` | `useLangganan()` jatuh ke penyedia bawaan tanpa Provider. |
| 4 Push app + pengaturan | selesai | `92c4e23` | + `src/notifikasi/sinkron.ts` (daftar ulang diam) di Task 9. |
| 5 debt-reminders | selesai | `4ec4edd` | Menunggu RPC `tagihan_untuk_pengingat` (Rencana 3). |
| 6 Ekspor | selesai | lihat `git log` (`feat(ekspor)…`) | Formula injection hanya diamankan di CSV: sel XLSX `inlineStr` tidak pernah dievaluasi sebagai rumus, dan awalan `'` akan terlihat di sel (penyempurnaan K9). `select` tiap sumber wajib memuat `id` (pemutus seri paginasi). |
| 7 Hapus akun | selesai | `d0f6520` | Web: isi konstanta & placeholder. |
| 8 Konfigurasi rilis | selesai | `3e8722c` | `app.config.ts` pakai `/// <reference types="node" />`. `.gitignore` + `google-services.json`. |
| 9 Integrasi + panduan | selesai | `531e46d`, `c94625a`, `9506428` | Worktree tidak punya `eslint.config.js` (ada di branch rencana 2), sehingga `npx expo lint` di sini tidak memeriksa apa pun; file rencana 5 di-lint dengan config checkout utama. |

Catatan tes unit di Windows: `npx jest` tanpa argumen ikut menjalankan `tests/integration` (gagal tanpa env). Pakai `npx jest --testPathIgnorePatterns /node_modules/ integration`.
