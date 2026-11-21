/// <reference types="node" />
import type { ConfigContext, ExpoConfig } from 'expo/config';
import fs from 'fs';
import path from 'path';

// app.json tetap sumber utama; berkas ini hanya menimpa varian (nama/paket), izin build rilis,
// dan memasang google-services.json bila ada (tidak di-commit, lihat docs/rilis-play-store.md).
const VARIAN = process.env.APP_VARIANT ?? 'development';
const PRODUCTION = VARIAN === 'production';
// Build rilis (tanpa dev client): preview dan production.
const RILIS = PRODUCTION || VARIAN === 'preview';

// App ID AdMob (bukan rahasia, tapi spesifik akun). Bawaan: App ID uji Google; produksi mengisinya lewat env EAS.
const ADMOB_UJI = {
  android: 'ca-app-pub-3940256099942544~3347511713',
  ios: 'ca-app-pub-3940256099942544~1458002511',
};
const PENERBIT_UJI_ADMOB = '3940256099942544';
const POLA_APP_ID_ADMOB = /^ca-app-pub-(\d+)~\d+$/;
const POLA_UNIT_ADMOB = /^ca-app-pub-(\d+)\/\d+$/;

// Izin yang dibawa template/dev client tetapi tidak dipakai app rilis. Overlay ("tampil di atas app lain")
// hanya perlu untuk layar galat pengembangan; di Play Store izin ini membuat pengguna curiga.
const IZIN_DIBLOKIR_RILIS = ['android.permission.SYSTEM_ALERT_WINDOW'];

function adaIdAdmobValid(id: string | undefined): id is string {
  return !!id && POLA_APP_ID_ADMOB.test(id.trim());
}

/** Env yang wajib ada untuk build Play Store. Nilainya publik (ikut di bundle), tetapi tanpanya app rilis rusak. */
export const ENV_WAJIB_RILIS: readonly (readonly [string, string])[] = [
  ['EXPO_PUBLIC_SUPABASE_URL', 'app langsung berhenti saat dibuka'],
  ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'app langsung berhenti saat dibuka'],
  ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'Masuk dengan Google gagal'],
  ['EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'layar Pro menampilkan "Langganan belum tersedia"'],
  ['EXPO_PUBLIC_URL_KEBIJAKAN_PRIVASI', 'tautan kebijakan privasi mengarah ke example.com'],
  ['EXPO_PUBLIC_URL_HAPUS_AKUN', 'tautan hapus akun mengarah ke example.com'],
];

/**
 * Daftar masalah konfigurasi build Play Store; kosong berarti siap. Murni (dites di Jest).
 * Dipanggil hanya di mesin EAS Build untuk profil production, sehingga perintah lokal tetap jalan.
 */
export function periksaKonfigRilis(env: Record<string, string | undefined>): string[] {
  const masalah: string[] = [];
  const isi = (nama: string) => env[nama]?.trim() || '';

  for (const [nama, akibat] of ENV_WAJIB_RILIS) {
    if (!isi(nama)) masalah.push(`${nama} kosong: ${akibat}.`);
  }
  const urlSupabase = isi('EXPO_PUBLIC_SUPABASE_URL');
  if (urlSupabase && !urlSupabase.startsWith('https://')) {
    masalah.push('EXPO_PUBLIC_SUPABASE_URL harus diawali https://.');
  }
  for (const nama of ['EXPO_PUBLIC_URL_KEBIJAKAN_PRIVASI', 'EXPO_PUBLIC_URL_HAPUS_AKUN']) {
    const v = isi(nama);
    if (v && (!v.startsWith('https://') || /\bexample\.com\b/.test(v))) {
      masalah.push(`${nama} harus URL https yang sudah di-host (bukan example.com).`);
    }
  }
  // Kunci SDK publik RevenueCat untuk Google Play diawali "goog_"; kunci Test Store tidak boleh ikut rilis.
  const rc = isi('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');
  if (rc && !rc.startsWith('goog_')) {
    masalah.push('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY harus kunci SDK publik Google Play dari RevenueCat (diawali goog_).');
  }

  // AdMob: iklan tetap mati selama ID unit kosong. Bila ID unit diisi, App ID asli dari akun yang sama wajib ada.
  const unit = ['EXPO_PUBLIC_ADMOB_BANNER_ANDROID', 'EXPO_PUBLIC_ADMOB_REWARD_ANDROID'].map(isi).filter(Boolean);
  if (unit.length > 0) {
    const penerbit = isi('ADMOB_ANDROID_APP_ID').match(POLA_APP_ID_ADMOB)?.[1];
    if (!penerbit) {
      masalah.push('ADMOB_ANDROID_APP_ID belum berisi App ID AdMob (ca-app-pub-...~...), padahal ID unit iklan sudah diisi.');
    } else if (penerbit === PENERBIT_UJI_ADMOB) {
      masalah.push('ADMOB_ANDROID_APP_ID masih App ID uji Google.');
    }
    for (const u of unit) {
      const m = u.match(POLA_UNIT_ADMOB);
      if (!m) masalah.push(`ID unit iklan "${u}" tidak valid (format ca-app-pub-.../...).`);
      else if (m[1] === PENERBIT_UJI_ADMOB) masalah.push(`ID unit iklan "${u}" masih ID uji Google.`);
      else if (penerbit && m[1] !== penerbit) masalah.push(`ID unit iklan "${u}" bukan dari akun AdMob yang sama dengan App ID.`);
    }
  }
  return masalah;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  if (PRODUCTION && process.env.EAS_BUILD === 'true') {
    const masalah = periksaKonfigRilis(process.env);
    if (masalah.length > 0) {
      throw new Error(
        `Build Play Store dihentikan karena konfigurasi belum lengkap:\n- ${masalah.join('\n- ')}\n` +
          'Isi lewat environment variable EAS "production" (docs/rilis-play-store.md, bagian A2).',
      );
    }
  }

  const androidAppId = adaIdAdmobValid(process.env.ADMOB_ANDROID_APP_ID)
    ? process.env.ADMOB_ANDROID_APP_ID.trim()
    : ADMOB_UJI.android;
  const iosAppId = adaIdAdmobValid(process.env.ADMOB_IOS_APP_ID)
    ? process.env.ADMOB_IOS_APP_ID.trim()
    : ADMOB_UJI.ios;
  // Di EAS Build, google-services.json datang dari env bertipe file GOOGLE_SERVICES_JSON (isinya path berkas).
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON?.trim() ||
    (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined);
  const diblokir = [...(config.android?.blockedPermissions ?? []), ...(RILIS ? IZIN_DIBLOKIR_RILIS : [])];

  return {
    ...config,
    name: PRODUCTION ? 'arta' : 'arta dev',
    slug: config.slug ?? 'keuangan-app',
    plugins: (config.plugins ?? []).map((p) =>
      Array.isArray(p) && p[0] === 'react-native-google-mobile-ads' ? [p[0], { androidAppId, iosAppId }] : p,
    ),
    android: {
      ...config.android,
      package: PRODUCTION ? 'id.arta.keuangan' : 'com.keuanganapp.dev',
      ...(diblokir.length > 0 ? { blockedPermissions: diblokir } : {}),
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
