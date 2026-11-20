import { KeadaanKosong } from '@/components/KeadaanKosong';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RiwayatFilter } from '@/components/RiwayatFilter';
import { TxRow } from '@/components/TxRow';
import { useAuth } from '@/auth/AuthProvider';
import { useTransactions } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { formatRupiah } from '@/domain/money';
import { filterTx, kelompokHarian, type FilterTx } from '@/lib/filterTx';
import { geserBulan, hariIni, labelBulan, NAMA_BULAN } from '@/lib/tanggal';
import { useGulirPulau } from '@/nav/useGulirPulau';
import { TINGGI_NAV } from '@/nav/pulau';

function labelHari(tanggal: string): string {
  const [, m, d] = tanggal.split('-').map(Number);
  return `${d} ${NAMA_BULAN[m - 1]}`;
}

export default function Riwayat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gulir = useGulirPulau('riwayat');
  const { profile } = useAuth();
  const [bulan, setBulan] = useState(() => hariIni(profile?.zona_waktu || undefined).slice(0, 7));
  const [filter, setFilter] = useState<FilterTx>({});

  // Ganti bulan: reset filter kategori (daftar kategori bergantung bulan, chip terpilih bisa hilang).
  const gantiBulan = (d: number) => {
    setBulan((b) => geserBulan(b, d));
    setFilter((f) => ({ ...f, kategori: undefined }));
  };

  const wallets = useWallets();
  const q = useTransactions(bulan);
  const dompet = wallets.data ?? [];
  const namaDompet = (id: string | null) => dompet.find((w) => w.id === id)?.nama ?? null;

  const semua = q.data;
  const kategori = useMemo(
    () => [...new Set((semua ?? []).map((t) => t.kategori).filter((k): k is string => !!k))].sort(),
    [semua],
  );
  const grup = useMemo(() => kelompokHarian(filterTx(semua ?? [], filter)), [semua, filter]);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-3 px-4"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: TINGGI_NAV + insets.bottom + 16 }}
      {...gulir}
    >
      <View className="flex-row items-center justify-between">
        <Pressable accessibilityRole="button" accessibilityLabel="Bulan sebelumnya" onPress={() => gantiBulan(-1)} className="px-3 py-1">
          <Text className="text-lg text-fg font-sans">‹</Text>
        </Pressable>
        <Text className="text-base font-bold text-fg font-sans">{labelBulan(bulan)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Bulan berikutnya" onPress={() => gantiBulan(1)} className="px-3 py-1">
          <Text className="text-lg text-fg font-sans">›</Text>
        </Pressable>
      </View>

      <RiwayatFilter filter={filter} onChange={setFilter} kategori={kategori} dompet={dompet.map((w) => ({ id: w.id, nama: w.nama }))} />

      {semua === undefined ? (
        <Text className={`font-sans ${q.error ? 'text-fg' : 'text-mid'}`}>{q.error ? q.error.pesan : 'Memuat…'}</Text>
      ) : grup.length === 0 ? (
        <KeadaanKosong ikon="cat-lainnya" pesan="Belum ada transaksi di bulan ini." />
      ) : (
        grup.map((g) => (
          <View key={g.tanggal}>
            <View className="flex-row items-center justify-between pt-1">
              <Text className="text-xs font-bold text-mid font-sans">{labelHari(g.tanggal)}</Text>
              <Text className="text-xs text-mid font-sans">{formatRupiah(g.total)}</Text>
            </View>
            <View className="mt-1 rounded-2xl border border-line bg-card px-3 py-1">
              {g.items.map((tx) => (
                <Pressable key={tx.id} accessibilityRole="button" onPress={() => router.push(`/transaksi/${tx.id}?bulan=${bulan}`)}>
                  <TxRow tx={tx} namaDompet={namaDompet} />
                </Pressable>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
