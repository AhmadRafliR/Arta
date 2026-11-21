# Masuk dengan Google

Kode sudah ada: tombol **Masuk dengan Google** tampil di layar masuk (di atas pilihan email/OTP). Yang kurang hanyalah konfigurasi akun Google dan Supabase. Selama `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` kosong, tombol menampilkan pesan "belum dikonfigurasi".

Alur: `GoogleSignin.signIn()` (native) → `idToken` → `supabase.auth.signInWithIdToken({ provider: 'google' })`. Tidak ada pengalihan browser.

## Langkah (dikerjakan sekali oleh kamu)

1. **Google Cloud Console** (console.cloud.google.com) → pilih/buat project → *APIs & Services → OAuth consent screen*: isi nama app "arta", email dukungan, lalu publikasikan (status *In production*) agar semua akun Google bisa masuk.
2. *Credentials → Create credentials → OAuth client ID*, buat **dua** client:
   - **Web application**: catat **Client ID** dan **Client secret**. Ini yang dipakai app (`webClientId`) dan Supabase.
   - **Android**: Package name `com.keuanganapp.dev` (build dev) dan **SHA-1** keystore build tersebut. Ambil SHA-1 dengan:
     ```powershell
     npx eas-cli@latest credentials --platform android
     ```
     pilih profil `development` → Keystore → lihat *SHA1 Fingerprint*.
   - Untuk rilis Play Store, buat client Android tambahan: package `id.arta.keuangan` dengan SHA-1 **App signing key** dari Play Console (*Setup → App signing*), dan SHA-1 upload key bila perlu.
3. **Supabase** → Authentication → Providers → **Google**: aktifkan, isi Client ID dan Client secret dari client **Web**. Bila muncul galat nonce saat masuk, aktifkan *Skip nonce checks*.
4. Isi env (client ID bukan rahasia):
   - Dev: di `.env` baris `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<client id web>`, lalu mulai ulang `npx expo start --dev-client` (tanpa build ulang).
   - Build EAS:
     ```powershell
     npx eas-cli@latest env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "<client id web>" --environment production --visibility plain
     ```
5. Jangan menempelkan **Client secret** ke chat; isi langsung di dashboard Supabase.

## Uji di HP
- Ketuk **Masuk dengan Google** → pilih akun → langsung masuk ke app.
- Galat "Konfigurasi Google belum cocok…" = SHA-1 atau package Android client salah (kode 10 / `DEVELOPER_ERROR`).
- Akun yang sama dengan email OTP (email Gmail yang sama) disatukan Supabase dalam satu pengguna.
