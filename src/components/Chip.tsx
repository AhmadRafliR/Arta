import { Pressable, Text } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { label: string; selected: boolean; onPress: () => void; testID?: string; ikon?: NamaIkon };

// Pilihan bergaya chip (mockup arta: .chip / .fchip). Terpilih = latar aksen lembut + garis dan teks accInk.
export function Chip({ label, selected, onPress, testID, ikon }: Props) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={{ minHeight: 38 }}
      className={`flex-row items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 ${
        selected ? 'border-accink bg-accsoft' : 'border-line bg-card'
      }`}
    >
      {ikon ? <Ikon nama={ikon} ukuran={16} warna={selected ? t.accInk : t.fg2} /> : null}
      <Text className={`font-sans text-[13px] font-semibold ${selected ? 'text-accink' : 'text-fg2'}`}>{label}</Text>
    </Pressable>
  );
}
