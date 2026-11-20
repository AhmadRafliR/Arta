import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BarBudget } from '@/components/BarBudget';
import { useAuth } from '@/auth/AuthProvider';
import { useBudgets } from '@/data/budgets';
import { useTransactions } from '@/data/transactions';
import { kategoriKritis, pemakaianBudget } from '@/domain/budget';
import { hariIni } from '@/lib/tanggal';

// Kartu Beranda. Tidak pernah memblokir: memuat, galat, atau tanpa budget -> tidak tampil.
export function KartuBudgetKritis() {
  const router = useRouter();
  const { profile } = useAuth();
  const bulan = hariIni(profile?.zona_waktu || undefined).slice(0, 7);
  const budgets = useBudgets();
  const txs = useTransactions(bulan);
  if (!budgets.data || budgets.data.length === 0 || !txs.data) return null;
  const kritis = kategoriKritis(pemakaianBudget(budgets.data, txs.data, bulan));
  if (!kritis) return null;
  return (
    <View className="gap-2 rounded-2xl border border-line bg-card p-3">
      <Text className="text-xs font-bold text-fg font-sans">Budget paling kritis</Text>
      <BarBudget p={kritis} onPress={() => router.push('/budget')} />
    </View>
  );
}
