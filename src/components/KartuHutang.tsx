import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { labelJatuhTempo } from '@/domain/hutang';
import { formatRupiah } from '@/domain/money';
import type { Hutang } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { hutang: Hutang; hariIni: string; onPress: () => void };

// Kartu hutang (gaya .debt-card): pemberi + badge jatuh tempo, sisa pokok besar, sub keterangan.
export function KartuHutang({ hutang: h, hariIni, onPress }: Props) {
  const { t } = useTheme();
  const lunas = h.sisa_pokok <= 0;
  const sub =
    h.tipe === 'cicilan_tetap'
      ? `Sisa pokok · ${h.tagihan_lunas} dari ${h.jumlah_tagihan} cicilan lunas`
      : `Sisa pokok · bunga ${h.bunga_persen_bulanan ?? 0}%/bln ${h.metode ?? ''}`.trim();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={h.pemberi}
      onPress={onPress}
      className="gap-1 rounded-2xl border border-line bg-card p-4"
    >
      <View className="flex-row items-center gap-2">
        <Ikon nama="nav-hutang" ukuran={20} warna={t.fg2} />
        <Text className="flex-1 text-[15px] font-semibold text-fg font-sans" numberOfLines={1}>
          {h.pemberi}
        </Text>
        {lunas ? (
          <View className="flex-row items-center gap-1">
            <Ikon nama="status-lunas" ukuran={16} warna={t.warnInk} />
            <Text style={{ color: t.warnInk }} className="text-xs font-semibold font-sans">
              Lunas
            </Text>
          </View>
        ) : h.jatuh_tempo_berikutnya ? (
          <View className="flex-row items-center gap-1">
            <Ikon nama="status-jatuh-tempo" ukuran={16} warna={t.warnInk} />
            <Text style={{ color: t.warnInk }} className="text-xs font-semibold font-sans">
              {labelJatuhTempo(h.jatuh_tempo_berikutnya, hariIni)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="text-2xl font-bold text-fg font-sans">{formatRupiah(h.sisa_pokok)}</Text>
      <Text className="text-xs text-fg2 font-sans">{sub}</Text>
    </Pressable>
  );
}
