import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmountInput } from '@/components/AmountInput';
import { kapital } from '@/components/BarBudget';
import { Chip } from '@/components/Chip';
import { KepalaSheet } from '@/components/SheetBawah';
import { Ikon } from '@/components/ikon/Ikon';
import { Tombol } from '@/components/Tombol';
import { useTheme } from '@/theme/ThemeProvider';
import { pesanBudget, useBudgets, useHapusBudget, useSimpanBudget } from '@/data/budgets';
import { useCategories } from '@/data/categories';
import { adalahBudgetSemua, KATEGORI_SEMUA, labelKategoriBudget } from '@/domain/budget';

const LABEL_SEMUA = 'Seluruh kategori';
const kunci = (s: string) => s.trim().toLowerCase();

export default function BudgetUbah() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
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
  const adaSemua = (budgets.data ?? []).some((b) => adalahBudgetSemua(b.kategori));
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
    Alert.alert(`Hapus budget ${labelKategoriBudget(ada.kategori)}?`, undefined, [
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
      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <KepalaSheet
            ikon="ui-budget"
            judul={ubah ? 'Ubah budget' : 'Tambah budget'}
            sub={ubah && ada && adalahBudgetSemua(ada.kategori) ? 'Batas total semua pengeluaran tiap bulan' : 'Batas pengeluaran per kategori tiap bulan'}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Batal"
          onPress={tutup}
          style={{ width: 38, height: 38 }}
          className="items-center justify-center rounded-full border border-line bg-card"
        >
          <Ikon nama="ui-close" ukuran={18} warna={t.fg} />
        </Pressable>
      </View>

      {ubah && budgets.data && !ada ? (
        <Text className="text-fg font-sans">Budget tidak ditemukan</Text>
      ) : ubah && !budgets.data ? (
        <Text className="text-mid font-sans">{budgets.error ? budgets.error.pesan : 'Memuat…'}</Text>
      ) : (
        <>
          <View className="gap-2">
            <Text className="font-sans text-[11.5px] font-semibold text-mid">Kategori</Text>
            {ubah ? (
              <View className="rounded-[14px] border border-line bg-card px-3.5 py-3">
                <Text className="font-sans text-[14.5px] font-semibold text-fg">{kapital(labelKategoriBudget(ada?.kategori ?? ''))}</Text>
              </View>
            ) : opsi.length === 0 && adaSemua ? (
              <Text className="font-sans text-mid">
                {kategoriQ.data ? 'Semua kategori pengeluaran sudah punya budget.' : 'Memuat…'}
              </Text>
            ) : (
              <View className="gap-2.5 rounded-[14px] border border-line bg-card p-3">
                {adaSemua ? null : (
                  <View className="gap-1.5 border-b border-line pb-2.5">
                    <View className="flex-row">
                      <Chip
                        testID="kat-semua"
                        label={LABEL_SEMUA}
                        ikon="ui-sigma"
                        selected={pilih === KATEGORI_SEMUA}
                        onPress={() => setPilih(KATEGORI_SEMUA)}
                      />
                    </View>
                    <Text className="font-sans text-xs text-mid">Batas total semua pengeluaran dalam sebulan</Text>
                  </View>
                )}
                <View className="flex-row flex-wrap gap-2">
                  {opsi.map((k) => (
                    <Chip key={k.id} testID={`kat-${k.nama}`} label={k.nama} selected={pilih === k.nama} onPress={() => setPilih(k.nama)} />
                  ))}
                </View>
                {pilih ? (
                  <Text className="font-sans text-xs text-mid">
                    Dipilih: <Text className="font-sans font-semibold text-fg">{kapital(labelKategoriBudget(pilih))}</Text>
                  </Text>
                ) : null}
              </View>
            )}
          </View>

          <View className="gap-1.5">
            <Text className="font-sans text-[11.5px] font-semibold text-mid">Batas per bulan (Rp)</Text>
            <AmountInput value={ada?.batas_bulanan ?? null} onChange={setBatas} testID="batas" />
            <Text className="font-sans text-xs text-mid">Kamu akan diingatkan saat terpakai 80%.</Text>
          </View>

          <Tombol primary label="Simpan" busy={busy} disabled={!valid || busy} onPress={() => void simpan()} />
          {ubah ? <Tombol label="Hapus budget" disabled={busy} onPress={konfirmasiHapus} /> : null}
        </>
      )}
      {pesan ? <Text className="text-fg font-sans">{pesan}</Text> : null}
    </ScrollView>
  );
}
