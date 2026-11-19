describe('konfigurasi supabase', () => {
  const awal = { url: process.env.EXPO_PUBLIC_SUPABASE_URL, key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY };
  const dev = (globalThis as unknown as { __DEV__: boolean }).__DEV__;
  afterEach(() => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = dev;
    process.env.EXPO_PUBLIC_SUPABASE_URL = awal.url;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = awal.key;
    if (awal.url === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (awal.key === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('rilis (!__DEV__) tanpa env -> melempar galat jelas', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
    jest.isolateModules(() => {
      expect(() => require('../supabase')).toThrow('Konfigurasi Supabase belum diisi');
    });
  });

  it('dev / Jest tanpa env -> tetap memakai placeholder', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    jest.isolateModules(() => {
      expect(() => require('../supabase')).not.toThrow();
    });
  });
});
