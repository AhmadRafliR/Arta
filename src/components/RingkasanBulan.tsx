import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { labelBulanPanjang } from '@/components/BarBulan';
import { Ikon } from '@/components/ikon/Ikon';
import { formatRupiah } from '@/domain/money';
import type { Tx } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  /** Semua transaksi bulan itu (tanpa filter). */
  txs: Tx[];
  bulan: string;
  bulanIni: string;
};

/** Total bulan: masuk = pemasukan, keluar = pengeluaran; cicilan hutang dan transfer dihitung terpisah. */
export function hitungRingkasan(txs: Tx[]) {
  let masuk = 0;
  let keluar = 0;
  let cicilan = 0;
  let transfer = 0;
  for (const x of txs) {
    if (x.jenis === 'pemasukan') masuk += x.nominal;
    else if (x.jenis === 'pengeluaran') keluar += x.nominal;
    else if (x.jenis === 'hutang_bayar') cicilan += 1;
    else if (x.jenis === 'transfer') transfer += 1;
  }
  return { masuk, keluar, selisih: masuk - keluar, cicilan, transfer };
}

// Kartu ringkasan bergradien (mockup arta: .summary): selisih besar, kisi Masuk/Keluar, catatan kecil,
// dan lingkaran dekoratif di pojok kanan atas.
export function RingkasanBulan({ txs, bulan, bulanIni }: Props) {
  const { t } = useTheme();
  const r = hitungRingkasan(txs);
  const bagian = [r.cicilan ? `${r.cicilan} cicilan hutang` : null, r.transfer ? `${r.transfer} transfer antar dompet` : null].filter(
    (x): x is string => !!x,
  );
  const catatan = bagian.length
    ? `${bagian.join(' · ')} — tidak dihitung pengeluaran harian.`
    : 'Belum ada cicilan atau transfer bulan ini.';
  const judul = bulan === bulanIni ? 'Selisih bulan ini' : `Selisih ${labelBulanPanjang(bulan)}`;

  return (
    <LinearGradient
      testID="ringkasan-bulan"
      colors={[t.heroFrom, t.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, paddingTop: 16, paddingBottom: 14, paddingHorizontal: 18, overflow: 'hidden' }}
    >
      {/* Lingkaran dekoratif (mockup: .summary::after). */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -34,
          top: -46,
          width: 148,
          height: 148,
          borderRadius: 74,
          borderWidth: 1,
          borderColor: t.amLine,
          opacity: 0.55,
        }}
      />
      <Text style={{ color: t.amSub }} className="font-sans text-[11px] font-semibold uppercase tracking-[1.5px]" numberOfLines={1}>
        {judul}
      </Text>
      <Text
        style={{ color: t.heroFg, fontVariant: ['tabular-nums'] }}
        className="mt-1 font-sans text-[30px] font-semibold"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {formatRupiah(r.selisih)}
      </Text>
      <View style={{ borderTopColor: t.amLine }} className="mt-3.5 flex-row gap-2 border-t pt-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center gap-[5px]">
            <Ikon nama="ui-arrow-down" ukuran={13} warna={t.amSub} />
            <Text style={{ color: t.amSub }} className="font-sans text-[11px] font-semibold tracking-[0.3px]">
              Masuk
            </Text>
          </View>
          <Text style={{ color: t.amIn, fontVariant: ['tabular-nums'] }} className="font-sans text-base font-semibold" numberOfLines={1}>
            {formatRupiah(r.masuk)}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center gap-[5px]">
            <Ikon nama="ui-arrow-up" ukuran={13} warna={t.amSub} />
            <Text style={{ color: t.amSub }} className="font-sans text-[11px] font-semibold tracking-[0.3px]">
              Keluar
            </Text>
          </View>
          <Text style={{ color: t.heroFg, fontVariant: ['tabular-nums'] }} className="font-sans text-base font-semibold" numberOfLines={1}>
            {formatRupiah(r.keluar)}
          </Text>
        </View>
      </View>
      <Text style={{ color: t.amSub }} className="mt-2.5 font-sans text-[11.5px] leading-4">
        {catatan}
      </Text>
    </LinearGradient>
  );
}
