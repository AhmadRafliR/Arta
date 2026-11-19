import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Tombol } from '@/components/Tombol';
import { pesanAuth } from '@/auth/pesanAuth';
import { supabase } from '@/lib/supabase';

export default function Kode() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [kode, setKode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verifikasi() {
    if (kode.length !== 6) return setError('Kode terdiri dari 6 digit.');
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: kode, type: 'email' });
    setBusy(false);
    // Berhasil: onAuthStateChange memicu pengalihan otomatis di AuthGate.
    if (err) setError(pesanAuth(err, 'Kode salah atau kedaluwarsa.'));
  }

  return (
    <View className="flex-1 justify-center gap-4 bg-bg px-6">
      <Text className="text-2xl font-bold text-fg">Masukkan kode</Text>
      <Text className="text-mid">Kami mengirim kode 6 digit ke {email}.</Text>
      <TextInput
        value={kode}
        onChangeText={(v) => setKode(v.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
        className="rounded-xl border border-line bg-card px-4 py-3 text-center text-xl text-fg"
      />
      <Tombol label="Verifikasi" primary busy={busy} disabled={busy} onPress={() => void verifikasi()} />
      {error ? <Text className="text-fg">{error}</Text> : null}
    </View>
  );
}
