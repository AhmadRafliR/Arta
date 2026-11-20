import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { geserBulan } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

export const NAMA_BULAN_PANJANG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** 'YYYY-MM' -> 'November 2026'. */
export function labelBulanPanjang(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number);
  return `${NAMA_BULAN_PANJANG[m - 1]} ${y}`;
}

/** Keterangan relatif bulan terhadap bulan berjalan (mockup: .month-sub). */
export function keteranganBulan(bulan: string, bulanIni: string): string {
  if (bulan === bulanIni) return 'Bulan ini';
  if (bulan === geserBulan(bulanIni, -1)) return 'Bulan lalu';
  if (bulan > bulanIni) return 'Bulan berikutnya';
  return 'Arsip';
}

/** 'Hari ini · Kamis, 19 November' / 'Kemarin · Rabu, 18 November' / 'Senin, 16 November'. */
export function labelHariPanjang(tanggal: string, hariIni: string): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const dasar = `${NAMA_HARI[new Date(ms).getUTCDay()]}, ${d} ${NAMA_BULAN_PANJANG[m - 1]}`;
  const [hy, hm, hd] = hariIni.split('-').map(Number);
  const selisih = Date.UTC(hy, hm - 1, hd) - ms;
  if (selisih === 0) return `Hari ini · ${dasar}`;
  if (selisih === 86_400_000) return `Kemarin · ${dasar}`;
  return dasar;
}

type Props = {
  bulan: string;
  /** Bulan berjalan ('YYYY-MM'): panah kanan nonaktif bila sudah di sini. */
  bulanIni: string;
  onGeser: (d: number) => void;
};

function TombolPanah({ label, ikon, nonaktif, onPress }: { label: string; ikon: 'ui-chev-left' | 'ui-chev-right'; nonaktif?: boolean; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!nonaktif }}
      disabled={nonaktif}
      onPress={onPress}
      hitSlop={3}
      style={{ width: 38, height: 38, opacity: nonaktif ? 0.38 : 1 }}
      className="items-center justify-center rounded-full border border-line bg-card"
    >
      <Ikon nama={ikon} ukuran={18} warna={t.fg} />
    </Pressable>
  );
}

// Pemilih bulan (mockup arta: .month-bar): panah bulat 38 di kiri/kanan, label bulan + keterangan di tengah.
export function BarBulan({ bulan, bulanIni, onGeser }: Props) {
  const nonaktifMaju = bulan >= bulanIni;
  return (
    <View className="flex-row items-center gap-2 py-0.5">
      <TombolPanah label="Bulan sebelumnya" ikon="ui-chev-left" onPress={() => onGeser(-1)} />
      <View className="min-w-0 flex-1">
        <Text accessibilityRole="header" className="text-center font-sans text-[15.5px] font-semibold text-fg" numberOfLines={1}>
          {labelBulanPanjang(bulan)}
        </Text>
        <Text className="mt-px text-center font-sans text-[11px] font-medium tracking-[0.4px] text-mid">
          {keteranganBulan(bulan, bulanIni)}
        </Text>
      </View>
      <TombolPanah label="Bulan berikutnya" ikon="ui-chev-right" nonaktif={nonaktifMaju} onPress={() => !nonaktifMaju && onGeser(1)} />
    </View>
  );
}
