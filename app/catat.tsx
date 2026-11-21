import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMomen } from '@/animasi/useMomen';
import { BarJudul } from '@/components/BarJudul';
import { TxForm } from '@/components/TxForm';
import { newTxId } from '@/data/transactions';

// Modal catat manual. Id dibuat sekali saat layar dibuka, dipakai ulang di setiap percobaan simpan.
export default function Catat() {
  const router = useRouter();
  const [txId] = useState(() => newTxId());
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const momen = useMomen();
  const selesai = () => {
    momen('Transaksi tersimpan', 'Satu langkah lagi menuju tujuanmu');
    tutup();
  };
  return (
    <View className="flex-1 bg-bg">
      <View className="px-[18px] pt-4">
        <BarJudul judul="Catat" onKembali={tutup} />
      </View>
      <TxForm txId={txId} onSaved={selesai} />
    </View>
  );
}
