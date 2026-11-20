import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IlustrasiKosong } from '@/components/IlustrasiKosong';
import { KartuHutang } from '@/components/KartuHutang';
import { JudulSubHutang } from '@/components/hutang/BagianHutang';
import { BarisPengingatPro, KartuRingkasanHutang } from '@/components/hutang/KartuRingkasanHutang';
import { useAuth } from '@/auth/AuthProvider';
import { useDebts, useRiwayatPokok } from '@/data/debts';
import { usePro } from '@/data/langganan';
import { ringkasHutang } from '@/domain/hutang';
import { hariIni } from '@/lib/tanggal';
import { useGulirPulau } from '@/nav/useGulirPulau';
import { spacerNav } from '@/nav/pulau';

export default function Hutang() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gulir = useGulirPulau('hutang');
  const { profile } = useAuth();
  const { pro } = usePro();
  const hariIniStr = hariIni(profile?.zona_waktu || undefined);
  const semua = useDebts();
  const riwayat = useRiwayatPokok();
  const [lihatArsip, setLihatArsip] = useState(false);

  const daftar = semua.data ?? [];
  const aktif = daftar.filter((h) => !h.diarsip);
  const arsip = daftar.filter((h) => h.diarsip);
  const jumlahAktif = aktif.filter((h) => h.sisa_pokok > 0).length;
  const ringkas = ringkasHutang(daftar, hariIniStr, riwayat.data ?? {});
  const buka = (id: string) => router.push({ pathname: '/hutang/[id]', params: { id } });
  const bayar = (id: string) => router.push({ pathname: '/hutang/bayar', params: { id } });
  const tambah = () => router.push('/hutang/baru');

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-3 px-[18px]"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: spacerNav(insets.bottom) }}
      {...gulir}
    >
      {/* Bar judul (mockup: .topbar): judul + pil jumlah hutang aktif. */}
      <View className="flex-row items-center gap-2.5 pb-1">
        <Text accessibilityRole="header" className="font-sans text-xl font-semibold text-fg">
          Hutang
        </Text>
        {semua.data ? (
          <View className="ml-0.5 rounded-full border border-line bg-card px-[9px] py-[3px]">
            <Text className="font-sans text-[11.5px] font-bold text-fg2">{`${jumlahAktif} aktif`}</Text>
          </View>
        ) : null}
      </View>

      {semua.data === undefined ? (
        <Text className="text-fg font-sans">{semua.error ? semua.error.pesan : 'Memuat…'}</Text>
      ) : (
        <>
          <KartuRingkasanHutang ringkas={ringkas} hariIni={hariIniStr} />

          <JudulSubHutang
            judul="Daftar hutang"
            kanan={
              <Pressable accessibilityRole="button" accessibilityLabel="Tambah" onPress={tambah} hitSlop={9} className="px-0.5 py-1">
                <Text className="font-sans text-[12.5px] font-bold text-accink underline">Tambah</Text>
              </Pressable>
            }
          />

          {aktif.length === 0 && arsip.length === 0 ? (
            // Keadaan kosong (mockup: .empty): ilustrasi, judul, pesan, tombol garis.
            <View className="items-center gap-2.5 px-[18px] pb-2 pt-[26px]">
              <IlustrasiKosong jenis="hutang" lebar={148} />
              <Text className="font-sans text-[16.5px] font-semibold text-fg">Aman, belum ada hutang</Text>
              <Text className="max-w-[300px] text-center font-sans text-[13px] leading-5 text-fg2">
                Kalau nanti ada paylater, cicilan, atau pinjam ke teman, catat di sini supaya jatuh temponya terpantau.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tambah hutang"
                onPress={tambah}
                style={{ minHeight: 40 }}
                className="mt-1 justify-center rounded-full border border-accink px-4 py-2"
              >
                <Text className="font-sans text-[13px] font-bold text-accink">Tambah hutang</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-2.5">
              {aktif.map((h) => (
                <KartuHutang key={h.id} hutang={h} hariIni={hariIniStr} onPress={() => buka(h.id)} onBayar={() => bayar(h.id)} />
              ))}

              {arsip.length > 0 ? (
                <>
                  <Pressable accessibilityRole="button" onPress={() => setLihatArsip((v) => !v)} className="py-2">
                    <Text className="font-sans text-xs font-semibold text-mid">
                      {lihatArsip ? 'Sembunyikan yang diarsip' : `Tampilkan yang diarsip (${arsip.length})`}
                    </Text>
                  </Pressable>
                  {lihatArsip
                    ? arsip.map((h) => <KartuHutang key={h.id} hutang={h} hariIni={hariIniStr} onPress={() => buka(h.id)} />)
                    : null}
                </>
              ) : null}
            </View>
          )}

          <BarisPengingatPro
            pro={pro}
            onPress={() => (pro ? router.navigate('/akun') : router.push('/premium?dari=pengingat'))}
          />
        </>
      )}
    </ScrollView>
  );
}
