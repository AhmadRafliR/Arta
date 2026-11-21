import { useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { MarkArta } from '@/components/MarkArta';
import { Tombol } from '@/components/Tombol';
import { pesanAuth } from '@/auth/pesanAuth';
import { supabase } from '@/lib/supabase';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export default function Masuk() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref, bukan state: dua tekan "kirim" dalam satu tick masih melihat busy lama.
  const sedangKirim = useRef(false);

  async function kirimKode() {
    if (busy || sedangKirim.current) return;
    const e = email.trim();
    if (!e) return setError('Isi email dulu.');
    sedangKirim.current = true;
    setBusy(true);
    setError(null);
    let err: unknown = null;
    try {
      ({ error: err } = await supabase.auth.signInWithOtp({ email: e }));
    } catch (x) {
      err = x; // galat jaringan yang dilempar → pesan offline lewat pesanAuth
    } finally {
      sedangKirim.current = false;
      setBusy(false);
    }
    if (err) return setError(pesanAuth(err, 'Gagal mengirim kode. Coba lagi.'));
    router.push({ pathname: '/(auth)/kode', params: { email: e } });
  }

  async function masukGoogle() {
    if (busy || sedangKirim.current) return;
    if (!GOOGLE_WEB_CLIENT_ID) {
      return setError('Masuk dengan Google belum dikonfigurasi di build ini. Pakai email dulu.');
    }
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
    } catch (x) {
      const kode = String((x as { code?: unknown } | null)?.code ?? '');
      setError(
        kode === '10' || kode === 'DEVELOPER_ERROR'
          ? 'Konfigurasi Google belum cocok dengan aplikasi ini (SHA-1 / client ID). Pakai email dulu.'
          : 'Masuk dengan Google gagal. Coba lagi.',
      );
    }
    setBusy(false);
  }

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-4 px-6"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center gap-1 pb-4">
        <MarkArta ukuran={52} dekoratif />
        <Text className="text-[30px] font-semibold tracking-wide text-fg font-sans">arta</Text>
        <Text className="text-xs tracking-[0.22em] text-mid font-sans">OWN YOUR MONEY</Text>
      </View>
      <Text className="text-2xl font-bold text-fg font-sans">Masuk</Text>
      <Tombol label="Masuk dengan Google" primary disabled={busy} onPress={() => void masukGoogle()} />
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-line" />
        <Text className="text-xs text-mid font-sans">atau pakai email</Text>
        <View className="h-px flex-1 bg-line" />
      </View>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={() => void kirimKode()}
        className="rounded-xl border border-line bg-card px-4 py-3 text-fg font-sans"
      />
      <Tombol label="Kirim kode" busy={busy} disabled={busy} onPress={() => void kirimKode()} />
      {error ? <Text className="text-fg font-sans">{error}</Text> : null}
    </ScrollView>
  );
}
