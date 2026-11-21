import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { Ikon } from '@/components/ikon/Ikon';
import { SheetBawah } from '@/components/SheetBawah';
import { Tombol } from '@/components/Tombol';
import { useTransisiOpsional } from '@/animasi/TransisiProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { aktif, bukaPengaturanIzin, izinAktif, setAktif, tersedia } from '../../modules/notifikasi-dompet';
import { sinkronAntrean } from './useNotifikasiDompet';

/** Penanda bahwa layar "Catat otomatis" sudah pernah dibuka otomatis setelah app dipasang. */
export const KUNCI_DIKENALKAN = 'arta:notif-dompet-dikenalkan';

function aman<T>(f: () => T, cadangan: T): T {
  try {
    return f();
  } catch {
    return cadangan;
  }
}

const modulAda = () => Platform.OS === 'android' && aman(tersedia, false);

/** Nyalakan sakelar catat otomatis (sekali) begitu izin baru saja diberikan. */
export function nyalakanBilaIzinBaru() {
  if (aman(izinAktif, false) && !aman(aktif, false)) {
    aman(() => setAktif(true), undefined);
    sinkronAntrean();
  }
}

/**
 * Catat otomatis dari notifikasi adalah fitur utama: setelah masuk ke app,
 * - pertama kali sejak dipasang: langsung membuka layar "Catat otomatis dari notifikasi";
 * - selanjutnya, selama izin akses notifikasi belum diberikan: popup ajakan setiap app dibuka/kembali aktif.
 * Hanya Android dengan modul native; menunggu transisi animasi selesai dan tidak tampil di layar itu sendiri.
 */
export function GerbangIzinNotif() {
  const router = useRouter();
  const segmen = useSegments();
  const { t } = useTheme();
  const { session, profile } = useAuth();
  const transisi = useTransisiOpsional();
  const sedangPutar = transisi?.sedangPutar ?? false;
  const [popup, setPopup] = useState(false);
  // Ditutup ("Nanti") atau layar sudah dibuka: jangan muncul lagi sampai app kembali dari latar belakang.
  const diamSesiIni = useRef(false);
  const menungguIzin = useRef(false);
  const ada = modulAda();
  const diDalamApp = !!session && profile?.onboarding_selesai === true && segmen[0] === '(tabs)';

  const cek = useCallback(async () => {
    if (!ada || !diDalamApp || sedangPutar) return;
    if (aman(izinAktif, false)) {
      setPopup(false);
      return;
    }
    let dikenalkan: string | null = null;
    try {
      dikenalkan = await AsyncStorage.getItem(KUNCI_DIKENALKAN);
    } catch {
      dikenalkan = '1';
    }
    if (!dikenalkan) {
      try {
        await AsyncStorage.setItem(KUNCI_DIKENALKAN, '1');
      } catch {
        // diabaikan: paling buruk layar dibuka sekali lagi
      }
      diamSesiIni.current = true;
      router.push('/notifikasi-dompet');
      return;
    }
    if (!diamSesiIni.current) setPopup(true);
  }, [ada, diDalamApp, sedangPutar, router]);

  // Dijalankan setelah effect selesai (bukan sinkron di dalamnya) karena cek mengubah state.
  useEffect(() => {
    let batal = false;
    void Promise.resolve().then(() => {
      if (!batal) void cek();
    });
    return () => {
      batal = true;
    };
  }, [cek]);

  useEffect(() => {
    if (!ada) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (menungguIzin.current) {
        menungguIzin.current = false;
        nyalakanBilaIzinBaru();
      }
      diamSesiIni.current = false;
      void cek();
    });
    return () => sub.remove();
  }, [ada, cek]);

  const nanti = () => {
    diamSesiIni.current = true;
    setPopup(false);
  };

  if (!popup || !diDalamApp) return null;
  return (
    <SheetBawah terbuka onTutup={nanti} testID="popup-izin-notif">
      <View className="items-center gap-2 pt-1">
        <View style={{ width: 52, height: 52 }} className="items-center justify-center rounded-[18px] bg-accsoft">
          <Ikon nama="ui-bell" ukuran={26} warna={t.accInk} />
        </View>
        <Text accessibilityRole="header" className="text-center font-sans text-[18px] font-bold text-fg">
          Aktifkan catat otomatis
        </Text>
        <Text className="text-center font-sans text-[13.5px] leading-[20px] text-fg2">
          Izinkan arta membaca notifikasi GoPay dan ShopeePay supaya transaksimu tercatat sendiri. Kamu tetap
          mengecek sebelum disimpan.
        </Text>
      </View>
      <View className="gap-2 rounded-[16px] border border-line bg-card2 p-3">
        {[
          'Hanya notifikasi GoPay dan ShopeePay yang dibaca.',
          'Teks notifikasi diproses di HP, tidak dikirim ke server.',
          'Bisa dimatikan kapan saja dari Beranda.',
        ].map((x) => (
          <View key={x} className="flex-row items-start gap-2">
            <Ikon nama="ui-check" ukuran={16} warna={t.accInk} />
            <Text className="flex-1 font-sans text-[12.5px] leading-[18px] text-fg2">{x}</Text>
          </View>
        ))}
      </View>
      <Tombol
        primary
        label="Aktifkan sekarang"
        onPress={() => {
          menungguIzin.current = true;
          diamSesiIni.current = true;
          setPopup(false);
          bukaPengaturanIzin();
        }}
      />
      <Tombol
        label="Lihat cara kerjanya"
        onPress={() => {
          diamSesiIni.current = true;
          setPopup(false);
          router.push('/notifikasi-dompet');
        }}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Nanti" onPress={nanti} style={{ minHeight: 40 }} className="items-center justify-center">
        <Text className="font-sans text-[13px] font-semibold text-mid">Nanti</Text>
      </Pressable>
    </SheetBawah>
  );
}
