import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { ikonKategori } from '@/components/ikon/peta';
import { formatRupiah } from '@/domain/money';
import type { Tx } from '@/domain/types';
import { labelTanggalRelatif } from '@/lib/labelTanggal';
import { useTheme } from '@/theme/ThemeProvider';

export const LABEL_JENIS: Record<Tx['jenis'], string> = {
  pemasukan: 'Pemasukan',
  pengeluaran: 'Pengeluaran',
  transfer: 'Transfer',
  hutang_baru: 'Hutang baru',
  hutang_bayar: 'Bayar hutang',
  penyesuaian: 'Penyesuaian',
};

/** Kategori dengan huruf pertama kapital (null bila tidak ada). */
export function kategoriKapital(tx: Tx): string | null {
  return tx.kategori ? tx.kategori.charAt(0).toUpperCase() + tx.kategori.slice(1) : null;
}

/** Arah uang transaksi: masuk (+, aksen), keluar (-), atau netral (tanpa tanda). */
export function arahTx(tx: Tx): { masuk: boolean; keluar: boolean } {
  const masuk = tx.jenis === 'pemasukan' || (tx.jenis === 'hutang_baru' && tx.wallet_id !== null);
  const keluar = tx.jenis === 'pengeluaran' || tx.jenis === 'hutang_bayar';
  return { masuk, keluar };
}

/** Nominal bertanda sesuai arah, mis. "+Rp750.000" / "-Rp28.000" / "Rp50.000". */
export function nominalBertanda(tx: Tx): string {
  const { masuk, keluar } = arahTx(tx);
  return `${masuk ? '+' : keluar ? '-' : ''}${formatRupiah(tx.nominal)}`;
}

/** Ikon transaksi: hutang -> nav-hutang, transfer -> panah tukar, selain itu ikon kategori. */
export function ikonTx(tx: Tx): NamaIkon {
  if (tx.jenis.startsWith('hutang_')) return 'nav-hutang';
  if (tx.jenis === 'transfer') return 'ui-tukar';
  return ikonKategori(tx.kategori);
}

type Props = { tx: Tx; namaDompet: (id: string | null) => string | null; hariIni?: string };

// Baris transaksi (mockup arta: .row). Masuk = petak ikon aksen lembut + nominal accInk;
// hutang = petak ikon bergradien (gelap: aksen lembut); transfer = nominal redup.
export function TxRow({ tx, namaDompet, hariIni }: Props) {
  const { t, mode } = useTheme();
  const asal = namaDompet(tx.wallet_id);
  const tujuan = namaDompet(tx.wallet_tujuan_id);
  const kategori = kategoriKapital(tx);
  const judul = tx.catatan ?? kategori ?? LABEL_JENIS[tx.jenis];
  const dompet = tx.jenis === 'transfer' && asal && tujuan ? `${asal} → ${tujuan}` : asal;
  const penyesuaianHutang = tx.jenis === 'penyesuaian' && !!tx.debt_id;
  const meta = [penyesuaianHutang ? 'Sisa hutang' : kategori, dompet, hariIni ? labelTanggalRelatif(tx.tanggal, hariIni) : null]
    .filter((x): x is string => !!x)
    .join(' · ');
  const { masuk } = arahTx(tx);
  const transfer = tx.jenis === 'transfer';
  const hutang = tx.jenis.startsWith('hutang_');
  const ikon = ikonTx(tx);
  const gradien = hutang && mode !== 'gelap';

  const petak = { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ minHeight: 62 }} className="flex-row items-center gap-3 py-[11px]">
      {gradien ? (
        <LinearGradient colors={[t.heroFrom, t.heroTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={petak}>
          <Ikon nama={ikon} ukuran={20} warna={t.heroFg} />
        </LinearGradient>
      ) : (
        <View style={petak} className={masuk || hutang ? 'bg-accsoft' : 'bg-card2'}>
          <Ikon nama={ikon} ukuran={20} warna={masuk || hutang ? t.accInk : t.fg2} />
        </View>
      )}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans text-[14.5px] font-semibold text-fg" numberOfLines={1}>
          {judul}
        </Text>
        {meta ? (
          <Text className="font-sans text-xs text-fg2" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Text
        style={{ fontVariant: ['tabular-nums'] }}
        className={`font-sans text-[14.5px] ${transfer ? 'font-medium text-fg2' : `font-semibold ${masuk ? 'text-accink' : 'text-fg'}`}`}
      >
        {nominalBertanda(tx)}
      </Text>
    </View>
  );
}
