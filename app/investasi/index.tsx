import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KartuAset, untungTeks } from '@/components/KartuAset';
import { KeadaanKosong } from '@/components/KeadaanKosong';
import { Tombol } from '@/components/Tombol';
import { walletBalances } from '@/domain/balances';
import { ringkasInvestasi } from '@/domain/investasi';
import { formatRupiah } from '@/domain/money';
import { useAllTransactions } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { useTheme } from '@/theme/ThemeProvider';

export default function Investasi() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const wallets = useWallets();
  const txs = useAllTransactions();
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));
  const ringkas =
    wallets.data && txs.data ? ringkasInvestasi(wallets.data, walletBalances(wallets.data, txs.data), txs.data) : null;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-4 px-5 pb-8"
      contentContainerStyle={{ paddingTop: insets.top + 16 }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-fg font-sans">Investasi</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Kembali" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Kembali</Text>
        </Pressable>
      </View>
      {ringkas === null ? (
        <Text className="text-mid font-sans">Memuat…</Text>
      ) : ringkas.aset.length === 0 ? (
        <>
          <KeadaanKosong
            ikon="wallet-investasi"
            pesan="Belum ada investasi. Tambahkan aset seperti reksa dana, saham, atau emas."
          />
          <Tombol label="Tambah aset" primary onPress={() => router.push('/dompet/baru?tipe=investasi')} />
        </>
      ) : (
        <>
          <View className="gap-1 rounded-2xl border border-line bg-card2 p-4">
            <Text className="text-mid font-sans">Total nilai investasi</Text>
            <Text className="text-2xl font-bold text-fg font-sans">{formatRupiah(ringkas.totalNilai)}</Text>
            <Text
              style={{ color: ringkas.totalUntung < 0 ? t.dangerInk : ringkas.totalUntung > 0 ? t.accInk : t.mid }}
              className="text-[14px] font-semibold font-sans"
            >
              {`Untung total ${untungTeks(ringkas.totalUntung, ringkas.persen)}`}
            </Text>
          </View>
          {ringkas.aset.map((a) => (
            <KartuAset
              key={a.id}
              a={a}
              onBeli={() => router.push(`/pindah-dana?ke=${a.id}&mode=beli`)}
              onJual={() => router.push(`/pindah-dana?dari=${a.id}&mode=jual`)}
              onNilai={() => router.push(`/investasi/nilai?id=${a.id}`)}
            />
          ))}
          <Tombol label="Tambah aset" onPress={() => router.push('/dompet/baru?tipe=investasi')} />
        </>
      )}
    </ScrollView>
  );
}
