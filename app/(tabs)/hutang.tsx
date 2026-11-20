import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGulirPulau } from '@/nav/useGulirPulau';
import { TINGGI_NAV } from '@/nav/pulau';

// Placeholder; fitur hutang belum dibangun.
export default function Hutang() {
  const insets = useSafeAreaInsets();
  // Tanpa gulir: tetap lapor fokus agar tab bar kembali penuh.
  useGulirPulau('hutang');
  return (
    <View className="flex-1 items-center justify-center bg-bg" style={{ paddingBottom: TINGGI_NAV + insets.bottom + 16 }}>
      <Text className="text-lg font-bold text-fg font-sans">Hutang</Text>
      <Text className="text-mid font-sans">Segera hadir</Text>
    </View>
  );
}
