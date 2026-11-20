import { Text, View } from 'react-native';
import { IlustrasiKosong, type JenisIlustrasi } from '@/components/IlustrasiKosong';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { useTheme } from '@/theme/ThemeProvider';

// Wajib salah satu: ilustrasi (menggantikan lingkaran ikon) atau ikon.
type PropsKeadaanKosong = { pesan: string } & (
  | { ilustrasi: JenisIlustrasi; ikon?: NamaIkon }
  | { ilustrasi?: undefined; ikon: NamaIkon }
);

// Kartu keadaan kosong.
export function KeadaanKosong(props: PropsKeadaanKosong) {
  const { t } = useTheme();
  return (
    <View className="items-center gap-3 rounded-2xl border border-line bg-card2 px-6 py-8">
      {props.ilustrasi ? (
        <IlustrasiKosong jenis={props.ilustrasi} />
      ) : (
        <View className="h-16 w-16 items-center justify-center rounded-full border border-line bg-card">
          <Ikon nama={props.ikon} ukuran={32} warna={t.mid} />
        </View>
      )}
      <Text className="text-center font-sans text-fg2" style={{ fontSize: 13.5, lineHeight: 20 }}>
        {props.pesan}
      </Text>
    </View>
  );
}
