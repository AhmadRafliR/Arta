/// <reference types="node" />
import type { ConfigContext, ExpoConfig } from 'expo/config';
import fs from 'fs';
import path from 'path';

// app.json tetap sumber utama; berkas ini hanya menimpa varian (nama/paket)
// dan memasang google-services.json bila ada (tidak di-commit, lihat docs/rilis-play-store.md).
const PRODUCTION = process.env.APP_VARIANT === 'production';

export default ({ config }: ConfigContext): ExpoConfig => {
  const adaGoogleServices = fs.existsSync(path.join(__dirname, 'google-services.json'));

  return {
    ...config,
    name: PRODUCTION ? 'arta' : 'arta dev',
    slug: config.slug ?? 'keuangan-app',
    android: {
      ...config.android,
      package: PRODUCTION ? 'id.arta.keuangan' : 'com.keuanganapp.dev',
      ...(adaGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
    },
  };
};
