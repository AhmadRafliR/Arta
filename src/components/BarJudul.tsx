import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  judul: string;
  /** Bila ada, tampil tombol bulat "Kembali" di kiri (layar di luar tab). */
  onKembali?: () => void;
  /** Slot kanan (tombol aksi bulat, hitungan, dll.). */
  kanan?: React.ReactNode;
};

// Bar judul layar (mockup arta: .topbar): tombol kembali bulat 40, judul 20 semibold.
export function BarJudul({ judul, onKembali, kanan }: Props) {
  const { t } = useTheme();
  return (
    <View className="flex-row items-center gap-2.5 pb-2.5 pt-0.5">
      {onKembali ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={onKembali}
          hitSlop={4}
          style={{ width: 40, height: 40 }}
          className="items-center justify-center rounded-full border border-line bg-card"
        >
          <Ikon nama="ui-back" ukuran={20} warna={t.fg} />
        </Pressable>
      ) : null}
      <Text accessibilityRole="header" className="flex-1 font-sans text-xl font-semibold text-fg" numberOfLines={1}>
        {judul}
      </Text>
      {kanan}
    </View>
  );
}
