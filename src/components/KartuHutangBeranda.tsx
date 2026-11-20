import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { labelJatuhTempo, type RingkasanHutang } from '@/domain/hutang';
import { formatRupiah } from '@/domain/money';
import { labelBulan } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { ringkas: RingkasanHutang; hariIni: string; onPress: () => void };

// Kartu hutang di Beranda (pola .debt-card di kit.html). Ketuk -> tab Hutang.
export function KartuHutangBeranda({ ringkas, hariIni, onPress }: Props) {
  const { t } = useTheme();
  const { berikutnya, totalSisa, bebasPada } = ringkas;
  const sub = `Sisa ${formatRupiah(totalSisa)}${bebasPada ? ` · bebas hutang ${labelBulan(bebasPada)}` : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hutang"
      onPress={onPress}
      className="gap-1.5 rounded-2xl border border-line bg-card px-4 py-3.5"
    >
      <View className="flex-row items-center gap-2.5">
        <Ikon nama="nav-hutang" ukuran={20} warna={t.fg2} />
        <Text className="text-[15px] font-semibold text-fg font-sans" numberOfLines={1}>
          {berikutnya ? `${berikutnya.hutang.pemberi} · ${formatRupiah(berikutnya.nominal)}` : 'Hutang'}
        </Text>
        {berikutnya ? (
          <View className="ml-auto flex-row items-center gap-1.5">
            <Ikon nama="status-jatuh-tempo" ukuran={18} warna={t.warnInk} />
            <Text className="text-xs font-semibold font-sans" style={{ color: t.warnInk }}>
              {labelJatuhTempo(berikutnya.tanggal, hariIni)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="text-[12.5px] text-fg2 font-sans">{sub}</Text>
    </Pressable>
  );
}
