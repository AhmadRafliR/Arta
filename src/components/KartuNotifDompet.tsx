import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { useNotifikasiDompet } from '@/notifikasi-dompet/useNotifikasiDompet';
import { useTheme } from '@/theme/ThemeProvider';

// Kartu Beranda: transaksi dari notifikasi GoPay/ShopeePay yang menunggu dicek. Tanpa antrean -> tidak tampil.
export function KartuNotifDompet() {
  const { t } = useTheme();
  const { jumlah, bukaUntukCek } = useNotifikasiDompet();
  if (jumlah <= 0) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${jumlah} transaksi dari notifikasi siap dicek`}
      onPress={bukaUntukCek}
      className="flex-row items-center gap-3 rounded-2xl border border-line bg-card p-3"
    >
      <View style={{ width: 36, height: 36 }} className="items-center justify-center rounded-xl bg-accsoft">
        <Ikon nama="ui-bell" ukuran={19} warna={t.accInk} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-sans text-[14px] font-semibold text-fg" numberOfLines={1}>
          {`${jumlah} transaksi dari notifikasi siap dicek`}
        </Text>
        <Text className="font-sans text-[11.5px] text-mid" numberOfLines={1}>
          GoPay dan ShopeePay, tekan untuk memeriksa
        </Text>
      </View>
      <Ikon nama="ui-chev" ukuran={16} warna={t.mid} />
    </Pressable>
  );
}
