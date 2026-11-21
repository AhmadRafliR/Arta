import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ikon } from '@/components/ikon/Ikon';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { total: number; harian: number; darurat: number; catatan: string };

/** Kartu hero "Total saldo awal" (akun.html: .hero): angka live + ringkasan harian / dana darurat. */
export function HeroSaldoAwal({ total, harian, darurat, catatan }: Props) {
  const { t, mode } = useTheme();
  const bgTag = mode === 'gelap' ? 'rgba(11,66,79,0.08)' : 'rgba(255,255,255,0.14)';
  return (
    <LinearGradient
      colors={[t.heroFrom, t.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16, overflow: 'hidden' }}
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', right: -64, top: -70, width: 196, height: 196, borderRadius: 98, borderWidth: 1, borderColor: t.amLine, opacity: 0.5 }}
      />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', right: -12, top: -20, width: 102, height: 102, borderRadius: 51, borderWidth: 1, borderColor: t.amLine, opacity: 0.3 }}
      />
      <View className="flex-row items-center gap-2.5">
        <Text
          accessibilityRole="header"
          style={{ color: t.amSub, letterSpacing: 1.43, textTransform: 'uppercase' }}
          className="shrink text-[11px] font-semibold font-sans"
        >
          Total saldo awal
        </Text>
        <View
          style={{ borderColor: t.amLine, backgroundColor: bgTag }}
          className="ml-auto rounded-full border px-[9px] py-[3px]"
        >
          <Text style={{ color: t.heroFg, letterSpacing: 0.3 }} className="text-[10.5px] font-bold font-sans">
            Titik mulai hari ini
          </Text>
        </View>
      </View>
      <Text
        accessibilityLiveRegion="polite"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={{ color: t.heroFg, marginTop: 6, fontSize: 36, lineHeight: 40, letterSpacing: -1.08, fontVariant: ['tabular-nums'] }}
        className="font-bold font-sans"
      >
        {formatRupiah(total)}
      </Text>
      <Text style={{ color: t.amSub, marginTop: 5 }} className="text-xs leading-[17px] font-sans">
        {catatan}
      </Text>
      <View
        style={{ borderTopWidth: 1, borderTopColor: t.amLine, marginTop: 14, paddingTop: 12 }}
        className="flex-row gap-4"
      >
        <Sel ikon="ui-pocket" label="Harian" nilai={formatRupiah(harian)} />
        <Sel ikon="ui-shield-ok" label="Dana darurat" nilai={formatRupiah(darurat)} />
      </View>
    </LinearGradient>
  );
}

function Sel({ ikon, label, nilai }: { ikon: 'ui-pocket' | 'ui-shield-ok'; label: string; nilai: string }) {
  const { t } = useTheme();
  return (
    <View className="min-w-0 flex-1 gap-px">
      <View className="flex-row items-center gap-[5px]">
        <Ikon nama={ikon} ukuran={12} warna={t.amSub} />
        <Text style={{ color: t.amSub, letterSpacing: 0.2 }} className="text-[10.5px] font-semibold font-sans">
          {label}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{ color: t.heroFg, fontVariant: ['tabular-nums'], letterSpacing: -0.15 }}
        className="text-[14.5px] font-bold leading-[18px] font-sans"
      >
        {nilai}
      </Text>
    </View>
  );
}
