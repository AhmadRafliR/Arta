import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMomen } from '@/animasi/useMomen';
import { BarJudul } from '@/components/BarJudul';
import { Tombol } from '@/components/Tombol';
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
  const momen = useMomen();
  const selesai = () => {
    momen('Perubahan tersimpan');
    tutup();
  };

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
      <View className="px-[18px] pt-4">
        <BarJudul judul="Ubah transaksi" onKembali={tutup} />
      </View>
      {tx.data ? (
        <TxForm
          key={tx.data.id}
          mode="ubah"
          initial={tx.data}
          onSaved={selesai}
          bawah={
            <>
              {galat ? <Text className="text-center font-sans text-[12.5px] text-dangerink">{galat}</Text> : null}
              <Tombol label="Hapus" bahaya busy={busy} disabled={busy} onPress={konfirmasiHapus} />
            </>
          }
        />
      ) : (
        <Text className={`font-sans px-5 py-4 ${tx.error ? 'text-fg' : 'text-mid'}`}>
          {tx.error ? pesanGalat(tx.error) : 'Memuat…'}
        </Text>
      )}
    </View>
  );
}
