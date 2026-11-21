import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarJudul } from '@/components/BarJudul';
import { IsiBudget } from '@/components/IsiBudget';
import { Tombol } from '@/components/Tombol';

export default function BudgetIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-3 px-[18px]"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
    >
      <BarJudul judul="Budget" onKembali={tutup} />
      <IsiBudget onUbah={(id) => router.push(`/budget/ubah?id=${id}`)} />
      <Tombol primary label="Tambah budget" onPress={() => router.push('/budget/ubah')} />
    </ScrollView>
  );
}
