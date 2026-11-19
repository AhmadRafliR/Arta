import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AmountInput } from '@/components/AmountInput';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { adjustmentFor, canArchive } from '@/domain/adjust';
import { walletBalances } from '@/domain/balances';
import { formatRupiah } from '@/domain/money';
import { hariIni } from '@/lib/tanggal';
import { pesanDompet } from '@/data/pesan';
import { newTxId, useAllTransactions, useSaveTransactions } from '@/data/transactions';
import { useUpdateWallet, useWallets } from '@/data/wallets';
import { useTheme } from '@/theme/ThemeProvider';

export const PESAN_ARSIP = 'Pindahkan dulu saldonya ke dompet lain';
export const PESAN_SAMA = 'Saldo sudah sama';

// Detail dompet: ubah nama, sesuaikan saldo, arsipkan. Tidak ada hapus (FK ke transaksi).
export default function DetailDompet() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { t } = useTheme();
  const wallets = useWallets();
  const txs = useAllTransactions();
  const update = useUpdateWallet();
  const simpanTx = useSaveTransactions();
  const [txId] = useState(() => newTxId()); // sekali per layar dibuka; dipakai ulang saat coba lagi
  const [nama, setNama] = useState<string | null>(null);
  const [saldoBaru, setSaldoBaru] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));
  const wallet = wallets.data?.find((w) => w.id === id);

  if (!wallet) {
    return (
      <View className="flex-1 bg-bg px-5 pt-6">
        <Text className="text-mid">{wallets.error ? pesanDompet(wallets.error) : 'Memuat…'}</Text>
      </View>
    );
  }

  const saldo = txs.data ? (walletBalances(wallets.data ?? [], txs.data)[wallet.id] ?? 0) : null;
  const namaIsi = nama ?? wallet.nama;
  const namaOk = namaIsi.trim() !== '' && namaIsi.trim() !== wallet.nama;

  async function jalankan(fn: () => Promise<void>) {
    setBusy(true);
    setPesan(null);
    try {
      await fn();
    } catch (e) {
      setPesan(pesanDompet(e));
    } finally {
      setBusy(false);
    }
  }

  const simpanNama = () =>
    jalankan(async () => {
      await update.mutateAsync({ id: wallet.id, patch: { nama: namaIsi.trim() } });
      setNama(null);
    });

  const sesuaikan = () => {
    if (saldo === null || saldoBaru === null) return;
    const selisih = adjustmentFor(saldo, saldoBaru);
    if (selisih === null) {
      setPesan(PESAN_SAMA);
      return;
    }
    void jalankan(async () => {
      await simpanTx.mutateAsync([
        {
          id: txId,
          tanggal: hariIni(profile?.zona_waktu),
          jenis: 'penyesuaian',
          kategori: 'penyesuaian',
          nominal: selisih,
          wallet_id: wallet.id,
          wallet_tujuan_id: null,
          catatan: 'Penyesuaian saldo',
          transkrip: null,
          sumber: 'manual',
        },
      ]);
      tutup();
    });
  };

  const ubahArsip = (diarsip: boolean) => {
    if (diarsip && (saldo === null || !canArchive(saldo))) {
      setPesan(PESAN_ARSIP);
      return;
    }
    void jalankan(async () => {
      await update.mutateAsync({ id: wallet.id, patch: { diarsip } });
      tutup();
    });
  };

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 px-5 py-6">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-fg">{wallet.nama}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid">Tutup</Text>
        </Pressable>
      </View>
      <Text className="text-2xl font-bold text-fg">{saldo === null ? '…' : formatRupiah(saldo)}</Text>
      {wallet.diarsip ? <Text className="text-mid">Dompet ini diarsipkan.</Text> : null}

      <Text className="font-semibold text-fg">Nama dompet</Text>
      <TextInput
        value={namaIsi}
        onChangeText={setNama}
        accessibilityLabel="Nama dompet"
        placeholder="Nama dompet"
        placeholderTextColor={t.mid}
        className="rounded-xl border border-line bg-card px-4 py-3 text-fg"
      />
      <Tombol label="Simpan nama" onPress={() => void simpanNama()} disabled={busy || !namaOk} />

      <Text className="mt-2 font-semibold text-fg">Sesuaikan saldo</Text>
      <Text className="text-mid">Isi saldo sebenarnya saat ini.</Text>
      <AmountInput value={null} allowZero onChange={setSaldoBaru} editable={!busy} testID="saldo-baru" />
      <Tombol
        label="Simpan penyesuaian"
        primary
        busy={busy}
        onPress={sesuaikan}
        disabled={busy || saldo === null || saldoBaru === null}
      />

      <View className="mt-2">
        {wallet.diarsip ? (
          <Tombol label="Aktifkan kembali" onPress={() => ubahArsip(false)} disabled={busy} />
        ) : (
          <Tombol label="Arsipkan" onPress={() => ubahArsip(true)} disabled={busy} />
        )}
      </View>
      {pesan ? <Text className="text-fg">{pesan}</Text> : null}
    </ScrollView>
  );
}
