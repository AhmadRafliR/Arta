import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeadaanKosong } from '@/components/KeadaanKosong';
import { useGulirPulau } from '@/nav/useGulirPulau';
import { spacerNav } from '@/nav/pulau';

// Placeholder; fitur hutang belum dibangun.
export default function Hutang() {
  const insets = useSafeAreaInsets();
  // Tanpa gulir: tetap lapor fokus agar tab bar kembali penuh.
  useGulirPulau('hutang');
  return (
    <View className="flex-1 justify-center bg-bg px-4" style={{ paddingBottom: spacerNav(insets.bottom) }}>
      <KeadaanKosong ikon="nav-hutang" pesan="Pencatatan hutang & paylater segera hadir." />
    </View>
  );
}
