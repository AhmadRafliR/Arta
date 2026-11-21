import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { labelKategoriBudget, type PemakaianBudget } from '@/domain/budget';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { p: PemakaianBudget; onPress?: () => void };

export const kapital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function teksStatusBudget(p: PemakaianBudget): string {
  if (p.status === 'lewat') return `Lewat budget ${formatRupiah(p.terpakai - p.batas)}`;
  if (p.status === 'waspada') return `Hampir habis, ${p.persen}% terpakai`;
  return `Aman, ${p.persen}% terpakai`;
}

// Baris progres budget (mockup akun: baris budget di sheet): nama + persen, bar tipis, lalu status
// (ikon + teks, warna hanya pelengkap) dan nilai terpakai/batas.
export function BarBudget({ p, onPress }: Props) {
  const { t } = useTheme();
  const warnaBar = p.status === 'lewat' ? t.danger : p.status === 'waspada' ? t.warn : t.acc;
  const teksStatus = teksStatusBudget(p);
  const namaTampil = kapital(labelKategoriBudget(p.kategori));
  const nilai = `${formatRupiah(p.terpakai)} / ${formatRupiah(p.batas)}`;
  const kelasStatus =
    p.status === 'lewat' ? 'font-semibold' : p.status === 'waspada' ? 'font-semibold' : 'text-fg2';
  const warnaTeks = p.status === 'lewat' ? t.dangerInk : p.status === 'waspada' ? t.warnInk : undefined;
  const isi = (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-shrink font-sans text-[13.5px] font-semibold text-fg" numberOfLines={1}>
          {namaTampil}
        </Text>
        <Text
          style={{ fontVariant: ['tabular-nums'], ...(warnaTeks ? { color: warnaTeks } : null) }}
          className={`font-sans text-[12.5px] font-semibold ${warnaTeks ? '' : 'text-fg'}`}
        >
          {`${p.persen}%`}
        </Text>
      </View>
      <View className="h-[5px] overflow-hidden rounded-full bg-card2">
        <View
          testID="bar-isi"
          style={{ width: `${Math.min(p.persen, 100)}%`, backgroundColor: warnaBar, height: '100%', borderRadius: 999 }}
        />
      </View>
      <View className="flex-row items-center gap-1.5">
        <Ikon nama={`status-budget-${p.status}`} ukuran={14} warna={warnaTeks ?? t.mid} />
        <Text
          className={`min-w-0 flex-1 font-sans text-[11.5px] ${kelasStatus}`}
          style={warnaTeks ? { color: warnaTeks } : undefined}
          numberOfLines={1}
        >
          {teksStatus}
        </Text>
        <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[11px] text-mid">
          {nilai}
        </Text>
      </View>
    </View>
  );
  const label = `${namaTampil}, ${nilai}, ${teksStatus}`;
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
