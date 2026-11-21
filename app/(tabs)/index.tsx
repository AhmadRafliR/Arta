import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroCard } from '@/components/HeroCard';
import { WalletChips } from '@/components/WalletChips';
import { TxRow } from '@/components/TxRow';
import { KartuHutangBeranda } from '@/components/KartuHutangBeranda';
import { KeadaanKosong } from '@/components/KeadaanKosong';
import { KartuBudgetKritis } from '@/components/KartuBudgetKritis';
import { AksiKepalaBeranda } from '@/components/AksiKepalaBeranda';
import { KartuNotifDompet } from '@/components/KartuNotifDompet';
import { useAuth } from '@/auth/AuthProvider';
import { useAllTransactions, useTransactions } from '@/data/transactions';
import { useDebts, useRiwayatPokok } from '@/data/debts';
import { useWallets } from '@/data/wallets';
import { kekayaanBersih, sisaUang, walletBalances } from '@/domain/balances';
import { ringkasHutang } from '@/domain/hutang';
import { formatRupiah } from '@/domain/money';
import { monthSummary } from '@/domain/summary';
import { sapaan } from '@/lib/greeting';
import { hariIni, jamDi } from '@/lib/tanggal';
import { useGulirPulau } from '@/nav/useGulirPulau';
import { spacerNav } from '@/nav/pulau';

export default function Beranda() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gulir = useGulirPulau('index');
  const { profile } = useAuth();
  const zona = profile?.zona_waktu || undefined;
  const hariIniStr = hariIni(zona);
  const bulan = hariIniStr.slice(0, 7);

  const wallets = useWallets();
  const semuaTx = useAllTransactions();
  const bulanIni = useTransactions(bulan);
  // Hutang tidak boleh memblokir Beranda: selama memuat atau galat, hutang dianggap 0.
  const hutang = useDebts({ arsip: false });
  const riwayatPokok = useRiwayatPokok();
  const ringkasHutangKini = ringkasHutang(hutang.data ?? [], hariIniStr, riwayatPokok.data ?? {});
  const adaHutang = (hutang.data ?? []).some((h) => h.sisa_pokok > 0);

  const termuat = wallets.data !== undefined && semuaTx.data !== undefined;
  const galat = wallets.error ?? semuaTx.error;
  const dompet = wallets.data ?? [];
  const saldo = termuat ? walletBalances(dompet, semuaTx.data ?? []) : {};
  const chips = dompet
    .filter((w) => w.tipe === 'harian' && !w.diarsip)
    .map((w) => ({ id: w.id, nama: w.nama, saldo: saldo[w.id] ?? 0, tipe: w.tipe }));
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
      contentContainerClassName="gap-3 px-4"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: spacerNav(insets.bottom) }}
      {...gulir}
    >
      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-xs text-mid font-sans">{`${sapaan(jamDi(zona))},`}</Text>
          <Text className="text-base font-bold text-fg font-sans" numberOfLines={1}>{profile?.nama ?? ''}</Text>
        </View>
        <AksiKepalaBeranda />
      </View>

      {termuat ? (
        <>
          <HeroCard sisa={sisaUang(dompet, saldo)} kekayaan={kekayaanBersih(saldo, ringkasHutangKini.totalSisa)} />
          <WalletChips dompet={chips} />
        </>
      ) : galat ? (
        <Text className="text-fg font-sans">{galat.pesan}</Text>
      ) : (
        <Text className="text-mid font-sans">Memuat…</Text>
      )}

      <KartuNotifDompet />

      <Text className="mt-1 text-xs font-bold text-fg font-sans">Bulan ini</Text>
      {bulanGalat ? (
        <Text className="text-fg font-sans">{bulanGalat.pesan}</Text>
      ) : (
        <View className="flex-row gap-6 rounded-2xl border border-line bg-card p-3">
          <View>
            <Text className="text-[11px] text-fg2 font-sans">Masuk</Text>
            <Text className="text-base font-bold text-accink font-sans">{bulanMemuat ? '…' : formatRupiah(ringkasan.masuk)}</Text>
          </View>
          <View>
            <Text className="text-[11px] text-fg2 font-sans">Keluar</Text>
            <Text className="text-base font-bold text-fg font-sans">{bulanMemuat ? '…' : formatRupiah(ringkasan.keluar)}</Text>
          </View>
        </View>
      )}
      <KartuBudgetKritis />

      {adaHutang ? (
        <KartuHutangBeranda ringkas={ringkasHutangKini} hariIni={hariIniStr} onPress={() => router.navigate('/hutang')} />
      ) : null}

      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-xs font-bold text-fg font-sans">Terbaru</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Semua transaksi" onPress={() => router.navigate('/riwayat')}>
          <Text className="text-xs text-mid font-sans">Semua ›</Text>
        </Pressable>
      </View>
      {!bulanMemuat && !bulanGalat && terbaru.length === 0 ? (
        <KeadaanKosong ilustrasi="transaksi" pesan="Belum ada transaksi bulan ini. Tekan tombol mic untuk mencatat yang pertama." />
      ) : (
        <View className="rounded-2xl border border-line bg-card px-3 py-1">
          {bulanMemuat ? (
            <Text className="py-3 text-mid font-sans">Memuat…</Text>
          ) : bulanGalat ? (
            <Text className="py-3 text-fg font-sans">{bulanGalat.pesan}</Text>
          ) : (
            terbaru.map((tx) => <TxRow key={tx.id} tx={tx} namaDompet={namaDompet} hariIni={hariIniStr} />)
          )}
        </View>
      )}
    </ScrollView>
  );
}
