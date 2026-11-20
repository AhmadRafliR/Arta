import { ScrollView, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { ikonDompet } from '@/components/ikon/peta';
import { formatRingkas } from '@/domain/money';
import type { TipeDompet } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

export type DompetChip = { id: string; nama: string; saldo: number; tipe: TipeDompet };

export function WalletChips({ dompet }: { dompet: DompetChip[] }) {
  const { t } = useTheme();
  if (dompet.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      testID="rel-dompet"
      contentContainerClassName="gap-2"
    >
      {dompet.map((d) => (
        <View key={d.id} className="flex-row items-center gap-2 rounded-full border border-line bg-card px-3 py-2">
          <Ikon nama={ikonDompet(d.tipe)} ukuran={18} warna={t.fg2} />
          <Text className="max-w-[140px] text-[13px] font-semibold text-fg font-sans" numberOfLines={1}>
            {d.nama}
          </Text>
          <Text style={{ color: t.fg2 }} className="text-[13px] font-sans">
            {formatRingkas(d.saldo)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
