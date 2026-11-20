import { Text, View } from 'react-native';
import { formatRingkas } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

export type DompetChip = { id: string; nama: string; saldo: number };

export function WalletChips({ dompet }: { dompet: DompetChip[] }) {
  const { mode, t } = useTheme();
  const bg = mode === 'terang' ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.06)';
  return (
    <View className="mt-3 flex-row gap-1.5">
      {dompet.map((d) => (
        <View key={d.id} style={{ backgroundColor: bg }} className="flex-1 rounded-xl px-2 py-1.5">
          <Text style={{ color: t.heroFg }} className="text-[10px] font-sans" numberOfLines={1}>
            {d.nama}
          </Text>
          <Text style={{ color: t.heroFg }} className="text-xs font-bold font-sans">
            {formatRingkas(d.saldo)}
          </Text>
        </View>
      ))}
    </View>
  );
}
