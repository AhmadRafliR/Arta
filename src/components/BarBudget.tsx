import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import type { PemakaianBudget } from '@/domain/budget';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { p: PemakaianBudget; onPress?: () => void };

export const kapital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function teksStatusBudget(p: PemakaianBudget): string {
  if (p.status === 'lewat') return `Lewat budget ${formatRupiah(p.terpakai - p.batas)}`;
  if (p.status === 'waspada') return `Hampir habis, ${p.persen}% terpakai`;
  return `Aman, ${p.persen}% terpakai`;
}

// Baris progres budget. Status selalu berupa ikon + teks, warna hanya pelengkap.
export function BarBudget({ p, onPress }: Props) {
  const { t } = useTheme();
  const warnaBar = p.status === 'lewat' ? t.danger : p.status === 'waspada' ? t.warn : t.acc;
  const teksStatus = teksStatusBudget(p);
  const nilai = `${formatRupiah(p.terpakai)} / ${formatRupiah(p.batas)}`;
  const kelasStatus =
    p.status === 'lewat' ? 'font-semibold' : p.status === 'waspada' ? 'font-semibold' : 'text-fg2';
  const warnaTeks = p.status === 'lewat' ? t.dangerInk : p.status === 'waspada' ? t.warnInk : undefined;
  const isi = (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-shrink text-sm font-bold text-fg font-sans">{kapital(p.kategori)}</Text>
        <Text className="text-xs text-fg2 font-sans">{nilai}</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-line">
        <View
          testID="bar-isi"
          style={{ width: `${Math.min(p.persen, 100)}%`, backgroundColor: warnaBar, height: '100%' }}
        />
      </View>
      <View className="flex-row items-center gap-1.5">
        <Ikon nama={`status-budget-${p.status}`} ukuran={16} warna={warnaTeks ?? t.mid} />
        <Text className={`text-xs font-sans ${kelasStatus}`} style={warnaTeks ? { color: warnaTeks } : undefined}>
          {teksStatus}
        </Text>
      </View>
    </View>
  );
  const label = `${kapital(p.kategori)}, ${nilai}, ${teksStatus}`;
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label}>
        {isi}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {isi}
    </Pressable>
  );
}
