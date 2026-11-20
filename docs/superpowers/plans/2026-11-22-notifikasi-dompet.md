# Rencana: catat otomatis dari notifikasi GoPay & ShopeePay

Tujuan: transaksi GoPay dan ShopeePay tercatat hampir real-time tanpa provider berbayar. Aplikasi membaca notifikasi
di HP Android pengguna (NotificationListenerService), mengurai nominal dan arah uang, lalu menjadikannya **draf** yang
dikonfirmasi pengguna di layar "Cek dulu". Teks notifikasi mentah tidak pernah dikirim ke server.

Keputusan:
- Android saja (iOS tidak mengizinkan membaca notifikasi aplikasi lain). Di iOS/web fitur tampil sebagai "tidak tersedia".
- Hanya paket dalam daftar putih yang dibaca: `com.gojek.app`, `com.gojek.gopay`, `com.shopee.id`. Notifikasi lain diabaikan di sisi native, tidak disimpan.
- Pengguna wajib mengaktifkan "Akses notifikasi" sendiri; aplikasi hanya membuka layar pengaturannya.
- Tidak ada transaksi yang tersimpan diam-diam: semua lewat draf + konfirmasi.
- ID draf diturunkan secara deterministik dari kunci notifikasi, jadi notifikasi yang sama tidak bisa tercatat dua kali (RPC simpan idempoten per id).
- Format notifikasi asli belum diketahui pasti: parser memakai pola umum (nominal `Rp`, kata kunci arah), menolak promo/OTP/gagal, dan layar pengaturan menyediakan "Notifikasi terakhir yang terbaca" (lokal saja) untuk mengumpulkan contoh asli dan menyempurnakan pola.

## Kontrak antarbagian

### A. Modul native lokal `modules/notifikasi-dompet` (Expo Modules API, Kotlin)

Nama modul native: `NotifikasiDompet`. API TypeScript di `modules/notifikasi-dompet/index.ts`:

```ts
export type NotifikasiMentah = {
  kunci: string;   // unik per notifikasi: `${sbn.key}:${sbn.postTime}`
  paket: string;   // package name sumber
  judul: string;   // EXTRA_TITLE ('' bila kosong)
  teks: string;    // EXTRA_BIG_TEXT bila ada, selain itu EXTRA_TEXT ('' bila kosong)
  waktu: number;   // postTime, milidetik epoch
};
export function tersedia(): boolean;              // true hanya di Android dengan modul native terpasang
export function izinAktif(): boolean;             // listener diizinkan di pengaturan sistem
export function bukaPengaturanIzin(): void;       // Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
export function aktif(): boolean;                 // sakelar fitur di app (bawaan false)
export function setAktif(nilai: boolean): void;   // saat false, service mengabaikan notifikasi
export function ambilAntrean(): NotifikasiMentah[];         // urut waktu naik
export function hapusDariAntrean(kunci: string[]): void;
export function tambahPendengar(cb: (n: NotifikasiMentah) => void): { remove(): void }; // event 'onNotifikasi'
```

- Antrean disimpan di SharedPreferences (JSON), maksimal 300 item (yang tertua dibuang), dedup per `kunci`.
- Di iOS/web/Jest: fallback JS yang aman (`tersedia()` false, antrean kosong, fungsi lain no-op).
- Service dideklarasikan di `AndroidManifest.xml` modul dengan izin `android.permission.BIND_NOTIFICATION_LISTENER_SERVICE`.

### B. Parser `src/notifikasi-dompet/parser.ts` (TypeScript murni)

```ts
export type SumberDompet = 'gopay' | 'shopeepay';
export type HasilNotif = {
  kunci: string;
  sumber: SumberDompet;
  jenis: 'pemasukan' | 'pengeluaran';
  nominal: number;          // rupiah bulat > 0
  keterangan: string;       // merchant/lawan transaksi bila terbaca, '' bila tidak
  waktu: number;
};
export function parseNotifikasi(n: NotifikasiMentah): HasilNotif | null;
```

Null untuk: promo/voucher/cashback "s.d.", OTP/kode verifikasi, transaksi gagal/dibatalkan/tertunda, notifikasi tanpa nominal.

### C. Integrasi `src/notifikasi-dompet/*` + layar

- Kartu di Beranda: "N transaksi dari notifikasi siap dicek" → isi draf store lalu buka `/cek`.
- Pemetaan sumber → dompet pengguna berdasarkan nama (`/gopay/i`, `/shopee/i`); bila tidak ada, `wallet_id` null + peringatan "Pilih dompet".
- Antrean dibersihkan setelah draf berhasil disimpan.
- Layar `app/notifikasi-dompet.tsx`: penjelasan & privasi, status izin, tombol buka pengaturan, sakelar aktif, tips baterai (Xiaomi/HyperOS), daftar notifikasi terakhir yang terbaca (lokal).
- Pintu masuk dari layar Akun.

## Status

- [x] A. Modul native
- [x] B. Parser + tes (47 tes, contoh masih sintetis)
- [x] C. Integrasi + layar + tes
- [x] Verifikasi: tsc bersih, lint 0 error, jest 102 suite/941 tes, expo-doctor 20/20
- [x] Build APK dev baru (EAS) berhasil: build `f87caca6`, service dan kelas native terverifikasi di APK
- [x] Dokumentasi pengguna + panduan uji manual (`docs/notifikasi-dompet.md`, `docs/uji-manual-notifikasi-dompet.md`)
- [ ] Uji di HP: izin aktif, notifikasi GoPay/ShopeePay masuk antrean, draf tersimpan

Cara melanjutkan bila terputus: baca bagian Status ini dan `git log --oneline -15`.
