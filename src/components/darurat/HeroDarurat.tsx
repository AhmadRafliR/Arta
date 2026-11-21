import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  saldo: number;
  target: number | null;
  persen: number | null;
  /** Saldo dibagi rata-rata pengeluaran bulanan; null bila belum ada data pengeluaran. */
  bulanAman: number | null;
};

const R = 42;
const KELILING = 2 * Math.PI * R;
const SETORAN_BULAN = 12;

/** Kartu hero dana darurat (mockup dana-darurat: .hero): jumlah terkumpul, cincin progres, tiga angka ringkas. */
export function HeroDarurat({ saldo, target, persen, bulanAman }: Props) {
  const { t, mode } = useTheme();
  const p = Math.min(100, Math.max(0, persen ?? 0));
  const sisa = target !== null ? Math.max(0, target - saldo) : null;
  const gelap = mode === 'gelap'; // kartu hero putih di mode gelap: cincin pakai teal tua
  const warnaCincin = gelap ? '#17726F' : t.acc;
  const warnaTrack = gelap ? 'rgba(11,66,79,0.14)' : 'rgba(255,255,255,0.18)';
  const sub =
    target === null ? 'Tentukan target dulu' : sisa === 0 ? 'Target tercapai, kerja bagus' : `Dari target ${formatRupiah(target)}`;
  const item = (k: string, v: string) => (
    <View key={k} className="min-w-0 flex-1 gap-0.5">
      <Text style={{ color: t.heroSub }} className="font-sans text-[10.5px] font-semibold" numberOfLines={1}>
        {k}
      </Text>
      <Text
        style={{ color: t.heroFg, fontVariant: ['tabular-nums'] }}
        className="font-sans text-[13px] font-bold"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {v}
      </Text>
    </View>
  );
  return (
    <LinearGradient
      testID="hero-darurat"
      colors={[t.heroFrom, t.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, padding: 16, gap: 14 }}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text style={{ color: t.heroSub }} className="font-sans text-[11px] font-semibold tracking-[0.12em]">
          DANA DARURAT TERKUMPUL
        </Text>
        <Text style={{ color: t.heroSub }} className="font-sans text-[11.5px] font-semibold" numberOfLines={1}>
          {target !== null ? `Target ${formatRupiah(target)}` : 'Belum ada target'}
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text
            style={{ color: t.heroFg, fontVariant: ['tabular-nums'] }}
            className="font-sans text-[30px] font-extrabold"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {formatRupiah(saldo)}
          </Text>
          <Text style={{ color: t.heroSub }} className="font-sans text-xs">
            {sub}
          </Text>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Progres dana darurat ${Math.floor(p)} persen`}
          style={{ width: 86, height: 86 }}
          className="items-center justify-center"
        >
          <Svg width={86} height={86} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
            <Circle cx={50} cy={50} r={R} stroke={warnaTrack} strokeWidth={9} fill="none" />
            <Circle
              cx={50}
              cy={50}
              r={R}
              stroke={warnaCincin}
              strokeWidth={9}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${KELILING}`}
              strokeDashoffset={KELILING * (1 - p / 100)}
              transform="rotate(-90 50 50)"
            />
          </Svg>
          <Text style={{ color: t.heroFg, fontVariant: ['tabular-nums'] }} className="font-sans text-[17px] font-extrabold">
            {`${Math.floor(p)}%`}
          </Text>
          <Text style={{ color: t.heroSub }} className="font-sans text-[9.5px]">
            tercapai
          </Text>
        </View>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: warnaTrack }} className="flex-row gap-3 pt-3">
        {item('Sisa ke target', sisa === null ? '—' : sisa === 0 ? 'Tercapai' : formatRupiah(sisa))}
        {item('Bulan aman', bulanAman === null ? '—' : `${String(bulanAman).replace('.', ',')} bln`)}
        {item('Setoran / bulan', sisa === null ? '—' : formatRupiah(Math.round(sisa / SETORAN_BULAN)))}
      </View>
    </LinearGradient>
  );
}
