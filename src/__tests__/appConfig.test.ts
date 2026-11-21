import type { ConfigContext, ExpoConfig } from 'expo/config';

type ModulKonfig = typeof import('../../app.config');

const ENV_ASLI = { ...process.env };

/** Muat app.config.ts dengan env tertentu (varian dibaca saat modul dimuat). */
function muat(env: Record<string, string | undefined>): ModulKonfig {
  process.env = { ...ENV_ASLI, ...env };
  let m: ModulKonfig | undefined;
  jest.isolateModules(() => {
    m = jest.requireActual('../../app.config') as ModulKonfig;
  });
  return m!;
}

function konteks(): ConfigContext {
  const config: Partial<ExpoConfig> = {
    name: 'arta',
    slug: 'keuangan-app',
    android: { package: 'com.keuanganapp.dev' },
    plugins: ['expo-router', ['react-native-google-mobile-ads', { androidAppId: 'x', iosAppId: 'y' }]],
  };
  return { config, projectRoot: '.', staticConfigPath: null, packageJsonPath: null } as unknown as ConfigContext;
}

const LENGKAP = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com',
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_abc',
  EXPO_PUBLIC_URL_KEBIJAKAN_PRIVASI: 'https://arta.web.app/kebijakan-privasi.html',
  EXPO_PUBLIC_URL_HAPUS_AKUN: 'https://arta.web.app/hapus-akun.html',
};

afterEach(() => {
  process.env = { ...ENV_ASLI };
});

describe('periksaKonfigRilis', () => {
  const { periksaKonfigRilis } = muat({});

  it('konfigurasi lengkap tanpa iklan: siap', () => {
    expect(periksaKonfigRilis(LENGKAP)).toEqual([]);
  });

  it('env wajib kosong disebut satu per satu beserta akibatnya', () => {
    const m = periksaKonfigRilis({});
    expect(m).toHaveLength(6);
    expect(m[0]).toBe('EXPO_PUBLIC_SUPABASE_URL kosong: app langsung berhenti saat dibuka.');
    expect(m.join('\n')).toContain('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY kosong');
  });

  it('URL placeholder, http, dan kunci RevenueCat non-Google ditolak', () => {
    const m = periksaKonfigRilis({
      ...LENGKAP,
      EXPO_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      EXPO_PUBLIC_URL_KEBIJAKAN_PRIVASI: 'https://example.com/arta/kebijakan-privasi.html',
      EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'test_abc',
    });
    expect(m).toEqual([
      'EXPO_PUBLIC_SUPABASE_URL harus diawali https://.',
      'EXPO_PUBLIC_URL_KEBIJAKAN_PRIVASI harus URL https yang sudah di-host (bukan example.com).',
      'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY harus kunci SDK publik Google Play dari RevenueCat (diawali goog_).',
    ]);
  });

  it('AdMob: ID unit butuh App ID asli dari akun yang sama', () => {
    const banner = { EXPO_PUBLIC_ADMOB_BANNER_ANDROID: 'ca-app-pub-111/222' };
    expect(periksaKonfigRilis({ ...LENGKAP, ...banner })[0]).toContain('ADMOB_ANDROID_APP_ID belum berisi App ID');
    expect(
      periksaKonfigRilis({ ...LENGKAP, ...banner, ADMOB_ANDROID_APP_ID: 'ca-app-pub-3940256099942544~3347511713' })[0],
    ).toBe('ADMOB_ANDROID_APP_ID masih App ID uji Google.');
    expect(periksaKonfigRilis({ ...LENGKAP, ...banner, ADMOB_ANDROID_APP_ID: 'ca-app-pub-999~1' })).toEqual([
      'ID unit iklan "ca-app-pub-111/222" bukan dari akun AdMob yang sama dengan App ID.',
    ]);
    expect(
      periksaKonfigRilis({
        ...LENGKAP,
        ...banner,
        EXPO_PUBLIC_ADMOB_REWARD_ANDROID: 'ca-app-pub-111/333',
        ADMOB_ANDROID_APP_ID: 'ca-app-pub-111~1',
      }),
    ).toEqual([]);
  });
});

describe('app.config varian', () => {
  it('production: paket rilis, nama arta, izin overlay diblokir', () => {
    const c = muat({ APP_VARIANT: 'production', EAS_BUILD: undefined }).default(konteks());
    expect(c.name).toBe('arta');
    expect(c.android?.package).toBe('id.arta.keuangan');
    expect(c.android?.blockedPermissions).toEqual(['android.permission.SYSTEM_ALERT_WINDOW']);
  });

  it('development: paket dev dan izin overlay tetap ada untuk layar galat', () => {
    const c = muat({ APP_VARIANT: undefined }).default(konteks());
    expect(c.name).toBe('arta dev');
    expect(c.android?.package).toBe('com.keuanganapp.dev');
    expect(c.android?.blockedPermissions).toBeUndefined();
  });

  it('App ID AdMob dari env menggantikan App ID uji pada plugin', () => {
    const c = muat({ APP_VARIANT: 'preview', ADMOB_ANDROID_APP_ID: 'ca-app-pub-111~1' }).default(konteks());
    expect(c.plugins).toContainEqual([
      'react-native-google-mobile-ads',
      { androidAppId: 'ca-app-pub-111~1', iosAppId: 'ca-app-pub-3940256099942544~1458002511' },
    ]);
    expect(c.android?.blockedPermissions).toEqual(['android.permission.SYSTEM_ALERT_WINDOW']);
  });

  it('google-services.json dari env file EAS (GOOGLE_SERVICES_JSON)', () => {
    const c = muat({ APP_VARIANT: 'production', GOOGLE_SERVICES_JSON: '/tmp/eas/google-services.json' }).default(konteks());
    expect(c.android?.googleServicesFile).toBe('/tmp/eas/google-services.json');
  });

  it('EAS Build production dengan konfigurasi kurang: build dihentikan dengan daftar yang jelas', () => {
    const kosong = Object.fromEntries(Object.keys(LENGKAP).map((k) => [k, undefined]));
    const m = muat({ ...kosong, APP_VARIANT: 'production', EAS_BUILD: 'true' });
    expect(() => m.default(konteks())).toThrow(/Build Play Store dihentikan[\s\S]*EXPO_PUBLIC_SUPABASE_URL kosong/);
  });

  it('EAS Build production dengan konfigurasi lengkap: lolos', () => {
    const m = muat({ ...LENGKAP, APP_VARIANT: 'production', EAS_BUILD: 'true' });
    expect(m.default(konteks()).android?.package).toBe('id.arta.keuangan');
  });
});
