import { Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { ikonKategori } from '@/components/ikon/peta';
import { formatRupiah } from '@/domain/money';
import type { Tx } from '@/domain/types';
import { labelTanggalRelatif } from '@/lib/labelTanggal';
import { useTheme } from '@/theme/ThemeProvider';

const LABEL: Record<Tx['jenis'], string> = {
  pemasukan: 'Pemasukan',
  pengeluaran: 'Pengeluaran',
  transfer: 'Transfer',
  hutang_baru: 'Hutang baru',
  hutang_bayar: 'Bayar hutang',
  penyesuaian: 'Penyesuaian',
};

type Props = { tx: Tx; namaDompet: (id: string | null) => string | null; hariIni?: string };

export function TxRow({ tx, namaDompet, hariIni }: Props) {
  const { t } = useTheme();
  const asal = namaDompet(tx.wallet_id);
  const tujuan = namaDompet(tx.wallet_tujuan_id);
  const kategori = tx.kategori ? tx.kategori.charAt(0).toUpperCase() + tx.kategori.slice(1) : null;
  const judul = tx.catatan ?? kategori ?? LABEL[tx.jenis];
  const dompet = tx.jenis === 'transfer' && asal && tujuan ? `${asal} → ${tujuan}` : asal;
  const penyesuaianHutang = tx.jenis === 'penyesuaian' && !!tx.debt_id;
  const meta = [penyesuaianHutang ? 'Sisa hutang' : kategori, dompet, hariIni ? labelTanggalRelatif(tx.tanggal, hariIni) : null]
    .filter((x): x is string => !!x)
    .join(' · ');
  const masuk = tx.jenis === 'pemasukan' || (tx.jenis === 'hutang_baru' && tx.wallet_id !== null);
  const keluar = tx.jenis === 'pengeluaran' || tx.jenis === 'hutang_bayar';
  const jumlah = `${masuk ? '+' : keluar ? '-' : ''}${formatRupiah(tx.nominal)}`;
  return (
    <View className="flex-row items-center gap-3 py-2.5">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-card2">
        <Ikon nama={tx.jenis.startsWith('hutang_') ? 'nav-hutang' : ikonKategori(tx.kategori)} ukuran={22} warna={t.fg2} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-fg font-sans" numberOfLines={1}>
          {judul}
        </Text>
        {meta ? (
          <Text className="text-[12.5px] text-fg2 font-sans" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Text className={`font-sans text-[15px] font-semibold ${masuk ? 'text-accink' : 'text-fg'}`}>{jumlah}</Text>
    </View>
  );
}
