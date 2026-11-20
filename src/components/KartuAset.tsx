import { Pressable, Text, View } from 'react-native';
import { formatRupiah } from '@/domain/money';
import type { RingkasAset } from '@/domain/investasi';
import { useTheme } from '@/theme/ThemeProvider';

/** `+Rp30.000 (+11,5%)`; persen dilewati bila null. Rugi memakai tanda minus dari formatRupiah. */
export function untungTeks(untung: number, persen: number | null): string {
  const uang = untung > 0 ? `+${formatRupiah(untung)}` : formatRupiah(untung);
  if (persen === null) return uang;
  const p = `${persen > 0 ? '+' : ''}${String(persen).replace('.', ',')}%`;
  return `${uang} (${p})`;
}

export function TombolKecil({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`rounded-full border border-line bg-card px-4 py-2 ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className="text-[13px] font-semibold text-fg font-sans">{label}</Text>
    </Pressable>
  );
}

type Props = { a: RingkasAset; onBeli: () => void; onJual: () => void; onNilai: () => void };

export function KartuAset({ a, onBeli, onJual, onNilai }: Props) {
  const { t } = useTheme();
  return (
    <View className="gap-2 rounded-2xl border border-line bg-card p-4">
      <Text className="text-mid font-sans">{a.nama}</Text>
      <Text className="text-2xl font-bold text-fg font-sans">{formatRupiah(a.nilai)}</Text>
      <Text className="text-[13px] text-mid font-sans">{`Modal ${formatRupiah(a.modal)}`}</Text>
      <Text
        style={{ color: a.untung < 0 ? t.dangerInk : a.untung > 0 ? t.accInk : t.mid }}
        className="text-[14px] font-semibold font-sans"
      >
        {untungTeks(a.untung, a.persen)}
      </Text>
      <View className="mt-1 flex-row flex-wrap gap-2">
        <TombolKecil label="Beli" onPress={onBeli} />
        <TombolKecil label="Jual" onPress={onJual} />
        <TombolKecil label="Update nilai" onPress={onNilai} />
      </View>
    </View>
  );
}
