import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AmountInput } from '@/components/AmountInput';
import { Chip } from '@/components/Chip';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import type { TipeDompet } from '@/domain/types';
import { hariIni } from '@/lib/tanggal';
import { pesanDompet } from '@/data/pesan';
import { useCreateWallet } from '@/data/wallets';
import { useTheme } from '@/theme/ThemeProvider';

const TIPE: { v: TipeDompet; label: string }[] = [
  { v: 'harian', label: 'Harian' },
  { v: 'darurat', label: 'Darurat' },
  { v: 'investasi', label: 'Investasi' },
];

export default function DompetBaru() {
  const router = useRouter();
  const { profile } = useAuth();
  const { t } = useTheme();
  const create = useCreateWallet();
  const [nama, setNama] = useState('');
  const { tipe: tipeAwal } = useLocalSearchParams<{ tipe?: string }>();
  const [tipe, setTipe] = useState<TipeDompet>(TIPE.find((x) => x.v === tipeAwal)?.v ?? 'harian');
  const [saldo, setSaldo] = useState<number | null>(0);
  const [target, setTarget] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));
  const valid = nama.trim() !== '' && saldo !== null && (tipe !== 'darurat' || target !== null);

  async function simpan() {
    if (!valid || busy) return;
    setBusy(true);
    setPesan(null);
    try {
      await create.mutateAsync({
        nama: nama.trim(),
        tipe,
        saldo_awal: saldo ?? 0,
        tanggal_saldo_awal: hariIni(profile?.zona_waktu),
        target: tipe === 'darurat' && target ? target : null,
      });
      tutup();
    } catch (e) {
      setPesan(pesanDompet(e, { namaUnik: true }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 px-5 py-6">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-fg font-sans">Tambah dompet</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Batal" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Batal</Text>
        </Pressable>
      </View>
      <TextInput
        value={nama}
        onChangeText={setNama}
        accessibilityLabel="Nama dompet"
        placeholder="Nama dompet"
        placeholderTextColor={t.mid}
        className="rounded-xl border border-line bg-card px-4 py-3 text-fg font-sans"
      />
      <View className="flex-row flex-wrap gap-2">
        {TIPE.map((x) => (
          <Chip key={x.v} label={x.label} selected={tipe === x.v} onPress={() => setTipe(x.v)} />
        ))}
      </View>
      <Text className="text-mid font-sans">Saldo awal</Text>
      <AmountInput value={null} allowZero onChange={setSaldo} testID="saldo-awal" />
      {tipe === 'darurat' ? (
        <>
          <Text className="text-mid font-sans">Target (opsional)</Text>
          <AmountInput value={null} allowZero onChange={setTarget} testID="target" />
        </>
      ) : null}
      <Tombol label="Simpan" primary busy={busy} disabled={!valid || busy} onPress={() => void simpan()} />
      {pesan ? <Text className="text-fg font-sans">{pesan}</Text> : null}
    </ScrollView>
  );
}
