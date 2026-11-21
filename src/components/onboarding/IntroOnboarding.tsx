import { Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { useTheme } from '@/theme/ThemeProvider';

/** Intro: kicker sapaan (nama dari isian/profil/Google), judul, subjudul sesuai langkah. */
export function IntroOnboarding({ langkah, nama }: { langkah: 1 | 2; nama: string }) {
  const { t } = useTheme();
  return (
    <View className="gap-[7px]">
      <View className="flex-row items-center gap-1.5 self-start rounded-full bg-accsoft py-1 pl-[7px] pr-2.5">
        <Ikon nama="ui-spark" ukuran={13} warna={t.accInk} />
        <Text
          className="text-[10.5px] font-bold text-accink font-sans"
          style={{ letterSpacing: 0.74, textTransform: 'uppercase' }}
        >
          {nama ? `Selamat datang, ${nama}` : 'Selamat datang'}
        </Text>
      </View>
      <Text accessibilityRole="header" className="text-[25px] font-bold leading-[29px] text-fg font-sans" style={{ letterSpacing: -0.875 }}>
        {langkah === 1 ? 'Isi saldo awal dompetmu' : 'Berapa isinya sekarang?'}
      </Text>
      <Text className="max-w-[270px] text-[13.5px] leading-[21px] text-fg2 font-sans">
        {langkah === 1
          ? 'Masukkan uang yang ada sekarang. Cukup sekali di awal, biar angka di Beranda langsung benar — nanti setiap transaksi menyesuaikan sendiri.'
          : 'Isi saldo tiap dompet yang kamu pilih. Boleh dikosongkan kalau memang belum ada isinya.'}
      </Text>
    </View>
  );
}
