import { Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';
import { WalletChips, type DompetChip } from './WalletChips';

type Props = { sisa: number; kekayaan: number; dompet: DompetChip[] };

export function HeroCard({ sisa, kekayaan, dompet }: Props) {
  const { t } = useTheme();
  return (
    <LinearGradient
      colors={[t.heroFrom, t.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 20, padding: 16 }}
    >
      <Text style={{ color: t.heroFg, opacity: 0.65 }} className="text-[10px] tracking-widest">
        SISA UANG · SEMUA DOMPET
      </Text>
      <Text style={{ color: t.heroFg }} className="my-1 text-[28px] font-extrabold">
        {formatRupiah(sisa)}
      </Text>
      <Text style={{ color: t.heroFg, opacity: 0.65 }} className="text-[11px]">
        {`Kekayaan bersih ${formatRupiah(kekayaan)}`}
      </Text>
      {dompet.length > 0 ? <WalletChips dompet={dompet} /> : null}
    </LinearGradient>
  );
}
