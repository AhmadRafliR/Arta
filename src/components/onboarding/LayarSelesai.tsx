import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ikon } from '@/components/ikon/Ikon';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { total: number; sub: string; onLanjut: () => void };

/** Layar selesai "Saldo awal tersimpan" (akun.html: .done): cincin centang, total, tombol catat transaksi pertama. */
export function LayarSelesai({ total, sub, onLanjut }: Props) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      className="flex-1 items-center justify-center bg-bg p-7"
    >
      <View className="w-full items-center gap-[14px]">
        <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-accsoft">
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: -7, left: -7, right: -7, bottom: -7, borderRadius: 51, borderWidth: 1, borderColor: t.acc, opacity: 0.45 }}
          />
          <Ikon nama="ui-check" ukuran={42} warna={t.accInk} />
        </View>
        <Text accessibilityRole="header" className="text-[21px] font-bold text-fg font-sans" style={{ letterSpacing: -0.63 }}>
          Saldo awal tersimpan
        </Text>
        <Text className="max-w-[270px] text-center text-[13px] leading-[20px] text-fg2 font-sans">{sub}</Text>
        <View
          style={{ borderColor: t.line, minWidth: 220 }}
          className="items-center gap-0.5 rounded-[20px] border bg-card px-[22px] py-[13px]"
        >
          <Text
            style={{ letterSpacing: 0.95, textTransform: 'uppercase' }}
            className="text-[10.5px] font-bold text-mid font-sans"
          >
            Total saldo awal
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.72 }}
            className="text-2xl font-bold text-fg font-sans"
          >
            {formatRupiah(total)}
          </Text>
        </View>
        <View className="mt-1.5 w-full max-w-[300px]">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Catat transaksi pertama"
            onPress={onLanjut}
            style={{ minHeight: 52, borderRadius: 16 }}
            className="flex-row items-center justify-center gap-[9px] border border-acc bg-acc px-[18px] py-[14px]"
          >
            <Text style={{ color: t.accFg }} className="text-[15px] font-bold font-sans">
              Catat transaksi pertama
            </Text>
            <Ikon nama="ui-arrow-right" ukuran={18} warna={t.accFg} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
