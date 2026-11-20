import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmountInput } from '@/components/AmountInput';
import { kapital } from '@/components/BarBudget';
import { Chip } from '@/components/Chip';
import { Tombol } from '@/components/Tombol';
import { pesanBudget, useBudgets, useHapusBudget, useSimpanBudget } from '@/data/budgets';
import { useCategories } from '@/data/categories';

const kunci = (s: string) => s.trim().toLowerCase();

export default function BudgetUbah() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const budgets = useBudgets();
  const kategoriQ = useCategories('pengeluaran');
  const simpanM = useSimpanBudget();
  const hapusM = useHapusBudget();
  const [pilih, setPilih] = useState<string | null>(null);
  const [batasIsi, setBatas] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/budget'));

  const ada = id ? (budgets.data ?? []).find((b) => b.id === id) : undefined;
  const ubah = !!id;
  const terpakaiKunci = new Set((budgets.data ?? []).map((b) => kunci(b.kategori)));
  const opsi = (kategoriQ.data ?? []).filter((k) => !terpakaiKunci.has(kunci(k.nama)));
  const batas = batasIsi === undefined ? (ada?.batas_bulanan ?? null) : batasIsi;
  const kategori = ubah ? (ada?.kategori ?? null) : pilih;
  const valid = kategori !== null && batas !== null && batas > 0;

  async function simpan() {
    if (!valid || busy || kategori === null || batas === null) return;
    setBusy(true);
    setPesan(null);
    try {
      await simpanM.mutateAsync({ id: ada?.id, kategori, batas_bulanan: batas });
      tutup();
    } catch (e) {
      setPesan(pesanBudget(e));
    } finally {
      setBusy(false);
    }
  }

  async function lakukanHapus() {
    if (!ada) return;
    setBusy(true);
    setPesan(null);
    try {
      await hapusM.mutateAsync(ada.id);
      tutup();
    } catch (e) {
      setPesan(pesanBudget(e));
    } finally {
      setBusy(false);
    }
  }

  function konfirmasiHapus() {
    if (!ada) return;
    Alert.alert(`Hapus budget ${ada.kategori}?`, undefined, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => void lakukanHapus() },
    ]);
  }

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-4 px-5"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-fg font-sans">{ubah ? 'Ubah budget' : 'Tambah budget'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Batal" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Batal</Text>
        </Pressable>
      </View>

      {ubah && budgets.data && !ada ? (
        <Text className="text-fg font-sans">Budget tidak ditemukan</Text>
      ) : ubah && !budgets.data ? (
        <Text className="text-mid font-sans">{budgets.error ? budgets.error.pesan : 'Memuat…'}</Text>
      ) : (
        <>
          <Text className="text-mid font-sans">Kategori</Text>
          {ubah ? (
            <Text className="text-base font-bold text-fg font-sans">{kapital(ada?.kategori ?? '')}</Text>
          ) : opsi.length === 0 ? (
            <Text className="text-mid font-sans">
              {kategoriQ.data ? 'Semua kategori pengeluaran sudah punya budget.' : 'Memuat…'}
            </Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {opsi.map((k) => (
                <Chip key={k.id} testID={`kat-${k.nama}`} label={k.nama} selected={pilih === k.nama} onPress={() => setPilih(k.nama)} />
              ))}
            </View>
          )}

          <Text className="text-mid font-sans">Batas per bulan</Text>
          <AmountInput value={ada?.batas_bulanan ?? null} onChange={setBatas} testID="batas" />

          <Tombol primary label="Simpan" busy={busy} disabled={!valid || busy} onPress={() => void simpan()} />
          {ubah ? <Tombol label="Hapus budget" disabled={busy} onPress={konfirmasiHapus} /> : null}
        </>
      )}
      {pesan ? <Text className="text-fg font-sans">{pesan}</Text> : null}
    </ScrollView>
  );
}
