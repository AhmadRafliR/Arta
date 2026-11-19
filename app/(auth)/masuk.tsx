import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export default function Masuk() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function kirimKode() {
    const e = email.trim();
    if (!e) return setError('Isi email dulu.');
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email: e });
    setBusy(false);
    if (err) return setError('Gagal mengirim kode. Coba lagi.');
    router.push({ pathname: '/(auth)/kode', params: { email: e } });
  }

  async function masukGoogle() {
    setBusy(true);
    setError(null);
    try {
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
      await GoogleSignin.hasPlayServices();
      const res = await GoogleSignin.signIn();
      const token = res.type === 'success' ? res.data.idToken : null;
      if (!token) {
        setBusy(false);
        return; // dibatalkan pengguna
      }
      const { error: err } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
      if (err) setError('Masuk dengan Google gagal. Coba lagi.');
    } catch {
      setError('Masuk dengan Google gagal. Coba lagi.');
    }
    setBusy(false);
  }

  return (
    <View className="flex-1 justify-center gap-4 bg-bg px-6">
      <Text className="text-2xl font-bold text-fg">Masuk</Text>
      {GOOGLE_WEB_CLIENT_ID ? (
        <Pressable onPress={masukGoogle} disabled={busy} className="items-center rounded-xl bg-acc py-3">
          <Text className="font-semibold text-white">Masuk dengan Google</Text>
        </Pressable>
      ) : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        className="rounded-xl border border-line bg-card px-4 py-3 text-fg"
      />
      <Pressable onPress={kirimKode} disabled={busy} className="items-center rounded-xl border border-line bg-card py-3">
        {busy ? <ActivityIndicator /> : <Text className="font-semibold text-fg">Kirim kode</Text>}
      </Pressable>
      {error ? <Text className="text-fg">{error}</Text> : null}
    </View>
  );
}
