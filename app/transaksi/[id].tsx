import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TxForm } from '@/components/TxForm';
import { toAppError, type AppError } from '@/data/errors';
import { useDeleteTransaction, useTransaction } from '@/data/transactions';

function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}

// Modal ubah/hapus transaksi. Formulir dipakai bersama dengan Catat (TxForm mode 'ubah').
export default function UbahTransaksi() {
  const router = useRouter();
  const { id, bulan } = useLocalSearchParams<{ id: string; bulan?: string }>();
  const tx = useTransaction(id, bulan);
  const hapus = useDeleteTransaction();
  const [galat, setGalat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));

  async function lakukanHapus() {
    setBusy(true);
    setGalat(null);
    try {
      await hapus.mutateAsync(id);
      tutup();
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setBusy(false);
    }
  }

  function konfirmasiHapus() {
    Alert.alert('Hapus transaksi ini? Saldo dompet akan dihitung ulang.', undefined, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => void lakukanHapus() },
    ]);
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pb-1 pt-4">
        <Text className="text-lg font-bold text-fg">Ubah transaksi</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Batal" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid">Batal</Text>
        </Pressable>
      </View>
      {tx.data ? (
        <>
          <View className="flex-1">
            <TxForm key={tx.data.id} mode="ubah" initial={tx.data} onSaved={tutup} />
          </View>
          <View className="px-5 pb-6">
            {galat ? <Text className="mb-2 text-fg">{galat}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hapus"
              disabled={busy}
              onPress={konfirmasiHapus}
              className={`items-center rounded-xl border border-line py-3 ${busy ? 'opacity-50' : ''}`}
            >
              {busy ? <ActivityIndicator /> : <Text className="font-semibold text-fg">Hapus</Text>}
            </Pressable>
          </View>
        </>
      ) : (
        <Text className={`px-5 py-4 ${tx.error ? 'text-fg' : 'text-mid'}`}>
          {tx.error ? pesanGalat(tx.error) : 'Memuat…'}
        </Text>
      )}
    </View>
  );
}
