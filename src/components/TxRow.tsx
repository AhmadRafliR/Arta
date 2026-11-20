import { Text, View } from 'react-native';
import { formatRingkas } from '@/domain/money';
import type { Tx } from '@/domain/types';

const LABEL: Record<Tx['jenis'], string> = {
  pemasukan: 'Pemasukan',
  pengeluaran: 'Pengeluaran',
  transfer: 'Transfer',
  hutang_baru: 'Hutang baru',
  hutang_bayar: 'Bayar hutang',
  penyesuaian: 'Penyesuaian',
};

type Props = { tx: Tx; namaDompet: (id: string | null) => string | null };

export function TxRow({ tx, namaDompet }: Props) {
  const asal = namaDompet(tx.wallet_id);
  const tujuan = namaDompet(tx.wallet_tujuan_id);
  const judul = tx.kategori ?? LABEL[tx.jenis];
  const dompet = tx.jenis === 'transfer' && asal && tujuan ? `${asal} → ${tujuan}` : asal;
  const masuk = tx.jenis === 'pemasukan' || tx.jenis === 'hutang_baru';
  const keluar = tx.jenis === 'pengeluaran' || tx.jenis === 'hutang_bayar';
  const jumlah = `${masuk ? '+' : keluar ? '-' : ''}${formatRingkas(tx.nominal)}`;
  return (
    <View className="flex-row items-center gap-2 border-b border-line py-2">
      <View className="h-6 w-6 items-center justify-center rounded-lg bg-line">
        <Text className="text-xs font-bold text-fg font-sans">{judul.charAt(0).toUpperCase()}</Text>
      </View>
      <Text className="flex-1 text-xs text-fg font-sans" numberOfLines={1}>
        {dompet ? `${judul} · ${dompet}` : judul}
      </Text>
      <Text className={`font-sans text-xs font-bold ${masuk ? 'text-accink' : 'text-fg'}`}>{jumlah}</Text>
    </View>
  );
}
