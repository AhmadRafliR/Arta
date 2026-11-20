import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KartuGrupAkun } from '@/components/BarisAkun';
import { Tombol } from '@/components/Tombol';
import { sinkronAntrean, useNotifikasiTerakhir } from '@/notifikasi-dompet/useNotifikasiDompet';
import { useTheme } from '@/theme/ThemeProvider';
import { aktif, bukaPengaturanIzin, izinAktif, setAktif, tersedia } from '../modules/notifikasi-dompet';

function bacaIzin(): boolean {
  try {
    return izinAktif();
  } catch {
    return false;
  }
}

function bacaAktif(): boolean {
  try {
    return aktif();
  } catch {
    return false;
  }
}

function modulAda(): boolean {
  try {
    return Platform.OS === 'android' && tersedia();
  } catch {
    return false;
  }
}

function jam(waktu: number): string {
  const d = new Date(waktu);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

// Modal "Catat otomatis dari notifikasi": penjelasan, status izin, sakelar, dan contoh notifikasi yang terbaca.
export default function NotifikasiDompet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const terakhir = useNotifikasiTerakhir();
  const android = Platform.OS === 'android';
  const ada = modulAda();
  const [izin, setIzin] = useState(() => (ada ? bacaIzin() : false));
  const [nyala, setNyala] = useState(() => (ada ? bacaAktif() : false));

  const segarkan = useCallback(() => {
    if (!ada) return;
    setIzin(bacaIzin());
    setNyala(bacaAktif());
  }, [ada]);

  // Pengguna kembali dari pengaturan sistem: status izin disegarkan.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') segarkan();
    });
    return () => sub.remove();
  }, [segarkan]);

  function ubahNyala(v: boolean) {
    setAktif(v);
    setNyala(v);
    sinkronAntrean();
  }

  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pb-1 pt-4">
        <Text accessibilityRole="header" className="flex-1 font-sans text-lg font-bold text-fg">
          Catat otomatis dari notifikasi
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={tutup} className="px-2 py-1">
          <Text className="font-sans text-mid">Tutup</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-5 py-3" contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <View className="gap-2 rounded-[20px] border border-line bg-card px-4 py-3.5">
          <Text className="font-sans text-[13px] leading-5 text-fg2">
            arta membaca notifikasi GoPay dan ShopeePay di HP ini, lalu menyiapkannya sebagai draf transaksi. Kamu tetap
            mengecek dan menyimpannya sendiri di layar Cek dulu.
          </Text>
          <Text className="font-sans text-[13px] leading-5 text-fg2">
            Privasi: hanya notifikasi GoPay dan ShopeePay yang dibaca, notifikasi aplikasi lain diabaikan. Teks notifikasi
            diproses di HP dan tidak dikirim ke server; yang tersimpan hanyalah transaksi yang kamu konfirmasi.
          </Text>
        </View>

        {!ada ? (
          <View className="rounded-[20px] border border-line bg-card px-4 py-3.5">
            <Text className="font-sans text-[14px] font-semibold text-fg">
              {android ? 'Modul belum terpasang di build ini' : 'Fitur ini hanya tersedia di Android'}
            </Text>
            {android ? (
              <Text className="mt-1 font-sans text-[12.5px] text-fg2">Pasang build pengembangan terbaru untuk memakai fitur ini.</Text>
            ) : null}
          </View>
        ) : (
          <>
            <View className="gap-2 rounded-[20px] border border-line bg-card px-4 py-3.5">
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 font-sans text-[14.5px] font-semibold text-fg">Akses notifikasi</Text>
                <Text className={`font-sans text-[13px] font-bold ${izin ? 'text-accink' : 'text-mid'}`}>{izin ? 'Aktif' : 'Belum aktif'}</Text>
              </View>
              <Tombol label="Buka pengaturan akses notifikasi" onPress={bukaPengaturanIzin} />
            </View>

            <View className="flex-row items-center gap-3 rounded-[20px] border border-line bg-card px-4 py-3.5">
              <View className="min-w-0 flex-1">
                <Text className="font-sans text-[14.5px] font-semibold text-fg">Catat otomatis</Text>
                <Text className="font-sans text-[11.5px] text-mid">Matikan untuk berhenti membaca notifikasi.</Text>
              </View>
              <Switch
                accessibilityLabel="Catat otomatis dari notifikasi"
                value={nyala}
                onValueChange={ubahNyala}
                trackColor={{ false: t.line, true: t.acc }}
              />
            </View>

            <View className="rounded-[20px] border border-line bg-card px-4 py-3.5">
              <Text className="font-sans text-[13px] leading-5 text-fg2">
                HP Xiaomi/HyperOS: matikan penghemat baterai untuk arta dan izinkan autostart, supaya notifikasi tetap terbaca
                saat app ditutup.
              </Text>
            </View>

            <Text accessibilityRole="header" className="px-px pt-1 font-sans text-[13px] font-semibold uppercase tracking-[0.5px] text-mid">
              Notifikasi terakhir yang terbaca
            </Text>
            <KartuGrupAkun>
              {terakhir.length === 0 ? (
                <Text className="px-3.5 py-3 font-sans text-[12.5px] text-mid">Belum ada notifikasi yang terbaca.</Text>
              ) : (
                terakhir.map((n, i) => (
                  <View key={n.kunci} className={`gap-0.5 px-3.5 py-2.5 ${i === 0 ? '' : 'border-t border-line'}`}>
                    <View className="flex-row items-center gap-2">
                      <Text className="min-w-0 flex-1 font-sans text-[11.5px] text-mid" numberOfLines={1}>
                        {`${n.paket} · ${jam(n.waktu)}`}
                      </Text>
                      <Text className={`font-sans text-[11.5px] font-bold ${n.terbaca ? 'text-accink' : 'text-mid'}`}>
                        {n.terbaca ? 'Terbaca sebagai transaksi' : 'Bukan transaksi'}
                      </Text>
                    </View>
                    {n.judul ? <Text className="font-sans text-[13.5px] font-semibold text-fg">{n.judul}</Text> : null}
                    {n.teks ? <Text className="font-sans text-[12.5px] text-fg2">{n.teks}</Text> : null}
                  </View>
                ))
              )}
            </KartuGrupAkun>
            <Text className="font-sans text-[11.5px] leading-4 text-mid">
              Daftar ini hanya ada di HP dan hilang saat app ditutup. Berguna untuk melaporkan format notifikasi yang belum terbaca.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
