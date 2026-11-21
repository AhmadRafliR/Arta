import { Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';
import { PetakIkon } from './BarisPilihDompet';

/** Strip total (.total): garis putus-putus, ikon sigma, total dan jumlah dompet. */
export function StripTotal({ total, jumlah }: { total: number; jumlah: number }) {
  const { t } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ borderColor: t.line, borderStyle: 'dashed' }}
      className="flex-row items-center gap-3 rounded-[20px] border bg-card2 px-4 py-[14px]"
    >
      <PetakIkon ikon="ui-sigma" aktif />
      <View className="min-w-0 shrink gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Ikon nama="ui-rp" ukuran={14} warna={t.fg2} />
          <Text className="text-[11.5px] font-semibold text-fg2 font-sans">Total dompet harian</Text>
        </View>
        <Text
          numberOfLines={1}
          style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}
          className="text-xl font-bold leading-[23px] text-fg font-sans"
        >
          {formatRupiah(total)}
        </Text>
      </View>
      <View style={{ borderColor: t.line }} className="ml-auto rounded-full border bg-card px-2.5 py-1">
        <Text className="text-[11px] font-bold text-fg2 font-sans">{`${jumlah} dompet`}</Text>
      </View>
    </View>
  );
}
