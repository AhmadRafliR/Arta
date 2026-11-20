import { Text, View } from 'react-native';
import { labelJatuhTempo } from '@/domain/hutang';
import { formatRupiah } from '@/domain/money';
import type { Tagihan } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

// Satu baris jadwal: nominal, tanggal jatuh tempo, dan status (Lunas / sisa hari).
export function BarisTagihan({ tagihan, hariIni }: { tagihan: Tagihan; hariIni: string }) {
  const { t } = useTheme();
  const lunas = tagihan.status === 'lunas';
  return (
    <View className="flex-row items-center justify-between py-2.5">
      <View>
        <Text className="text-[15px] font-semibold text-fg font-sans">{formatRupiah(tagihan.nominal)}</Text>
        <Text className="text-xs text-fg2 font-sans">{tagihan.jatuh_tempo}</Text>
      </View>
      {lunas ? (
        <Text className="text-xs font-semibold text-accink font-sans">Lunas</Text>
      ) : (
        <Text style={{ color: t.warnInk }} className="text-xs font-semibold font-sans">
          {labelJatuhTempo(tagihan.jatuh_tempo, hariIni)}
        </Text>
      )}
    </View>
  );
}
