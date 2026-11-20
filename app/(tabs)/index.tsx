import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroCard } from '@/components/HeroCard';
import { TxRow } from '@/components/TxRow';
import { useAuth } from '@/auth/AuthProvider';
import { useAllTransactions, useTransactions } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { kekayaanBersih, sisaUang, walletBalances } from '@/domain/balances';
import { formatRupiah } from '@/domain/money';
import { monthSummary } from '@/domain/summary';
import { sapaan } from '@/lib/greeting';
import { hariIni, jamDi } from '@/lib/tanggal';

export default function Beranda() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const zona = profile?.zona_waktu || undefined;
  const bulan = hariIni(zona).slice(0, 7);

  const wallets = useWallets();
  const semuaTx = useAllTransactions();
  const bulanIni = useTransactions(bulan);

  const termuat = wallets.data !== undefined && semuaTx.data !== undefined;
  const galat = wallets.error ?? semuaTx.error;
  const dompet = wallets.data ?? [];
  const saldo = termuat ? walletBalances(dompet, semuaTx.data ?? []) : {};
  const chips = dompet
    .filter((w) => w.tipe === 'harian' && !w.diarsip)
    .map((w) => ({ id: w.id, nama: w.nama, saldo: saldo[w.id] ?? 0 }));
  const bulanBelumAda = bulanIni.data === undefined;
  const bulanGalat = bulanBelumAda ? bulanIni.error : null;
  const bulanMemuat = bulanBelumAda && !bulanGalat;
  const txBulan = bulanIni.data ?? [];
  const ringkasan = monthSummary(txBulan, bulan);
  const terbaru = txBulan.slice(0, 5);
  const namaDompet = (id: string | null) => dompet.find((w) => w.id === id)?.nama ?? null;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-3 px-4 pb-6"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
    >
      <View>
        <Text className="text-xs text-mid">{`${sapaan(jamDi(zona))},`}</Text>
        <Text className="text-base font-bold text-fg">{profile?.nama ?? ''}</Text>
      </View>

      {termuat ? (
        <HeroCard sisa={sisaUang(dompet, saldo)} kekayaan={kekayaanBersih(saldo, 0)} dompet={chips} />
      ) : galat ? (
        <Text className="text-fg">{galat.pesan}</Text>
      ) : (
        <Text className="text-mid">Memuat…</Text>
      )}

      <Text className="mt-1 text-xs font-bold text-fg">Bulan ini</Text>
      {bulanGalat ? (
        <Text className="text-fg">{bulanGalat.pesan}</Text>
      ) : (
        <View className="flex-row gap-6 rounded-2xl border border-line bg-card p-3">
          <View>
            <Text className="text-[11px] text-mid">Masuk</Text>
            <Text className="text-base font-bold text-accink">{bulanMemuat ? '…' : formatRupiah(ringkasan.masuk)}</Text>
          </View>
          <View>
            <Text className="text-[11px] text-mid">Keluar</Text>
            <Text className="text-base font-bold text-fg">{bulanMemuat ? '…' : formatRupiah(ringkasan.keluar)}</Text>
          </View>
        </View>
      )}

      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-xs font-bold text-fg">Terbaru</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Semua transaksi" onPress={() => router.navigate('/riwayat')}>
          <Text className="text-xs text-mid">Semua ›</Text>
        </Pressable>
      </View>
      <View className="rounded-2xl border border-line bg-card px-3">
        {bulanMemuat ? (
          <Text className="py-3 text-mid">Memuat…</Text>
        ) : bulanGalat ? (
          <Text className="py-3 text-fg">{bulanGalat.pesan}</Text>
        ) : terbaru.length === 0 ? (
          <Text className="py-3 text-mid">Belum ada transaksi bulan ini.</Text>
        ) : (
          terbaru.map((tx) => <TxRow key={tx.id} tx={tx} namaDompet={namaDompet} />)
        )}
      </View>
    </ScrollView>
  );
}
