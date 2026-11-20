import { Text, View } from 'react-native';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

export type ItemAlokasi = { id: string; nama: string; nilai: number };

/** Rupiah ringkas untuk legenda: "Rp5,3 jt", "Rp214 rb". */
export function rupiahRingkas(n: number): string {
  const v = Math.round(n);
  if (v >= 1_000_000) {
    const jt = v / 1_000_000;
    return `Rp${jt % 1 === 0 ? jt : jt.toFixed(1).replace('.', ',')} jt`;
  }
  if (v >= 1000) return `Rp${Math.round(v / 1000)} rb`;
  return formatRupiah(v);
}

/**
 * Kelompokkan untuk bar: hanya nilai positif, urut terbesar; lebih dari 4 → 3 teratas + "Lainnya"
 * (palet seri hanya c1–c4).
 */
export function kelompokAlokasi(item: ItemAlokasi[]): ItemAlokasi[] {
  const urut = item.filter((x) => x.nilai > 0).sort((a, b) => b.nilai - a.nilai);
  if (urut.length <= 4) return urut;
  const sisa = urut.slice(3).reduce((s, x) => s + x.nilai, 0);
  return [...urut.slice(0, 3), { id: 'lainnya', nama: 'Lainnya', nilai: sisa }];
}

// Kartu alokasi aset (mockup arta investasi: .card + .alloc-bar + .alloc-legend).
export function BarAlokasi({ item }: { item: ItemAlokasi[] }) {
  const { t } = useTheme();
  const grup = kelompokAlokasi(item);
  const total = grup.reduce((s, x) => s + x.nilai, 0);
  if (total <= 0) return null;
  const palet = [t.c1, t.c2, t.c3, t.c4];
  const persen = (n: number) => Math.round((n / total) * 100);
  const label = grup.map((g) => `${g.nama} ${persen(g.nilai)} persen`).join(', ');

  return (
    <View testID="alokasi-aset" className="rounded-[20px] border border-line bg-card px-[15px] pb-[13px] pt-3.5">
      <View className="flex-row items-baseline gap-2">
        <Text accessibilityRole="header" className="font-sans text-[13px] font-semibold uppercase tracking-[0.5px] text-mid">
          Alokasi aset
        </Text>
        <Text className="ml-auto font-sans text-[11px] text-mid">Dari nilai sekarang</Text>
      </View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={{ gap: 3, height: 10 }}
        className="mt-3 flex-row overflow-hidden rounded-full bg-card2"
      >
        {grup.map((g, i) => (
          <View
            key={g.id}
            style={{ flexGrow: g.nilai, flexBasis: 0, backgroundColor: palet[i % palet.length] }}
            className="h-full rounded-full"
          />
        ))}
      </View>
      <View style={{ rowGap: 9 }} className="mt-[13px] flex-row flex-wrap">
        {grup.map((g, i) => (
          <View key={g.id} style={{ width: '50%' }} className="flex-row items-center gap-[7px] pr-3">
            <View style={{ width: 8, height: 8, borderRadius: 2.5, backgroundColor: palet[i % palet.length] }} />
            <View className="min-w-0 flex-1 gap-px">
              <View className="flex-row items-baseline gap-[5px]">
                <Text className="flex-shrink font-sans text-[11.5px] font-semibold text-fg2" numberOfLines={1}>
                  {g.nama}
                </Text>
                <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[11.5px] font-semibold text-mid">
                  {`${persen(g.nilai)}%`}
                </Text>
              </View>
              <Text
                style={{ fontVariant: ['tabular-nums'] }}
                className="font-sans text-[11.5px] font-semibold text-fg"
                numberOfLines={1}
              >
                {rupiahRingkas(g.nilai)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
