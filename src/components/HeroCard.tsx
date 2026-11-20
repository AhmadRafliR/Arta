import { Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { sisa: number; kekayaan: number };

export function HeroCard({ sisa, kekayaan }: Props) {
  const { t } = useTheme();
  return (
    <LinearGradient
      colors={[t.heroFrom, t.heroTo]}
      start={{ x: 0.25, y: 0 }}
      end={{ x: 0.75, y: 1 }}
      style={{ borderRadius: 22, paddingVertical: 20, paddingHorizontal: 22 }}
    >
      <Text style={{ color: t.heroSub }} className="text-[12px] tracking-[0.14em] font-sans">
        SISA UANG · SEMUA DOMPET
      </Text>
      <Text
        style={{ color: t.heroFg, fontVariant: ['tabular-nums'] }}
        className="my-1 text-[34px] font-semibold font-sans"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatRupiah(sisa)}
      </Text>
      <Text style={{ color: t.heroSub }} className="text-[13px] font-sans">
        {`Kekayaan bersih ${formatRupiah(kekayaan)}`}
      </Text>
    </LinearGradient>
  );
}
