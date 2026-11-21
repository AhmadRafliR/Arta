import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ikon } from '@/components/ikon/Ikon';
import { useNotifikasiDompet } from '@/notifikasi-dompet/useNotifikasiDompet';
import { useTheme } from '@/theme/ThemeProvider';
import { TargetTur } from '@/tur/TargetTur';
import { tersedia } from '../../modules/notifikasi-dompet';

const TOMBOL = { width: 36, height: 36 } as const;

function amanTersedia(): boolean {
  try {
    return tersedia();
  } catch {
    return false;
  }
}

// Dua tombol ikon di pojok kanan atas Beranda: ganti mode gelap/terang dan jalan pintas catat otomatis dari notifikasi.
export function AksiKepalaBeranda() {
  const { mode, t, setPref } = useTheme();
  const router = useRouter();
  const { jumlah } = useNotifikasiDompet();
  const gelap = mode === 'gelap';
  const adaNotif = amanTersedia();

  return (
    <View className="flex-row items-center gap-2">
      <TargetTur id="beranda-tema">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={gelap ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
        onPress={() => setPref(gelap ? 'terang' : 'gelap')}
        style={TOMBOL}
        className="items-center justify-center rounded-full border border-line bg-card"
      >
        <Ikon nama={gelap ? 'ui-sun' : 'ui-moon'} ukuran={18} warna={t.fg} />
      </Pressable>
      </TargetTur>
      {adaNotif ? (
        <TargetTur id="beranda-notif">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Catat otomatis dari notifikasi"
          onPress={() => router.push('/notifikasi-dompet')}
          style={TOMBOL}
          className="items-center justify-center rounded-full border border-line bg-card"
        >
          <Ikon nama="ui-bell" ukuran={18} warna={t.fg} />
          {jumlah > 0 ? (
            <View
              testID="titik-notif"
              style={{ position: 'absolute', top: 7, right: 8, width: 8, height: 8 }}
              className="rounded-full border border-card bg-acc"
            />
          ) : null}
        </Pressable>
        </TargetTur>
      ) : null}
    </View>
  );
}
