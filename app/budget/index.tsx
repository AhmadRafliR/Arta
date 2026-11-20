import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarBudget } from '@/components/BarBudget';
import { BarJudul } from '@/components/BarJudul';
import { KeadaanKosong } from '@/components/KeadaanKosong';
import { KepalaSheet } from '@/components/SheetBawah';
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
      contentContainerClassName="gap-3 px-[18px]"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
    >
      <BarJudul judul="Budget" onKembali={tutup} />

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
        // Kartu budget bulan ini (mockup akun: budgetView): kepala + daftar bergaris per kategori.
        <View className="gap-3 rounded-[20px] border border-line bg-card px-3.5 pb-3.5 pt-3.5">
          <KepalaSheet
            ikon="ui-budget"
            judul={`Budget ${labelBulan(bulan)}`}
            sub={`Terpakai ${formatRupiah(totalTerpakai)} dari ${formatRupiah(totalBatas)}`}
            kanan={totalBatas > 0 ? `${Math.round((totalTerpakai * 100) / totalBatas)}%` : undefined}
          />
          <View className="overflow-hidden rounded-[14px] border border-line">
            {daftar.map((p, i) => (
              <View key={p.id} className={`px-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}>
                <BarBudget p={p} onPress={() => router.push(`/budget/ubah?id=${p.id}`)} />
              </View>
            ))}
          </View>
          <Text className="font-sans text-[11.5px] leading-[17px] text-fg2">Ketuk kategori untuk mengubah atau menghapus batasnya.</Text>
        </View>
      )}

      <Tombol primary label="Tambah budget" onPress={() => router.push('/budget/ubah')} />
    </ScrollView>
  );
}
