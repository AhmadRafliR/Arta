import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { diagramPengeluaran } from '@/domain/diagramPengeluaran';
import { formatRupiah } from '@/domain/money';
import type { Tx } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

// Warna kategorikal berurutan tetap menurut peringkat irisan; "Lainnya" selalu abu netral.
const WARNA = {
  terang: { urut: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'], lainnya: '#9a9a96' },
  gelap: { urut: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'], lainnya: '#6f6f6b' },
} as const;

const DIAMETER = 160;
const TEBAL = 20;
const CELAH = 2;
const R = (DIAMETER - TEBAL) / 2;
const C = DIAMETER / 2;

function titik(sudut: number) {
  return { x: C + R * Math.sin(sudut), y: C - R * Math.cos(sudut) };
}

function busur(awal: number, akhir: number): string {
  const a = titik(awal);
  const b = titik(akhir);
  const besar = akhir - awal > Math.PI ? 1 : 0;
  return `M ${a.x.toFixed(3)} ${a.y.toFixed(3)} A ${R} ${R} 0 ${besar} 1 ${b.x.toFixed(3)} ${b.y.toFixed(3)}`;
}

type Props = {
  data: Tx[] | undefined;
  bulan: string;
  galat?: string | null;
  onLihatRiwayat?: () => void;
};

export function DiagramPengeluaran({ data, bulan, galat, onLihatRiwayat }: Props) {
  const { mode } = useTheme();
  const kurangiGerak = useReducedMotion();
  const [terpilih, setTerpilih] = useState<string | null>(null);
  const ringkas = useMemo(() => (data ? diagramPengeluaran(data, bulan) : null), [data, bulan]);
  const palet = WARNA[mode === 'gelap' ? 'gelap' : 'terang'];

  const memudar = useSharedValue(1);
  useEffect(() => {
    if (kurangiGerak) {
      memudar.value = 1;
      return;
    }
    memudar.value = 0.4;
    memudar.value = withTiming(1, { duration: 180 });
  }, [terpilih, kurangiGerak, memudar]);
  const gayaTengah = useAnimatedStyle(() => ({ opacity: memudar.value }));

  let isi: ReactNode;
  if (galat) {
    isi = <Text className="text-fg font-sans">{galat}</Text>;
  } else if (!ringkas) {
    isi = <Text className="text-mid font-sans">Memuat…</Text>;
  } else if (ringkas.irisan.length === 0) {
    isi = <Text className="text-fg2 font-sans">Belum ada pengeluaran bulan ini.</Text>;
  } else {
    const { total, irisan } = ringkas;
    const warnaDari = (i: number) => (irisan[i].lainnya ? palet.lainnya : palet.urut[i]);
    const aktif = irisan.find((s) => s.kunci === terpilih) ?? null;
    const pilih = (kunci: string) => setTerpilih((k) => (k === kunci ? null : kunci));
    const terbesar = irisan.find((s) => !s.lainnya) ?? irisan[0];
    const ringkasan = `Pengeluaran bulan ini ${formatRupiah(total)}; terbesar ${terbesar.nama} ${terbesar.persen}%`;

    const jalur = irisan.map((s, i) => {
      const sebelum = irisan.slice(0, i).reduce((acc, x) => acc + x.nominal, 0);
      return { s, i, mulai: (sebelum / total) * Math.PI * 2, sapuan: (s.nominal / total) * Math.PI * 2 };
    });
    const celahSudut = CELAH / R;

    isi = (
      <View className="items-center gap-4">
        <View accessible accessibilityLabel={ringkasan} style={{ width: DIAMETER, height: DIAMETER }}>
          <Svg width={DIAMETER} height={DIAMETER} viewBox={`0 0 ${DIAMETER} ${DIAMETER}`}>
            <G>
              {jalur.length === 1 ? (
                <Circle
                  testID={`irisan-${jalur[0].s.kunci}`}
                  cx={C}
                  cy={C}
                  r={R}
                  fill="none"
                  stroke={warnaDari(0)}
                  strokeWidth={TEBAL}
                  onPress={() => pilih(jalur[0].s.kunci)}
                />
              ) : (
                jalur.map(({ s, i, mulai, sapuan }) => (
                  <Path
                    key={s.kunci}
                    testID={`irisan-${s.kunci}`}
                    d={busur(mulai + celahSudut / 2, mulai + sapuan - celahSudut / 2)}
                    fill="none"
                    stroke={warnaDari(i)}
                    strokeWidth={TEBAL}
                    strokeLinecap="butt"
                    opacity={aktif && aktif.kunci !== s.kunci ? 0.3 : 1}
                    onPress={() => pilih(s.kunci)}
                  />
                ))
              )}
            </G>
          </Svg>
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', left: TEBAL + 8, right: TEBAL + 8, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
              gayaTengah,
            ]}
          >
            <Text className="text-center text-[17px] font-bold text-fg font-sans" numberOfLines={1} adjustsFontSizeToFit>
              {formatRupiah(aktif ? aktif.nominal : total)}
            </Text>
            <Text className="text-center text-[11px] text-mid font-sans" numberOfLines={2}>
              {aktif ? aktif.nama : 'Pengeluaran bulan ini'}
            </Text>
          </Animated.View>
        </View>

        <View className="w-full">
          {irisan.map((s, i) => {
            const redup = aktif !== null && aktif.kunci !== s.kunci;
            return (
              <Pressable
                key={s.kunci}
                accessibilityRole="button"
                accessibilityLabel={`${s.nama}, ${formatRupiah(s.nominal)}, ${s.persen} persen`}
                accessibilityState={{ selected: aktif?.kunci === s.kunci }}
                onPress={() => pilih(s.kunci)}
                className="min-h-[44px] flex-row items-center gap-2.5"
                style={{ opacity: redup ? 0.5 : 1 }}
              >
                <View testID={`titik-${s.kunci}`} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: warnaDari(i) }} />
                <Text className="min-w-0 flex-1 text-[13px] text-fg font-sans" numberOfLines={1}>
                  {s.nama}
                </Text>
                <Text className="text-[13px] text-fg2 font-sans">{formatRupiah(s.nominal)}</Text>
                <Text style={{ minWidth: 44, fontVariant: ['tabular-nums'] }} className="text-right text-[13px] font-bold text-fg font-sans" numberOfLines={1} maxFontSizeMultiplier={1.3}>{`${s.persen}%`}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-xs font-bold text-fg font-sans">Ke mana uangmu</Text>
        {onLihatRiwayat ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Lihat riwayat" onPress={onLihatRiwayat} hitSlop={12}>
            <Text className="text-xs text-mid font-sans">Lihat riwayat ›</Text>
          </Pressable>
        ) : null}
      </View>
      <View className="rounded-2xl border border-line bg-card p-4">{isi}</View>
    </View>
  );
}
