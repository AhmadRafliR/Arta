import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Nilai env diisi pemilik di .env. Placeholder agar import tidak crash saat env kosong (mis. Jest).
const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// Build rilis tanpa konfigurasi tidak boleh diam-diam menyasar localhost.
if (!__DEV__ && (!envUrl || !envKey)) {
  throw new Error('Konfigurasi Supabase belum diisi (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).');
}
const url = envUrl || 'http://localhost:54321';
const anonKey = envKey || 'anon-key-kosong';

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auto-refresh token hanya saat aplikasi aktif (panduan supabase-js untuk React Native).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
