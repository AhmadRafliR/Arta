import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KartuHutang } from '@/components/KartuHutang';
import { KeadaanKosong } from '@/components/KeadaanKosong';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { useDebts, useRiwayatPokok } from '@/data/debts';
import { labelBulan, ringkasHutang } from '@/domain/hutang';
import { formatRupiah } from '@/domain/money';
import { hariIni } from '@/lib/tanggal';
import { useGulirPulau } from '@/nav/useGulirPulau';
import { spacerNav } from '@/nav/pulau';

export default function Hutang() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gulir = useGulirPulau('hutang');
  const { profile } = useAuth();
  const hariIniStr = hariIni(profile?.zona_waktu || undefined);
  const semua = useDebts();
  const riwayat = useRiwayatPokok();
  const [lihatArsip, setLihatArsip] = useState(false);

  const daftar = semua.data ?? [];
  const aktif = daftar.filter((h) => !h.diarsip);
  const arsip = daftar.filter((h) => h.diarsip);
  const ringkas = ringkasHutang(daftar, hariIniStr, riwayat.data ?? {});
  const persen = Math.round(ringkas.progres * 100);
  const buka = (id: string) => router.push({ pathname: '/hutang/[id]', params: { id } });

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-3 px-4"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: spacerNav(insets.bottom) }}
      {...gulir}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold text-fg font-sans">Hutang</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tambah"
          onPress={() => router.push('/hutang/baru')}
          className="rounded-xl border border-line px-4 py-2"
        >
          <Text className="text-sm font-semibold text-fg font-sans">Tambah</Text>
        </Pressable>
      </View>

      {semua.data === undefined ? (
        <Text className="text-fg font-sans">{semua.error ? semua.error.pesan : 'Memuat…'}</Text>
      ) : aktif.length === 0 && arsip.length === 0 ? (
        <>
          <KeadaanKosong ilustrasi="hutang" pesan="Belum ada hutang tercatat. Tambahkan paylater atau cicilan kalau ada." />
          <Tombol label="Tambah hutang" primary onPress={() => router.push('/hutang/baru')} />
        </>
      ) : (
        <>
          <View className="gap-2 rounded-2xl border border-line bg-card p-4">
            <Text className="text-xs text-fg2 font-sans">Total sisa hutang</Text>
            <Text className="text-2xl font-bold text-fg font-sans">{formatRupiah(ringkas.totalSisa)}</Text>
            <View className="h-2 overflow-hidden rounded-full bg-card2">
              <View className="h-2 rounded-full bg-acc" style={{ width: `${persen}%` }} />
            </View>
            <Text className="text-xs text-fg2 font-sans">{`${persen}% lunas`}</Text>
            {ringkas.bebasPada ? (
              <Text className="text-xs text-fg2 font-sans">{`Perkiraan bebas hutang: ${labelBulan(ringkas.bebasPada)}`}</Text>
            ) : ringkas.totalSisa > 0 ? (
              <Text className="text-xs text-fg2 font-sans">Perkiraan bebas hutang belum bisa dihitung</Text>
            ) : null}
          </View>

          {aktif.map((h) => (
            <KartuHutang key={h.id} hutang={h} hariIni={hariIniStr} onPress={() => buka(h.id)} />
          ))}

          {arsip.length > 0 ? (
            <>
              <Pressable accessibilityRole="button" onPress={() => setLihatArsip((v) => !v)} className="py-2">
                <Text className="text-xs text-mid font-sans">
                  {lihatArsip ? 'Sembunyikan yang diarsip' : `Tampilkan yang diarsip (${arsip.length})`}
                </Text>
              </Pressable>
              {lihatArsip
                ? arsip.map((h) => <KartuHutang key={h.id} hutang={h} hariIni={hariIniStr} onPress={() => buka(h.id)} />)
                : null}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
