import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmountInput } from '@/components/AmountInput';
import { untungTeks } from '@/components/KartuAset';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { adjustmentFor } from '@/domain/adjust';
import { walletBalances } from '@/domain/balances';
import { ringkasAset } from '@/domain/investasi';
import { formatRupiah } from '@/domain/money';
import { hariIni } from '@/lib/tanggal';
import { pesanDompet } from '@/data/pesan';
import { newTxId, useAllTransactions, useSaveTransactions, type NewTx } from '@/data/transactions';
import { useWallets } from '@/data/wallets';

export default function NilaiInvestasi() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const wallets = useWallets();
  const txs = useAllTransactions();
  const simpanTx = useSaveTransactions();
  const [txId] = useState(() => newTxId()); // sekali per layar dibuka; dipakai ulang saat coba lagi
  const [baru, setBaru] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const sibuk = useRef(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));
  const wallet = wallets.data?.find((w) => w.id === id);

  const header = (judul: string) => (
    <View className="flex-row items-center justify-between">
      <Text className="flex-1 text-lg font-bold text-fg font-sans">{judul}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Batal" onPress={tutup} className="px-2 py-1">
        <Text className="text-mid font-sans">Batal</Text>
      </Pressable>
    </View>
  );
  const bungkus = (isi: ReactNode) => (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-4 px-5 pb-8"
      contentContainerStyle={{ paddingTop: insets.top + 16 }}
    >
      {isi}
    </ScrollView>
  );

  if (!wallet || !txs.data) {
    return bungkus(
      <>
        {header('Update nilai')}
        <Text className="text-mid font-sans">{wallets.error ? pesanDompet(wallets.error) : 'Memuat…'}</Text>
      </>,
    );
  }
  const dompet = wallet;

  // Dasar: tanpa penyesuaian kita sendiri (id tetap), agar coba ulang tidak menghitung ganda.
  const lain = txs.data.filter((x) => x.id !== txId);
  const nilai = walletBalances(wallets.data ?? [], lain)[dompet.id] ?? 0;
  const selisih = baru === null ? null : adjustmentFor(nilai, baru);
  const sama = baru !== null && selisih === null;
  const untungBaru = baru === null ? null : baru - ringkasAset(dompet, nilai, lain).modal;

  async function simpan() {
    if (selisih === null || sibuk.current) return;
    sibuk.current = true;
    setBusy(true);
    setPesan(null);
    try {
      const item: NewTx = {
        id: txId,
        tanggal: hariIni(profile?.zona_waktu),
        jenis: 'penyesuaian',
        kategori: 'penyesuaian',
        nominal: selisih,
        wallet_id: dompet.id,
        wallet_tujuan_id: null,
        catatan: 'Update nilai investasi',
        transkrip: null,
        sumber: 'manual',
      };
      await simpanTx.mutateAsync([item]);
      tutup();
    } catch (e) {
      setPesan(pesanDompet(e));
    } finally {
      sibuk.current = false;
      setBusy(false);
    }
  }

  return bungkus(
    <>
      {header(`Update nilai ${dompet.nama}`)}
      <Text className="text-mid font-sans">Nilai sekarang</Text>
      <Text className="text-2xl font-bold text-fg font-sans">{formatRupiah(nilai)}</Text>
      <Text className="text-mid font-sans">Nilai baru</Text>
      <AmountInput value={null} allowZero onChange={setBaru} editable={!busy} testID="nilai-baru" />
      {untungBaru !== null ? (
        <Text className="text-fg2 font-sans">{`Untung jadi ${untungTeks(untungBaru, null)}`}</Text>
      ) : null}
      <Tombol
        label={sama ? 'Nilainya sama' : 'Simpan'}
        primary
        busy={busy}
        disabled={busy || selisih === null}
        onPress={() => void simpan()}
      />
      {pesan ? <Text className="text-fg font-sans">{pesan}</Text> : null}
    </>,
  );
}
