import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormHutang } from '@/components/FormHutang';
import { newTxId } from '@/data/transactions';

// Modal tambah hutang. Id transaksi dan id hutang dibuat sekali, dipakai ulang di setiap percobaan simpan.
export default function HutangBaru() {
  const router = useRouter();
  const [txId] = useState(() => newTxId());
  const [debtId] = useState(() => newTxId());
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pb-1 pt-4">
        <Text className="text-lg font-bold text-fg font-sans">Tambah hutang</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Batal" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Batal</Text>
        </Pressable>
      </View>
      <FormHutang
        txId={txId}
        debtId={debtId}
        onSaved={(id) => router.replace({ pathname: '/hutang/[id]', params: { id } })}
      />
    </View>
  );
}
