import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeadaanKosong } from '@/components/KeadaanKosong';
import { useGulirPulau } from '@/nav/useGulirPulau';
import { TINGGI_NAV } from '@/nav/pulau';

// Placeholder; fitur hutang belum dibangun.
export default function Hutang() {
  const insets = useSafeAreaInsets();
  // Tanpa gulir: tetap lapor fokus agar tab bar kembali penuh.
  useGulirPulau('hutang');
  return (
    <View className="flex-1 justify-center bg-bg px-4" style={{ paddingBottom: TINGGI_NAV + insets.bottom + 16 }}>
      <KeadaanKosong ikon="nav-hutang" pesan="Pencatatan hutang & paylater segera hadir." />
    </View>
  );
}
