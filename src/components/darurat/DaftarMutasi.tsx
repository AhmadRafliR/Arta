import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import type { MutasiDarurat } from '@/domain/danaDarurat';
import { formatRupiah } from '@/domain/money';
import { labelBulan, NAMA_BULAN } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

function tanggalPanjang(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

/** Daftar mutasi dana darurat per bulan (mockup dana-darurat: .mut-card). Ketuk baris → buka transaksi. */
export function DaftarMutasi({ mutasi, onBuka }: { mutasi: MutasiDarurat[]; onBuka: (id: string) => void }) {
  const { t } = useTheme();
  const grup: { bulan: string; item: MutasiDarurat[] }[] = [];
  for (const m of mutasi) {
    const b = m.tanggal.slice(0, 7);
    const akhir = grup[grup.length - 1];
    if (akhir && akhir.bulan === b) akhir.item.push(m);
    else grup.push({ bulan: b, item: [m] });
  }
  return (
    <View testID="daftar-mutasi" className="overflow-hidden rounded-[20px] border border-line bg-card">
      {grup.map((g, gi) => (
        <View key={g.bulan}>
          <Text
            className={`bg-card2 px-3.5 py-2 font-sans text-[11px] font-semibold tracking-[0.08em] text-mid ${gi > 0 ? 'border-t border-line' : ''}`}
          >
            {labelBulan(g.bulan).toUpperCase()}
          </Text>
          {g.item.map((m) => {
            const masuk = m.arah === 'masuk';
            const judul = `${masuk ? 'Setoran' : 'Penarikan'}${m.lawan ? ` · ${m.lawan}` : ''}`;
            const nilai = `${masuk ? '+' : '−'}${formatRupiah(m.nominal)}`;
            const sub = [tanggalPanjang(m.tanggal), m.catatan].filter(Boolean).join(' · ');
            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={`${judul}, ${nilai}, ${sub}`}
                onPress={() => onBuka(m.id)}
                className="flex-row items-center gap-3 border-t border-line px-3.5 py-3"
              >
                <View
                  style={{ width: 36, height: 36 }}
                  className={`items-center justify-center rounded-xl ${masuk ? 'bg-accsoft' : 'bg-dangersoft'}`}
                >
                  <Ikon nama={masuk ? 'ui-arrow-down' : 'ui-arrow-up'} ukuran={18} warna={masuk ? t.accInk : t.dangerInk} />
                </View>
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="font-sans text-[13.5px] font-semibold text-fg" numberOfLines={1}>
                    {judul}
                  </Text>
                  <Text className="font-sans text-[11.5px] text-mid" numberOfLines={1}>
                    {sub}
                  </Text>
                </View>
                <Text
                  style={{ fontVariant: ['tabular-nums'], color: masuk ? t.accInk : t.dangerInk }}
                  className="font-sans text-[13.5px] font-bold"
                >
                  {nilai}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
