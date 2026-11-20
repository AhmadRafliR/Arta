import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Tombol } from '@/components/Tombol';
import { hapusAkun } from '@/data/akun';
import { usePro } from '@/data/langganan';
import { useTheme } from '@/theme/ThemeProvider';

export const URL_LANGGANAN_PLAY = 'https://play.google.com/store/account/subscriptions';
export const PESAN_LANGGANAN =
  'Menghapus akun tidak membatalkan langganan Google Play. Batalkan dulu di Play Store agar tidak ditagih lagi.';

const DAFTAR = [
  'Dompet',
  'Transaksi',
  'Kategori',
  'Hutang & jadwal',
  'Budget',
  'Pengaturan',
  'Kuota',
  'Token notifikasi',
  'Status langganan',
];

// Hapus akun permanen (modal). Konfirmasi dengan mengetik HAPUS; sukses → sesi hilang, AuthGate ke layar masuk.
export default function HapusAkun() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTheme();
  const { pro } = usePro();
  const [teks, setTeks] = useState('');
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const siap = teks === 'HAPUS' && !busy;
  const batal = () => (router.canGoBack() ? router.back() : router.replace('/akun'));

  async function hapus() {
    if (!siap) return;
    setBusy(true);
    setPesan(null);
    try {
      await hapusAkun();
      qc.clear();
    } catch (e) {
      const p = e && typeof e === 'object' && 'pesan' in e ? (e as { pesan: unknown }).pesan : null;
      setPesan(typeof p === 'string' && p ? p : 'Akun belum terhapus, coba lagi.');
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 px-5 py-6" keyboardShouldPersistTaps="handled">
      <Text className="text-xl font-bold text-fg font-sans">Hapus akun</Text>
      <Text className="text-mid font-sans">
        Akun dan semua datamu akan dihapus permanen dan tidak bisa dikembalikan. Yang akan dihapus:
      </Text>
      <View className="gap-2 rounded-2xl border border-line bg-card p-4">
        {DAFTAR.map((x) => (
          <Text key={x} className="text-fg font-sans">
            {'• ' + x}
          </Text>
        ))}
      </View>

      {pro ? (
        <View style={{ borderColor: t.warn }} className="gap-3 rounded-2xl border bg-card p-4">
          <Text style={{ color: t.warnInk }} className="font-semibold font-sans">
            {PESAN_LANGGANAN}
          </Text>
          <Tombol label="Kelola langganan" onPress={() => void Linking.openURL(URL_LANGGANAN_PLAY)} />
        </View>
      ) : null}

      <Text className="font-semibold text-fg font-sans">Ketik HAPUS untuk konfirmasi</Text>
      <TextInput
        value={teks}
        onChangeText={setTeks}
        accessibilityLabel="Ketik HAPUS"
        placeholder="HAPUS"
        placeholderTextColor={t.mid}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!busy}
        className="rounded-xl border border-line bg-card px-4 py-3 text-fg font-sans"
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hapus akun permanen"
        accessibilityState={{ disabled: !siap }}
        disabled={!siap}
        onPress={() => void hapus()}
        style={{ minHeight: 54, backgroundColor: t.danger }}
        className={`items-center justify-center rounded-2xl px-6 ${siap ? '' : 'opacity-50'}`}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16 }} className="font-bold font-sans">
          {busy ? 'Menghapus…' : 'Hapus akun permanen'}
        </Text>
      </Pressable>
      <Tombol label="Batal" onPress={batal} disabled={busy} />
      {pesan ? (
        <Text style={{ color: t.dangerInk }} className="font-sans">
          {pesan}
        </Text>
      ) : null}
    </ScrollView>
  );
}
