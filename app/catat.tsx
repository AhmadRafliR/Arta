import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TxForm } from '@/components/TxForm';
import { newTxId } from '@/data/transactions';

// Modal catat manual. Id dibuat sekali saat layar dibuka, dipakai ulang di setiap percobaan simpan.
export default function Catat() {
  const router = useRouter();
  const [txId] = useState(() => newTxId());
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pb-1 pt-4">
        <Text className="text-lg font-bold text-fg">Catat transaksi</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Batal" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid">Batal</Text>
        </Pressable>
      </View>
      <TxForm txId={txId} onSaved={tutup} />
    </View>
  );
}
