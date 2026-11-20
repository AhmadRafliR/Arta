import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormHutang } from '@/components/FormHutang';
import { KepalaHutang } from '@/components/hutang/BagianHutang';
import { newTxId } from '@/data/transactions';

// Modal tambah hutang. Id transaksi dan id hutang dibuat sekali, dipakai ulang di setiap percobaan simpan.
export default function HutangBaru() {
  const router = useRouter();
  const [txId] = useState(() => newTxId());
  const [debtId] = useState(() => newTxId());
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View className="flex-1 bg-bg">
      <View className="px-[18px] pb-3 pt-5">
        <KepalaHutang ikon="nav-hutang" judul="Tambah hutang" sub="Paylater, cicilan, atau pinjaman" onTutup={tutup} />
      </View>
      <FormHutang
        txId={txId}
        debtId={debtId}
        onSaved={(id) => router.replace({ pathname: '/hutang/[id]', params: { id } })}
        onBatal={tutup}
      />
    </View>
  );
}
