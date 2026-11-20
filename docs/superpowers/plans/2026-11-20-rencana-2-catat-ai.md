# Rencana 2: Catat pakai AI (suara/ketik) + kuota — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pengguna menahan tombol rekam atau mengetik bahasa santai ("tadi rokok 25rb pake gopay, parkir 2rb cash"). Server mengubahnya jadi draf transaksi. Pengguna mengecek dan mengubah draf di layar "Cek dulu", lalu menyimpannya. Kuota gratis 30×/bulan dihitung di server.

**Architecture:**
- **App:**
  - layar `rekam` (expo-audio, tahan-untuk-rekam, "Ketik saja");
  - layar `cek` (draf yang bisa diubah atau dihapus, lalu disimpan lewat RPC `save_transactions` yang sudah ada).
- **Server:** Supabase Edge Function `parse` (Deno) memakai token pengguna.
  - Alurnya: cek kuota → transkripsi OpenAI (jika audio) → parsing structured output dengan daftar dompet dan kategori pengguna sebagai konteks → validasi → kuota +1 hanya jika berhasil → kembalikan draf.
  - Draf tidak disimpan di server, dan audio tidak disimpan.
- **Logika murni** (prompt, skema, validasi, handler) ada di `supabase/functions/_shared/`, tanpa API Deno, supaya bisa diuji dengan Jest. `parse/index.ts` hanya menyambungkan `Deno.serve`.

**Tech Stack:**
- App: Expo SDK 58, `expo-audio`, `expo-file-system`, Supabase JS (`functions.invoke`, `rpc`), TanStack Query.
- Server: Edge Function Deno + `npm:@supabase/supabase-js@2`, OpenAI REST (`/v1/audio/transcriptions`, `/v1/chat/completions` + `response_format: json_schema` strict).
- Tes: Jest + RNTL v14, tes integrasi DB (`npm run test:integration`).

**Spec:** `docs/spec.md` §5.1 (kuota), §5.3 layar 2–3, §5.4 (AI, Edge Function), §5.5 (`ai_usage`, `entitlements`), §5.6 (prompt WF1), §5.7 (alur + koreksi saldo), §5.8 (tanpa simpan audio). Acuan visual: `docs/design/arta/kit.html` (pil kuota, ikon `act-mic`/`act-ketik`/`act-simpan`/`act-hapus`/`act-ubah`, `status-kuota`).

## Global Constraints

- **Kuota:**
  - Gratis **30** "catat AI" per bulan kalender; Pro **600**. Bulan dihitung di zona waktu profil (default `Asia/Jakarta`).
  - Satu permintaan parsing = 1 kuota, berapa pun transaksi yang dihasilkan.
  - Kuota +1 **hanya** jika parsing berhasil dan tidak butuh klarifikasi.
- **Kunci OpenAI** hanya di secret Edge Function `OPENAI_API_KEY`, tidak pernah di app atau di repo.
- **Model OpenAI** dari env dengan nilai bawaan:
  - `OPENAI_MODEL_STT` = `gpt-4o-mini-transcribe` (bahasa `id`, temperature 0);
  - `OPENAI_MODEL_PARSE` = `gpt-5-mini` (sama dengan WF1, `reasoning_effort: "low"`).
- **Edge Function** memakai token pengguna (RLS berlaku), bukan service role.
- **Tidak ada yang tersimpan sebelum tombol Simpan** di "Cek dulu". Audio tidak disimpan. `transkrip` disimpan di tiap transaksi hasil AI (atau teks ketikan bila tanpa audio), dengan `sumber: 'ai'`.
- **Jenis yang bisa disimpan sekarang:** `pemasukan | pengeluaran | transfer | penyesuaian`.
  - `hutang_baru`/`hutang_bayar` belum didukung (Rencana 3). Draf seperti itu tidak diubah diam-diam: tampil sebagai baris "belum didukung" yang tidak ikut disimpan.
  - Nabung/setor dana darurat = `transfer` ke dompet bertipe `darurat`; tarik = `transfer` dari dompet `darurat`.
- **Koreksi saldo pakai suara** ("saldo gopay sekarang 150rb") menjadi draf koreksi "sebelum → sesudah". Saat disimpan, koreksi menjadi transaksi `penyesuaian` sebesar selisih (`adjustmentFor`). Koreksi hutang/budget menyusul di rencana lain.
- **Nama dompet di draf:**
  - harus cocok dengan dompet milik pengguna yang tidak diarsip;
  - cocokkan tanpa peduli huruf besar/spasi/tanda baca, dengan alias `gojek→gopay`, `tunai|uangtunai|uangcash→cash`, `spay|shopee→shopeepay`;
  - yang tidak cocok → `wallet_id: null` + peringatan. Simpan dinonaktifkan sampai pengguna memilih dompet.
- **Kategori:** pakai kategori milik pengguna untuk jenisnya; tidak dikenal → `lainnya`; transfer → `transfer`; penyesuaian → `penyesuaian`.
- **Nominal & tanggal:** nominal integer rupiah > 0. Tanggal `YYYY-MM-DD` yang valid; selain itu pakai tanggal hari ini (zona profil).
- **Batas rekaman:** maksimal **60 detik** (berhenti otomatis); rekaman < 0,5 detik ditolak ("Tahan lebih lama untuk merekam"). Teks ketikan maksimal 500 karakter.
- **Gaya:**
  - semua teks UI bahasa Indonesia;
  - setiap `<Text`/`<TextInput` wajib `font-sans` (dijaga `src/__tests__/font.test.ts`);
  - aksen `acc` hanya untuk tombol utama, mic, dan progres; uang masuk `text-accink`;
  - format uang domain `Rp288.000`.
- **Paket native baru** (`expo-audio`) berarti APK dev harus dibangun ulang; catat di panduan uji.
- **Sebelum setiap commit:** jalankan `npx jest` dan `npx tsc --noEmit`. Migrasi SQL di-push oleh Rafli (`npx supabase db push --remote`); tes integrasi dijalankan setelah push.

## Review Focus

1. **Nama dompet yang tidak ada** ("bayar pake dana" padahal tidak punya dompet DANA) → baris draf ditandai "Pilih dompet", Simpan nonaktif sampai dipilih; tidak pernah diisi dompet acak. Tes di Task 2 dan Task 6.
2. **Rekaman hening atau bukan soal uang** ("halo tes") → muncul pertanyaan klarifikasi, tidak pindah ke "Cek dulu", kuota tidak berkurang. Tes di Task 3 dan Task 5.
3. **Koneksi putus atau server/OpenAI gagal di tengah** → pesan jelas, kuota tidak berkurang, bisa coba lagi. Tes di Task 3 dan Task 4.
4. **Tekan Simpan dua kali / coba ulang setelah gagal** → id draf stabil, sehingga hanya tersimpan sekali (RPC `on conflict do nothing`). Tes di Task 6.
5. **Kuota habis** → tidak memanggil OpenAI; layar rekam menampilkan "Kuota AI bulan ini habis" + tombol "Catat manual". Tes di Task 1, Task 3, dan Task 5.

---

### Task 1: Tabel & fungsi kuota AI

**Files:**
- Create: `supabase/migrations/20261120000006_kuota_ai.sql`
- Test: `tests/integration/kuota_ai.test.ts`

**Interfaces:**
- Produces (SQL):
  - Tabel `public.ai_usage (user_id uuid not null references auth.users on delete cascade, bulan text not null check (bulan ~ '^\d{4}-\d{2}$'), jumlah int not null default 0 check (jumlah >= 0), primary key (user_id, bulan))`.
  - Tabel `public.entitlements (user_id uuid primary key references auth.users on delete cascade, pro_aktif boolean not null default false, berlaku_sampai timestamptz, sumber text)`.
  - RLS di keduanya: `authenticated` hanya **select** baris sendiri (`user_id = (select auth.uid())`); tidak ada grant insert/update/delete untuk `authenticated`/`anon`.
  - `public.kuota_ai() returns jsonb`: `{ "bulan": "YYYY-MM", "terpakai": int, "batas": int, "pro": bool }`.
    - `bulan` dari `now()` di `profiles.zona_waktu` (fallback `Asia/Jakarta`).
    - `pro` = ada baris entitlements dengan `pro_aktif` dan (`berlaku_sampai` null atau > now()).
    - `batas` = 600 jika pro, selain itu 30.
  - `public.pakai_kuota_ai() returns jsonb`: atomik (upsert + `for update`).
    - Jika `terpakai < batas` → +1 dan kembalikan bentuk yang sama + `"ok": true`.
    - Selain itu tidak mengubah apa pun + `"ok": false`.
  - Kedua fungsi: `security definer`, `set search_path = ''`, `revoke … from public, anon`, `grant execute … to authenticated`, memakai `auth.uid()` (tanpa parameter user).

- [ ] **Step 1: Tulis tes integrasi yang gagal** (pola `tests/integration/rls.test.ts`, helper `createTestUser`):
  - pengguna baru → `kuota_ai()` = `{terpakai: 0, batas: 30, pro: false}` dan `bulan` = bulan sekarang di Asia/Jakarta;
  - 30× `pakai_kuota_ai()` → semua `ok: true`; ke-31 → `ok: false`, `terpakai` tetap 30;
  - pengguna B tidak bisa `select` baris `ai_usage` milik A;
  - `insert`/`update` langsung ke `ai_usage` dan `entitlements` oleh `authenticated` → ditolak;
  - `anon` tidak bisa memanggil `kuota_ai()`;
  - dengan entitlements pro (diisi lewat service role di tes) → `batas: 600, pro: true`; `berlaku_sampai` lampau → `pro: false`.
- [ ] **Step 2:** Tulis migrasi. Jalankan `npx tsc --noEmit` dan `npx jest`; harus PASS (tes integrasi tidak ikut Jest biasa).
- [ ] **Step 3: Commit** `feat(db): tabel dan fungsi kuota AI`. Push migrasi dan `npm run test:integration` dilakukan setelah Rafli menjalankan `npx supabase db push --remote`; catat di laporan bahwa verifikasi integrasi menunggu push.

### Task 2: Inti parsing murni (prompt, skema, validasi)

**Files:**
- Create: `supabase/functions/_shared/parsing.ts` (tanpa import apa pun; Deno dan Jest sama-sama bisa memakainya)
- Modify: `tsconfig.json` (`exclude` untuk `supabase/functions/*/index.ts`, karena memakai global Deno), `package.json` jest `testPathIgnorePatterns` bila perlu agar `supabase/functions/_shared/__tests__` ikut
- Test: `supabase/functions/_shared/__tests__/parsing.test.ts`

**Interfaces:**
- Produces:
  - `type Konteks = { hariIni: string; dompet: { id: string; nama: string; tipe: 'harian'|'darurat'|'investasi' }[]; kategori: { jenis: 'pemasukan'|'pengeluaran'; nama: string }[] }`
  - `buatPrompt(k: Konteks): string`: port prompt WF1 (lihat lampiran di bawah), dengan perubahan:
    - daftar nama dompet dan kategori pengguna dimasukkan ke prompt;
    - jenis `tabungan_setor`/`tabungan_tarik` tetap dikenali;
    - jenis baru `koreksi_saldo` ("saldo X sekarang N", "update saldo X jadi N");
    - tidak ada lagi aturan klarifikasi untuk hutang tanpa nama.
  - `SKEMA_PARSE`: objek JSON schema strict (semua properti `required`, `additionalProperties: false`). Item: `tanggal, jenis (enum: pemasukan|pengeluaran|transfer|tabungan_setor|tabungan_tarik|hutang_baru|hutang_bayar|koreksi_saldo), kategori, nominal (integer), catatan, dompet, dompet_tujuan`. Akar: `transaksi[], butuh_klarifikasi, pertanyaan`.
  - `type DrafTx = { id: string; tanggal: string; jenis: 'pemasukan'|'pengeluaran'|'transfer'; kategori: string; nominal: number; wallet_id: string|null; wallet_tujuan_id: string|null; catatan: string|null; peringatan: string[] }`
  - `type DrafKoreksi = { id: string; wallet_id: string; saldo_baru: number }`
  - `type HasilParse = { draf: DrafTx[]; koreksi: DrafKoreksi[]; tidakDidukung: string[]; butuh_klarifikasi: boolean; pertanyaan: string | null }`
  - `validasiHasil(mentah: unknown, k: Konteks, buatId: () => string): HasilParse`
  - `cocokkanDompet(nama: string, dompet: Konteks['dompet']): string | null` (alias di Global Constraints)

- [ ] **Step 1: Tulis tes yang gagal** untuk `validasiHasil` dan `cocokkanDompet`. Dompet konteks: `GoPay (harian)`, `Cash (harian)`, `ShopeePay (harian)`, `Dana darurat (darurat)`; hariIni `'2026-11-20'`.
  - **`cocokkanDompet`:** `'gojek'`→GoPay, `'Tunai'`→Cash, `'shopee pay'`→ShopeePay, `'dana'`→`null`.
  - **Pengeluaran dan pemasukan:** `{jenis:'pengeluaran', kategori:'Kopi', nominal:15000.4, dompet:'gopay', tanggal:'2026-11-20'}` → kategori `lainnya`, nominal 15000, wallet GoPay, tanpa peringatan; pengeluaran `kategori:'makan'` tetap `makan`; pemasukan `kategori:'ortu'` tetap.
  - **Dompet tidak dikenal:** `dompet:'dana'` → `wallet_id: null`, peringatan `'Dompet "dana" belum ada, pilih dompet'`; dompet kosong → `wallet_id: null`, peringatan `'Pilih dompet'`.
  - **Transfer:** `{jenis:'transfer', dompet:'cash', dompet_tujuan:'shopeepay'}` → kategori `transfer` + kedua id; transfer ke dompet yang sama → dibuang + `tidakDidukung` berisi `'Transfer ke dompet yang sama dilewati'`.
  - **Dana darurat:** `tabungan_setor` 50000 dari gopay → `transfer` GoPay→Dana darurat; `tabungan_tarik` → Dana darurat→dompet yang disebut; tanpa dompet darurat → peringatan `'Belum punya dompet dana darurat'` dan `wallet_tujuan_id: null`.
  - **Hutang:** `hutang_bayar` → tidak masuk `draf`, `tidakDidukung` berisi `'Pencatatan hutang belum didukung (menyusul): …'` dengan catatan atau kategori.
  - **Koreksi saldo:** `koreksi_saldo` `dompet:'gopay' nominal:150000` → `koreksi: [{wallet_id: GoPay, saldo_baru: 150000}]`; dompet tidak cocok → masuk `tidakDidukung` dengan alasan.
  - **Data tidak layak:** nominal ≤ 0, NaN, atau string → dibuang; tanggal `'kemarin'`/kosong → `'2026-11-20'`.
  - **Klarifikasi:** `butuh_klarifikasi: true` → `draf: []`, `pertanyaan` diteruskan.
  - **Input rusak:** `mentah` bukan objek → `butuh_klarifikasi: true` dengan pertanyaan bawaan `'Maaf, aku belum paham. Coba sebutkan nominal dan untuk apa.'`.
  - **Id dan prompt:** setiap draf/koreksi dapat id unik dari `buatId`; `buatPrompt` memuat `'2026-11-20'`, `'GoPay'`, `'Dana darurat'`, dan `'koreksi_saldo'`.
- [ ] **Step 2:** Jalankan `npx jest supabase/functions/_shared`. Harus FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npx jest` dan `npx tsc --noEmit`. Harus PASS.
- [ ] **Step 5: Commit** `feat(ai): inti parsing draf transaksi`

### Task 3: Edge Function `parse`

**Files:**
- Create: `supabase/functions/_shared/handler.ts` (tanpa API Deno; dependensi disuntikkan), `supabase/functions/parse/index.ts` (penyambung Deno), `supabase/functions/parse/deno.json` (import map `npm:@supabase/supabase-js@2` bila perlu)
- Test: `supabase/functions/_shared/__tests__/handler.test.ts`

**Interfaces:**
- Consumes: `buatPrompt`, `SKEMA_PARSE`, `validasiHasil` (Task 2); RPC `kuota_ai`, `pakai_kuota_ai` (Task 1).
- Produces:
  - **Permintaan:** HTTP `POST` body JSON `{ teks?: string; audio_base64?: string; mime?: string }` (salah satu wajib), header `Authorization: Bearer <token pengguna>`.
  - **Respons 200:** `{ transkrip: string; draf: DrafTx[]; koreksi: DrafKoreksi[]; tidakDidukung: string[]; butuh_klarifikasi: boolean; pertanyaan: string|null; kuota: { bulan, terpakai, batas, pro } }`.
  - **Respons galat:** `{ galat: 'quota_exceeded'|'unauthorized'|'bad_request'|'ai_gagal'|'server', pesan: string, kuota? }` dengan status 402/401/400/502/500.
  - `buatHandler(deps: { db(token: string): DbPengguna; openai: { transkripsi(audio: Uint8Array, mime: string): Promise<string>; parse(prompt: string, teks: string): Promise<unknown> }; buatId(): string; sekarang(): Date }): (req: Request) => Promise<Response>`, dengan `DbPengguna = { kuota(): Promise<Kuota>; pakaiKuota(): Promise<Kuota & {ok: boolean}>; konteks(sekarang: Date): Promise<Konteks> }`.
    - `konteks` membaca `profiles.zona_waktu`, `wallets` (tidak diarsip), dan `categories` lewat RLS.
  - `index.ts` mengisi deps:
    - supabase-js dengan `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan header Authorization pengguna;
    - OpenAI lewat `fetch`:
      - transkripsi: multipart `file`, `model`, `language=id`, `temperature=0`;
      - parse: `chat/completions` dengan `response_format: { type: 'json_schema', json_schema: { name: 'transaksi', strict: true, schema: SKEMA_PARSE } }`, `reasoning_effort: 'low'`.
- **Aturan:**
  - kuota habis → 402 tanpa memanggil OpenAI;
  - audio > 6 MB (setelah decode) atau teks > 500 karakter → 400;
  - transkrip kosong → 200 `butuh_klarifikasi: true`, pertanyaan `'Suaranya belum terdengar jelas. Coba ulangi lebih dekat ke mic.'`, kuota tidak dipakai;
  - galat OpenAI → 502 `ai_gagal` `'AI sedang sibuk, coba lagi sebentar.'`, kuota tidak dipakai;
  - parse berhasil dan tidak butuh klarifikasi → `pakaiKuota()`; bila `ok: false` (balapan) → 402.
  - **Pesan galat lain:** 401 `'Sesi habis, masuk lagi.'`; 400 `'Rekaman terlalu panjang.'` / `'Teks terlalu panjang (maks 500 huruf).'` / `'Kirim suara atau teks.'`; 402 `'Kuota catat AI bulan ini habis.'`.

- [ ] **Step 1: Tulis tes yang gagal** dengan deps palsu:
  - tanpa Authorization → 401;
  - body kosong → 400;
  - kuota `{terpakai:30,batas:30}` → 402 dan `openai.parse` tidak dipanggil;
  - teks `'rokok 25rb gopay'` + parse palsu → 200, `draf` 1, `pakaiKuota` dipanggil 1×, `transkrip` = teks;
  - audio base64 → `transkripsi` dipanggil dengan bytes hasil decode, lalu parse dengan transkrip;
  - transkrip `''` → klarifikasi, `pakaiKuota` tidak dipanggil;
  - `openai.parse` melempar → 502 dan `pakaiKuota` tidak dipanggil;
  - hasil `butuh_klarifikasi: true` → 200 tanpa `pakaiKuota`;
  - teks 501 karakter → 400.
- [ ] **Step 2:** Jalankan `npx jest supabase/functions/_shared`. Harus FAIL.
- [ ] **Step 3:** Implementasi `handler.ts` dan `index.ts`. `index.ts` dikecualikan dari tsc (Task 2). Tulis dengan hati-hati karena tidak bisa dijalankan di sini (tidak ada Deno/Docker); jaga agar tetap tipis.
- [ ] **Step 4:** Jalankan `npx jest` dan `npx tsc --noEmit`. Harus PASS.
- [ ] **Step 5: Commit** `feat(ai): edge function parse dengan kuota`

### Task 4: Lapisan data AI di app

**Files:**
- Create: `src/data/ai.ts`, `src/ai/drafStore.ts`, `src/ai/tipe.ts`
- Note: untuk respons non-2xx, `supabase.functions.invoke` mengembalikan `error` (FunctionsHttpError) dengan `error.context` berisi `Response`. Body JSON `{galat, pesan}` dibaca dari situ.
- Test: `src/data/__tests__/ai.test.ts`, `src/ai/__tests__/drafStore.test.ts`

**Interfaces:**
- Consumes: kontrak respons Task 3; tipe `DrafTx`, `DrafKoreksi`, `HasilParse` (salin bentuknya ke `src/ai/tipe.ts`, karena app tidak mengimpor dari `supabase/functions`).
- Produces:
  - `useKuotaAi()`: `useQuery` kunci `['kuota-ai']` → `{ bulan, terpakai, batas, pro }` dari `rpc('kuota_ai')`. `sisaKuota(k) = max(0, batas − terpakai)`.
  - `kirimKeAi(input: { teks: string } | { audioUri: string; mime: string }): Promise<HasilAi>`:
    - audio dibaca base64 lewat `expo-file-system` lalu `supabase.functions.invoke('parse', { body })`;
    - galat dipetakan ke `AppError` dengan `kind` baru `'kuota'` (dari `galat: 'quota_exceeded'`); offline → pesan offline yang ada; galat lain → `pesan` dari server atau pesan umum;
    - setelah sukses, invalidasi `['kuota-ai']`.
  - `type HasilAi = HasilParse & { transkrip: string; kuota: KuotaAi }`
  - `drafStore` (modul, `useSyncExternalStore`): `setDraf(h: HasilAi)`, `useDraf(): HasilAi | null`, `ubahDraf(id, patch)`, `hapusDraf(id)`, `hapusKoreksi(id)`, `kosongkan()`. Dipakai untuk mengoper hasil dari `rekam` ke `cek` tanpa parameter URL.

- [ ] **Step 1: Tulis tes yang gagal:**
  - `kirimKeAi({teks})` memanggil `functions.invoke('parse', { body: { teks } })` (supabase di-mock) dan mengembalikan hasil;
  - `{galat:'quota_exceeded'}` → `AppError` `kind: 'kuota'`;
  - kegagalan jaringan → `kind: 'offline'`;
  - `audioUri` → membaca base64 (`expo-file-system` di-mock) lalu mengirim `audio_base64` dan `mime`;
  - `sisaKuota({terpakai:12,batas:30}) === 18`, dan tidak pernah negatif;
  - `drafStore`: set → `useDraf` mengembalikan data; `ubahDraf` mengganti nominal; `hapusDraf` menghapus baris; `kosongkan` → null.
- [ ] **Step 2:** Jalankan tes terkait. Harus FAIL.
- [ ] **Step 3:** Pasang `npx expo install expo-file-system` jika belum ada. Implementasi. Tambahkan `'kuota'` ke union `AppError['kind']` tanpa mengubah perilaku kind lain.
- [ ] **Step 4:** Jalankan `npx jest` dan `npx tsc --noEmit`. Harus PASS.
- [ ] **Step 5: Commit** `feat(ai): lapisan data kuota dan kirim ke AI`

### Task 5: Layar Rekam (tahan-untuk-rekam + ketik)

**Files:**
- Create: `app/rekam.tsx`, `src/components/PilKuota.tsx`, `src/components/TombolRekam.tsx`
- Modify: `app/_layout.tsx` (daftarkan `rekam` dan `cek` sebagai modal seperti `catat`), `src/components/TabBar.tsx` (mic → `router.push('/rekam')`), `app.json` (plugin `expo-audio` dengan `microphonePermission: "arta butuh mikrofon untuk mencatat transaksi lewat suara."`), `package.json` (`npx expo install expo-audio`)
- Test: `src/__tests__/screens/rekam.test.tsx`, ubah `src/components/__tests__/TabBar.test.tsx` (harapan mic sekarang `'/rekam'`; ini perubahan perilaku yang sah)

**Interfaces:**
- Consumes: `useKuotaAi`, `sisaKuota`, `kirimKeAi`, `setDraf` (Task 4); `Ikon` (`act-mic`, `act-ketik`, `status-kuota`); `Tombol`.
- Produces: rute `/rekam` (modal). Isi layar dari atas:
  1. judul "Catat pakai suara" + tombol "Batal";
  2. `PilKuota` "Sisa N catat AI bulan ini" (sembunyi bila `pro`), atau kartu habis;
  3. `TombolRekam` besar (96px, `acc`, ikon `act-mic`): tahan untuk rekam (`onPressIn` mulai, `onPressOut` berhenti lalu kirim), dengan 5 bar level dari metering, penghitung detik, dan berhenti otomatis di 60 detik;
  4. teks bantu "Tahan, ngomong, lepas." / "Lepas untuk kirim";
  5. tautan "Ketik saja" yang membuka `TextInput` multiline (maks 500) + tombol "Kirim";
  6. tautan "Isi formulir manual" → `router.replace('/catat')`.
- **Alur hasil:**
  - sukses + ada draf/koreksi/tidakDidukung → `setDraf` lalu `router.replace('/cek')`;
  - butuh klarifikasi → tampilkan pertanyaan di layar (tetap di `rekam`), pengguna bisa coba lagi;
  - `kind: 'kuota'` → kartu `'Kuota catat AI bulan ini sudah habis. Kamu masih bisa catat manual tanpa batas.'` + `Tombol` "Catat manual" + teks `'Pro dengan catat AI tanpa batas segera hadir.'`;
  - galat lain → pesan + coba lagi.
- **Izin mikrofon ditolak** → pesan `'Izin mikrofon ditolak. Buka Pengaturan untuk mengizinkan, atau pakai "Ketik saja".'` + tombol "Buka Pengaturan" (`Linking.openSettings()`).
- **Selama memproses:** tombol nonaktif + "Memproses…".

- [ ] **Step 1: Tulis tes yang gagal** (`expo-audio` dan `@/data/ai` di-mock; mock perekam mengembalikan uri dan durasi):
  - menampilkan `'Sisa 18 catat AI bulan ini'` dari kuota `{terpakai:12,batas:30,pro:false}`;
  - kuota habis (`terpakai 30`) → kartu habis tampil dan tombol rekam nonaktif;
  - `pressIn` + `pressOut` dengan durasi 2 detik → `kirimKeAi({audioUri, mime})` dipanggil sekali; sukses → `setDraf` + `router.replace('/cek')`;
  - durasi 0,3 detik → tidak mengirim, teks `'Tahan lebih lama untuk merekam'`;
  - hasil klarifikasi → teks pertanyaan tampil dan `router.replace` tidak dipanggil;
  - "Ketik saja" → isi `'parkir 2rb cash'` → "Kirim" → `kirimKeAi({teks:'parkir 2rb cash'})`;
  - izin ditolak → pesan izin + tombol "Buka Pengaturan";
  - galat `kind:'kuota'` dari `kirimKeAi` → kartu habis.
- [ ] **Step 2:** Jalankan tes terkait. Harus FAIL.
- [ ] **Step 3:** Implementasi dengan API `expo-audio` versi SDK 58 (`useAudioRecorder`, `RecordingPresets.HIGH_QUALITY` dengan `isMeteringEnabled`, `AudioModule.requestRecordingPermissionsAsync`, `setAudioModeAsync({ allowsRecording: true })`). Cek nama API di `node_modules/expo-audio` sebelum menulis; `mime` dari ekstensi uri (`.m4a` → `audio/m4a`).
- [ ] **Step 4:** Jalankan `npx jest` dan `npx tsc --noEmit`. Harus PASS.
- [ ] **Step 5: Commit** `feat(ai): layar rekam tahan-untuk-rekam dan ketik`

### Task 6: Layar "Cek dulu"

**Files:**
- Create: `app/cek.tsx`, `src/components/BarisDraf.tsx`, `src/components/EditorDraf.tsx`
- Test: `src/__tests__/screens/cek.test.tsx`

**Interfaces:**
- Consumes: `useDraf`, `ubahDraf`, `hapusDraf`, `hapusKoreksi`, `kosongkan` (Task 4); `useSaveTransactions`, `useWallets`, `useAllTransactions`, `walletBalances`, `adjustmentFor`, `useCategories`; `TxRow` sebagai gaya acuan; `Ikon`; `Tombol`; `AmountInput`; `Chip`.
- Produces: rute `/cek` (modal).
  - **Tanpa draf** (dibuka langsung) → `router.replace('/')`.
  - **Isi layar:**
    - judul "Cek dulu" + teks `transkrip` dalam kutip (abu, 2 baris);
    - daftar `BarisDraf`: gaya baris transaksi kit (ikon kategori, judul, meta "Kategori · Dompet · tanggal", nominal bertanda). Baris berperingatan diberi tanda `warnInk` + teks peringatan. Ketuk baris → `EditorDraf` (lembar bawah: jenis pemasukan/pengeluaran/transfer, kategori sesuai jenis, nominal `AmountInput`, dompet & tujuan chip, tanggal, catatan). Ikon hapus per baris;
    - koreksi: "Saldo GoPay: Rp200.000 → Rp150.000" (saldo sekarang dari `walletBalances`); koreksi yang selisihnya 0 ditandai "Sudah sama" dan tidak disimpan;
    - `tidakDidukung`: daftar abu dengan ikon info;
    - tombol utama "Simpan N transaksi", dengan N = jumlah draf + koreksi bernilai. Nonaktif bila N = 0 atau ada draf tanpa dompet/tujuan, dengan alasan di bawah tombol `'Pilih dompet untuk semua transaksi dulu.'`;
    - "Batal" → konfirmasi `'Buang hasil catat ini?'` → `kosongkan()` + tutup.
  - **Simpan:** satu panggilan `useSaveTransactions` berisi semua item.
    - Draf → `{ id, tanggal, jenis, kategori, nominal, wallet_id, wallet_tujuan_id, catatan, transkrip, sumber: 'ai' }`.
    - Koreksi → `{ id, jenis: 'penyesuaian', kategori: 'penyesuaian', nominal: adjustmentFor(saldo, saldo_baru), wallet_id, tanggal: hariIni, catatan: 'Koreksi saldo lewat suara', transkrip, sumber: 'ai' }`.
    - Id dipakai ulang di setiap percobaan.
    - Sukses → `kosongkan()`, tutup modal, dan Beranda menampilkan data baru (invalidasi yang sudah ada di `useSaveTransactions`).
    - Galat → pesan; draf tetap ada.

- [ ] **Step 1: Tulis tes yang gagal** (store diisi langsung; supabase/data di-mock seperti tes layar lain):
  - 2 draf (rokok 25.000 GoPay, parkir 2.000 Cash) → tampil `'-Rp25.000'` dan `'-Rp2.000'`, tombol `'Simpan 2 transaksi'`;
  - Simpan → `save_transactions` dipanggil sekali dengan 2 item `sumber: 'ai'` dan `transkrip` terisi;
  - tekan Simpan dua kali cepat → tetap satu panggilan;
  - simpan gagal lalu coba lagi → id item sama di kedua panggilan;
  - draf dengan `wallet_id: null` → tombol nonaktif + `'Pilih dompet untuk semua transaksi dulu.'`; pilih "GoPay" di editor → aktif;
  - hapus satu baris → `'Simpan 1 transaksi'`;
  - koreksi GoPay `saldo_baru` 150000 dengan saldo 200000 → teks `'Rp200.000 → Rp150.000'` dan item penyesuaian `nominal: -50000`;
  - koreksi yang sudah sama → `'Sudah sama'`, tidak ikut item;
  - `tidakDidukung` tampil;
  - Batal → konfirmasi → store kosong;
  - store kosong saat dibuka → `router.replace('/')`.
- [ ] **Step 2:** Jalankan tes terkait. Harus FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npx jest` dan `npx tsc --noEmit`. Harus PASS.
- [ ] **Step 5: Commit** `feat(ai): layar cek dulu dan simpan hasil AI`

### Task 7: Panduan deploy & uji Rencana 2

**Files:**
- Create: `docs/uji-manual-rencana-2.md`
- Modify: `docs/tindak-lanjut-rencana-1.md` (tambahkan bagian "Dari Rencana 2": hal yang ditunda: koreksi hutang/budget lewat suara, peringatan budget di Cek dulu, paywall/RevenueCat, batas laju per menit)

- [ ] **Step 1:** Tulis panduan, dengan perintah yang dijalankan Rafli sendiri, satu per baris:
  1. `npx supabase db push --remote`.
  2. `npx supabase secrets set OPENAI_API_KEY=<kunci>` (diketik sendiri, tidak ditempel ke chat).
  3. Opsional `OPENAI_MODEL_STT` / `OPENAI_MODEL_PARSE`.
  4. `npx supabase functions deploy parse`.
  5. `npm run test:integration`.
  6. Build ulang APK dev (`npx eas-cli@latest build -p android --profile development`), karena `expo-audio` paket native.
  7. `npx expo start --dev-client`.
- [ ] **Step 2:** Daftar uji (centang):
  - izin mic diminta sekali;
  - "tadi rokok 25rb pake gopay, parkir 2rb cash" → Cek dulu berisi 2 baris yang benar → Simpan → Beranda berubah;
  - "kemarin makan 20rb" → tanggal kemarin;
  - "top up gopay 50rb dari bca" tanpa dompet BCA → baris minta pilih dompet;
  - "nabung 100rb ke dana darurat dari cash" → transfer;
  - "saldo gopay sekarang 150rb" → koreksi sebelum → sesudah;
  - "bayar kredivo 300rb" → "belum didukung";
  - rekaman hening → pertanyaan, kuota tetap;
  - mode pesawat → pesan offline, kuota tetap;
  - "Ketik saja" jalan;
  - sisa kuota berkurang 1 per catat;
  - di akun uji, isi `ai_usage` jadi 30 lewat SQL editor → kartu "kuota habis".
- [ ] **Step 3:** Jalankan `npx jest` dan `npx tsc --noEmit`. Harus PASS.
- [ ] **Step 4: Commit** `docs: panduan deploy dan uji rencana 2`

---

## Lampiran: prompt WF1 (titik awal `buatPrompt`, sudah berjalan di n8n)

Aturan inti yang dipertahankan, ditulis ulang dalam bahasa Indonesia:
- **Nominal:** satu kalimat bisa berisi beberapa transaksi. Nominal selalu integer rupiah: "15 rb"=15000, "1,5 jt"=1500000, "sejuta setengah"=1500000, "goceng"=5000, "ceban"=10000, "gocap"=50000, "cepek"=100000 (konteks ribuan), "seratus rebu"=100000.
- **Kategori pengeluaran:** kopi/jajan/minum → makan; bensin/ojol/angkot → transport; UKT/SPP/buku/fotokopi/print → kuliah. Selain kategori milik pengguna → lainnya.
- **Kategori pemasukan:** kiriman orang tua/mama/papa/ayah/ibu → ortu.
- **Dana darurat:** nabung/setor → tabungan_setor; ambil/tarik dari tabungan → tabungan_tarik.
- **Hutang:** pinjam/minjem/ngutang → hutang_baru; bayar hutang/nyicil/cicilan/angsuran → hutang_bayar (kategori = nama pemberi).
- **Dompet:** dompet = yang disebut, tulis apa adanya (pakai nama dari daftar pengguna bila jelas); untuk pemasukan, dompet = yang menerima.
- **Transfer:** perpindahan antar dompet sendiri (top up, isi saldo, tarik tunai, pindah saldo) → transfer, kategori 'transfer', dompet = asal, dompet_tujuan = tujuan. Ini bukan pengeluaran.
- **Tanggal:** "kemarin" = hari ini − 1; tanpa keterangan = hari ini.
- **Catatan:** detail singkat.
- **Klarifikasi:** nominal tidak disebut/ambigu, atau pesan bukan soal keuangan → butuh_klarifikasi=true, transaksi=[], dan pertanyaan singkat santai.
- **Baru — `koreksi_saldo`:** "saldo X sekarang N" / "update saldo X jadi N" → jenis koreksi_saldo, dompet = X, nominal = N.
