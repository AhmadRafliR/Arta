import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarBudget } from '@/components/BarBudget';
import { KeadaanKosong } from '@/components/KeadaanKosong';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { useBudgets } from '@/data/budgets';
import { useTransactions } from '@/data/transactions';
import { pemakaianBudget } from '@/domain/budget';
import { formatRupiah } from '@/domain/money';
import { hariIni, labelBulan } from '@/lib/tanggal';

export default function BudgetIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const bulan = hariIni(profile?.zona_waktu || undefined).slice(0, 7);
  const budgets = useBudgets();
  const txs = useTransactions(bulan);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));

  const galat = budgets.error ?? txs.error;
  const siap = budgets.data !== undefined && txs.data !== undefined;
  const daftar = siap ? pemakaianBudget(budgets.data ?? [], txs.data ?? [], bulan) : [];
  const totalTerpakai = daftar.reduce((s, p) => s + p.terpakai, 0);
  const totalBatas = daftar.reduce((s, p) => s + p.batas, 0);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-4 px-5"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-fg font-sans">Budget</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Kembali" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Kembali</Text>
        </Pressable>
      </View>

      <Text className="text-xs text-mid font-sans">{labelBulan(bulan)}</Text>

      {galat ? (
        <Text className="text-fg font-sans">{galat.pesan}</Text>
      ) : !siap ? (
        <Text className="text-mid font-sans">Memuat…</Text>
      ) : daftar.length === 0 ? (
        <KeadaanKosong
          ikon="status-budget-aman"
          pesan="Belum ada budget. Pasang batas bulanan per kategori supaya pengeluaran tetap terkendali."
        />
      ) : (
        <>
          <Text className="text-base font-bold text-fg font-sans">
            {`Terpakai ${formatRupiah(totalTerpakai)} dari ${formatRupiah(totalBatas)}`}
          </Text>
          <View className="gap-4 rounded-2xl border border-line bg-card p-4">
            {daftar.map((p) => (
              <BarBudget key={p.id} p={p} onPress={() => router.push(`/budget/ubah?id=${p.id}`)} />
            ))}
          </View>
        </>
      )}

      <Tombol primary label="Tambah budget" onPress={() => router.push('/budget/ubah')} />
    </ScrollView>
  );
}
