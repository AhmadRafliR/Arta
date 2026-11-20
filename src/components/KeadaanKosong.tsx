import { Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { useTheme } from '@/theme/ThemeProvider';

// Kartu keadaan kosong. Slot ilustrasi menyusul (menunggu SVG dari Rafli).
export function KeadaanKosong({ ikon, pesan }: { ikon: NamaIkon; pesan: string }) {
  const { t } = useTheme();
  return (
    <View className="items-center gap-3 rounded-2xl border border-line bg-card2 px-6 py-8">
      <View className="h-16 w-16 items-center justify-center rounded-full border border-line bg-card">
        <Ikon nama={ikon} ukuran={32} warna={t.mid} />
      </View>
      <Text className="text-center font-sans text-fg2" style={{ fontSize: 13.5, lineHeight: 20 }}>
        {pesan}
      </Text>
    </View>
  );
}
