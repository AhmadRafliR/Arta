import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { BarJudul } from '@/components/BarJudul';
import { TxForm } from '@/components/TxForm';
import { newTxId } from '@/data/transactions';

// Modal catat manual. Id dibuat sekali saat layar dibuka, dipakai ulang di setiap percobaan simpan.
export default function Catat() {
  const router = useRouter();
  const [txId] = useState(() => newTxId());
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View className="flex-1 bg-bg">
      <View className="px-[18px] pt-4">
        <BarJudul judul="Catat" onKembali={tutup} />
      </View>
      <TxForm txId={txId} onSaved={tutup} />
    </View>
  );
}
