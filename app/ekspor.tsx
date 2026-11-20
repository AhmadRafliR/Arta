import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip } from '@/components/Chip';
import { KeadaanKosong } from '@/components/KeadaanKosong';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { toAppError } from '@/data/errors';
import { usePro } from '@/data/langganan';
import { jalankanEkspor, type FormatEkspor, type RentangEkspor } from '@/ekspor/ekspor';
import { useTheme } from '@/theme/ThemeProvider';

const FORMAT: { v: FormatEkspor; label: string }[] = [
  { v: 'xlsx', label: 'Excel (.xlsx), semua data' },
  { v: 'csv', label: 'CSV, transaksi' },
];

const RENTANG: { v: RentangEkspor; label: string }[] = [
  { v: 'semua', label: 'Semua' },
  { v: 'tahun', label: 'Tahun ini' },
  { v: 'bulan', label: 'Bulan ini' },
];

function pesanGalat(e: unknown): string {
  const o = e && typeof e === 'object' ? (e as { kind?: unknown; pesan?: unknown }) : {};
  return typeof o.kind === 'string' && typeof o.pesan === 'string' ? o.pesan : toAppError(e, { aksi: 'baca' }).pesan;
}

// Modal ekspor data (fitur Pro). XLSX = semua data, satu sheet per sumber; CSV = transaksi saja.
export default function Ekspor() {
  const router = useRouter();
  const { t } = useTheme();
  const { profile } = useAuth();
  const { pro, memuat } = usePro();
  const [format, setFormat] = useState<FormatEkspor>('xlsx');
  const [rentang, setRentang] = useState<RentangEkspor>('semua');
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));

  async function ekspor() {
    if (busy) return;
    setBusy(true);
    setPesan(null);
    try {
      await jalankanEkspor(format, rentang, profile?.zona_waktu ?? undefined);
    } catch (e) {
      setPesan(pesanGalat(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 px-5 py-6">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-fg font-sans">Ekspor data</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Tutup</Text>
        </Pressable>
      </View>

      {memuat ? (
        <ActivityIndicator color={t.mid} accessibilityLabel="Memuat" />
      ) : !pro ? (
        <>
          <KeadaanKosong
            ikon="act-ekspor"
            pesan="Ekspor ke Excel dan CSV tersedia untuk pengguna Pro. Datamu tetap aman dan bisa dibuka di Excel atau Google Sheets."
          />
          <Tombol label="Lihat Pro" primary onPress={() => router.push('/premium?dari=ekspor')} />
        </>
      ) : (
        <>
          <Text className="text-mid font-sans">Format</Text>
          <View className="flex-row flex-wrap gap-2">
            {FORMAT.map((x) => (
              <Chip key={x.v} label={x.label} selected={format === x.v} onPress={() => setFormat(x.v)} />
            ))}
          </View>
          <Text className="text-mid font-sans">Rentang transaksi</Text>
          <View className="flex-row flex-wrap gap-2">
            {RENTANG.map((x) => (
              <Chip key={x.v} label={x.label} selected={rentang === x.v} onPress={() => setRentang(x.v)} />
            ))}
          </View>
          <Text className="text-fg2 font-sans" style={{ fontSize: 13 }}>
            {format === 'xlsx'
              ? 'Berisi transaksi, dompet, dan kategori. Rentang hanya menyaring transaksi.'
              : 'Berisi transaksi saja, dipisah koma.'}
          </Text>
          <Tombol label="Ekspor" primary busy={busy} disabled={busy} onPress={() => void ekspor()} />
          {pesan ? <Text className="text-fg font-sans">{pesan}</Text> : null}
        </>
      )}
    </ScrollView>
  );
}
