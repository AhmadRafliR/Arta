import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Tombol } from '@/components/Tombol';
import { batalkanBaruMasuk, tandaiBaruMasuk } from '@/auth/baruMasuk';
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
    // Ditandai SEBELUM memanggil: onAuthStateChange bisa terpicu sebelum await selesai.
    tandaiBaruMasuk();
    const { error: err } = await supabase.auth.verifyOtp({ email, token: kode, type: 'email' });
    setBusy(false);
    // Berhasil: onAuthStateChange memicu transisi + pengalihan otomatis di AuthGate.
    if (err) {
      batalkanBaruMasuk();
      setError(pesanAuth(err, 'Kode salah atau kedaluwarsa.'));
    }
  }

  return (
    <View className="flex-1 justify-center gap-4 bg-bg px-6">
      <Text className="text-2xl font-bold text-fg font-sans">Masukkan kode</Text>
      <Text className="text-mid font-sans">Kami mengirim kode 6 digit ke {email}.</Text>
      <TextInput
        value={kode}
        onChangeText={(v) => setKode(v.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
        className="rounded-xl border border-line bg-card px-4 py-3 text-center text-xl text-fg font-sans"
      />
      <Tombol label="Verifikasi" primary busy={busy} disabled={busy} onPress={() => void verifikasi()} />
      {error ? <Text className="text-fg font-sans">{error}</Text> : null}
    </View>
  );
}
