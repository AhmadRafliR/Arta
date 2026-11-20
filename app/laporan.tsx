import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { Chip } from '@/components/Chip';
import { Ikon } from '@/components/ikon/Ikon';
import { KeadaanKosong } from '@/components/KeadaanKosong';
import { Tombol } from '@/components/Tombol';
import { useKuotaAi } from '@/data/ai';
import type { AppError } from '@/data/errors';
import {
  useHapusPenerima,
  useKirimLaporan,
  useKirimVerifikasi,
  usePenerima,
  useTambahPenerima,
  type Penerima,
} from '@/data/laporan';
import { geserBulan, hariIni, labelBulan, ZONA_BAWAAN } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

const MAKS_PENERIMA = 3;

const pesanGalat = (e: unknown): string =>
  e && typeof e === 'object' && typeof (e as AppError).pesan === 'string'
    ? (e as AppError).pesan
    : 'Terjadi kesalahan. Coba lagi.';

function BarisPenerima({ p, onKirimUlang, onHapus }: { p: Penerima; onKirimUlang: () => void; onHapus: () => void }) {
  const { t } = useTheme();
  return (
    <View className="gap-2 border-b border-line py-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-fg font-sans">{p.email}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Hapus ${p.email}`}
          onPress={onHapus}
          hitSlop={8}
          className="px-2 py-1"
        >
          <Text className="text-mid font-sans">Hapus</Text>
        </Pressable>
      </View>
      {p.terverifikasi ? (
        <View className="flex-row items-center gap-2">
          <Ikon nama="status-lunas" ukuran={16} warna={t.acc} />
          <Text className="text-sm text-fg2 font-sans">Terverifikasi</Text>
        </View>
      ) : (
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-sm text-mid font-sans">Menunggu konfirmasi</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Kirim ulang ${p.email}`}
            onPress={onKirimUlang}
            hitSlop={8}
            className="px-2 py-1"
          >
            <Text className="text-sm font-semibold text-fg font-sans">Kirim ulang</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function Laporan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const zona = profile?.zona_waktu ?? ZONA_BAWAAN;
  const bulanIni = hariIni(zona).slice(0, 7);
  const bulanLalu = geserBulan(bulanIni, -1);

  const kuota = useKuotaAi();
  const penerima = usePenerima();
  const tambah = useTambahPenerima();
  const hapus = useHapusPenerima();
  const verifikasi = useKirimVerifikasi();
  const kirim = useKirimLaporan();

  const [email, setEmail] = useState('');
  const [bulan, setBulan] = useState<'ini' | 'lalu'>('ini');
  const [info, setInfo] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [hasilKirim, setHasilKirim] = useState<string | null>(null);
  const [galatKirim, setGalatKirim] = useState<string | null>(null);

  const daftar = penerima.data ?? [];
  const terverifikasi = daftar.filter((p) => p.terverifikasi).length;
  const penuh = daftar.length >= MAKS_PENERIMA;
  const pro = kuota.data?.pro === true;

  async function onTambah() {
    setInfo(null);
    setGalat(null);
    try {
      const hasil = await tambah.mutateAsync(email);
      setEmail('');
      setInfo(
        hasil.verifikasiTerkirim
          ? `Email konfirmasi dikirim ke ${hasil.penerima.email}.`
          : (hasil.pesanVerifikasi ?? 'Email konfirmasi belum terkirim. Coba kirim ulang.'),
      );
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  }

  async function onKirimUlang(p: Penerima) {
    setInfo(null);
    setGalat(null);
    try {
      await verifikasi.mutateAsync(p.id);
      setInfo(`Email konfirmasi dikirim ke ${p.email}.`);
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  }

  function onHapus(p: Penerima) {
    Alert.alert(`Hapus ${p.email} dari penerima laporan?`, undefined, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          setInfo(null);
          setGalat(null);
          hapus.mutate(p.id, { onError: (e) => setGalat(pesanGalat(e)) });
        },
      },
    ]);
  }

  async function onKirim() {
    const target = bulan === 'ini' ? bulanIni : bulanLalu;
    setHasilKirim(null);
    setGalatKirim(null);
    try {
      const h = await kirim.mutateAsync({ bulan: target });
      setHasilKirim(`Laporan ${labelBulan(target)} terkirim ke ${h.terkirim} penerima.`);
    } catch (e) {
      setGalatKirim(pesanGalat(e));
    }
  }

  function isi() {
    if (kuota.isPending) return <ActivityIndicator />;
    if (!pro) {
      return (
        <View className="gap-3">
          <KeadaanKosong
            ilustrasi="laporan"
            pesan="Kirim ringkasan keuangan bulanan ke orang tua, pasangan, atau teman sebagai pengingat. Fitur ini khusus Pro."
          />
          <Text className="text-center text-mid font-sans">Pro segera hadir.</Text>
        </View>
      );
    }
    return (
      <>
        <Text className="text-fg2 font-sans">
          Ringkasan bulan lalu dikirim otomatis ke penerima yang sudah terverifikasi setiap tanggal 1 pukul 08.00.
        </Text>

        <View>
          <Text className="mb-1 text-xs font-semibold uppercase text-mid font-sans">Penerima</Text>
          {penerima.isPending ? <ActivityIndicator /> : null}
          {penerima.isError ? <Text className="text-fg2 font-sans">{penerima.error.pesan}</Text> : null}
          {daftar.map((p) => (
            <BarisPenerima key={p.id} p={p} onKirimUlang={() => void onKirimUlang(p)} onHapus={() => onHapus(p)} />
          ))}
          {penuh ? <Text className="mt-2 text-mid font-sans">Maksimal 3 penerima.</Text> : null}
        </View>

        {!penuh ? (
          <View className="gap-3">
            <TextInput
              accessibilityLabel="Email penerima"
              placeholder="email@contoh.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              className="rounded-2xl border border-line bg-card px-4 py-3 text-fg font-sans"
            />
            <Tombol
              label="Tambah penerima"
              onPress={() => void onTambah()}
              busy={tambah.isPending}
              disabled={!email.trim()}
            />
          </View>
        ) : null}

        {info ? <Text className="text-fg2 font-sans">{info}</Text> : null}
        {galat ? <Text className="text-fg font-sans">{galat}</Text> : null}

        <View className="gap-3">
          <Text className="text-xs font-semibold uppercase text-mid font-sans">Kirim sekarang</Text>
          <View className="flex-row gap-2">
            <Chip label="Bulan ini" selected={bulan === 'ini'} onPress={() => setBulan('ini')} />
            <Chip label="Bulan lalu" selected={bulan === 'lalu'} onPress={() => setBulan('lalu')} />
          </View>
          <Tombol
            primary
            label="Kirim laporan"
            onPress={() => void onKirim()}
            busy={kirim.isPending}
            disabled={terverifikasi === 0}
          />
          {terverifikasi === 0 ? <Text className="text-mid font-sans">Belum ada penerima terverifikasi.</Text> : null}
          {hasilKirim ? <Text className="text-fg2 font-sans">{hasilKirim}</Text> : null}
          {galatKirim ? <Text className="text-fg font-sans">{galatKirim}</Text> : null}
        </View>
      </>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-4 px-5"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-fg font-sans">Laporan email</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Kembali" onPress={() => router.back()} hitSlop={8}>
          <Text className="text-fg2 font-sans">Kembali</Text>
        </Pressable>
      </View>
      {isi()}
    </ScrollView>
  );
}
