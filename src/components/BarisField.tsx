import { Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { ikon: NamaIkon; label: string; pertama?: boolean; children: React.ReactNode };

// Baris isian: petak ikon 38 + label kecil + isian (mockup arta: .field-row). `pertama` = tanpa garis atas.
export function BarisField({ ikon, label, pertama, children }: Props) {
  const { t } = useTheme();
  return (
    <View className={`flex-row items-center gap-3 py-[11px] ${pertama ? 'pt-0.5' : 'border-t border-line'}`}>
      <View style={{ width: 38, height: 38 }} className="items-center justify-center rounded-xl bg-card2">
        <Ikon nama={ikon} ukuran={19} warna={t.fg2} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans text-[11.5px] font-semibold text-mid">{label}</Text>
        {children}
      </View>
    </View>
  );
}
