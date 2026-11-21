/// <reference types="node" />
import type { ConfigContext, ExpoConfig } from 'expo/config';
import fs from 'fs';
import path from 'path';

// app.json tetap sumber utama; berkas ini hanya menimpa varian (nama/paket)
// dan memasang google-services.json bila ada (tidak di-commit, lihat docs/rilis-play-store.md).
const PRODUCTION = process.env.APP_VARIANT === 'production';

// App ID AdMob (bukan rahasia, tapi spesifik akun). Bawaan: App ID uji Google; produksi mengisinya lewat env EAS.
const ADMOB_UJI = {
  android: 'ca-app-pub-3940256099942544~3347511713',
  ios: 'ca-app-pub-3940256099942544~1458002511',
};

function adaIdAdmobValid(id: string | undefined): id is string {
  return !!id && /^ca-app-pub-\d+~\d+$/.test(id.trim());
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidAppId = adaIdAdmobValid(process.env.ADMOB_ANDROID_APP_ID)
    ? process.env.ADMOB_ANDROID_APP_ID.trim()
    : ADMOB_UJI.android;
  const iosAppId = adaIdAdmobValid(process.env.ADMOB_IOS_APP_ID)
    ? process.env.ADMOB_IOS_APP_ID.trim()
    : ADMOB_UJI.ios;
  const adaGoogleServices = fs.existsSync(path.join(__dirname, 'google-services.json'));

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
      ...(adaGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
    },
  };
};
