import { KeadaanKosong } from '@/components/KeadaanKosong';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarBulan, labelHariPanjang } from '@/components/BarBulan';
import { BarJudul } from '@/components/BarJudul';
import { RingkasanBulan } from '@/components/RingkasanBulan';
import { adaFilter, RiwayatFilter } from '@/components/RiwayatFilter';
import { SheetTransaksi } from '@/components/SheetTransaksi';
import { LABEL_JENIS, nominalBertanda, TxRow } from '@/components/TxRow';
import { useAuth } from '@/auth/AuthProvider';
import { useTransactions } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { formatRupiah } from '@/domain/money';
import type { Tx } from '@/domain/types';
import { filterTx, kelompokHarian, type FilterTx } from '@/lib/filterTx';
import { geserBulan, hariIni as hariIniDi } from '@/lib/tanggal';
import { useGulirPulau } from '@/nav/useGulirPulau';
import { spacerNav } from '@/nav/pulau';

export default function Riwayat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gulir = useGulirPulau('riwayat');
  const { profile } = useAuth();
  const hariIni = hariIniDi(profile?.zona_waktu || undefined);
  const bulanIni = hariIni.slice(0, 7);
  const [bulan, setBulan] = useState(bulanIni);
  const [filter, setFilter] = useState<FilterTx>({});
  // Sheet detail: tx terakhir disimpan terpisah dari status buka agar isi tidak hilang saat animasi tutup.
  const [dipilih, setDipilih] = useState<Tx | null>(null);
  const [sheetTerbuka, setSheetTerbuka] = useState(false);

  // Ganti bulan: reset filter kategori (daftar kategori bergantung bulan, chip terpilih bisa hilang).
  // Tidak bisa maju melewati bulan berjalan.
  const gantiBulan = (d: number) => {
    setBulan((b) => {
      const baru = geserBulan(b, d);
      return baru > bulanIni ? b : baru;
    });
    setFilter((f) => ({ ...f, kategori: undefined }));
  };

  const wallets = useWallets();
  const q = useTransactions(bulan);
  const dompet = wallets.data ?? [];
  const namaDompet = (id: string | null) => dompet.find((w) => w.id === id)?.nama ?? null;

  const semua = q.data;
  const kategori = useMemo(
    () => [...new Set((semua ?? []).map((t) => t.kategori).filter((k): k is string => !!k))].sort(),
    [semua],
  );
  const grup = useMemo(() => kelompokHarian(filterTx(semua ?? [], filter)), [semua, filter]);
  const jumlahTx = grup.reduce((n, g) => n + g.items.length, 0);
  const totalHasil = grup.reduce((n, g) => n + g.total, 0);
  const terfilter = adaFilter(filter);

  const bukaDetail = (tx: Tx) => {
    setDipilih(tx);
    setSheetTerbuka(true);
  };
  const ubah = (tx: Tx) => {
    setSheetTerbuka(false);
    router.push(`/transaksi/${tx.id}?bulan=${bulan}`);
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerClassName="gap-3 px-4"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: spacerNav(insets.bottom) }}
        {...gulir}
      >
        <BarJudul judul="Riwayat" />

        <BarBulan bulan={bulan} bulanIni={bulanIni} onGeser={gantiBulan} />

        {semua ? <RingkasanBulan txs={semua} bulan={bulan} bulanIni={bulanIni} /> : null}

        <RiwayatFilter
          filter={filter}
          onChange={setFilter}
          kategori={kategori}
          dompet={dompet.map((w) => ({ id: w.id, nama: w.nama, tipe: w.tipe }))}
        />

        {semua === undefined ? (
          <Text className={`font-sans ${q.error ? 'text-fg' : 'text-mid'}`}>{q.error ? q.error.pesan : 'Memuat…'}</Text>
        ) : grup.length === 0 ? (
          <View className="gap-3">
            <KeadaanKosong
              ilustrasi="transaksi"
              pesan={
                semua.length > 0 && terfilter ? 'Tidak ada transaksi yang cocok dengan filter.' : 'Belum ada transaksi di bulan ini.'
              }
            />
            {terfilter ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hapus filter"
                onPress={() => setFilter({})}
                style={{ minHeight: 40 }}
                className="items-center justify-center self-center rounded-full border border-accink px-4 py-[9px]"
              >
                <Text className="font-sans text-[13px] font-bold text-accink">Hapus filter</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            {/* Baris hasil (mockup: .result-line): jumlah transaksi · total pemasukan - pengeluaran. */}
            <View className="flex-row items-center gap-2 px-px">
              <Text className="font-sans text-[12.5px] font-semibold text-fg2">{`${jumlahTx} transaksi`}</Text>
              <View className="h-1 w-1 rounded-full bg-mid" />
              <Text style={{ fontVariant: ['tabular-nums'] }} className="ml-auto font-sans text-[12.5px] font-semibold text-fg">
                {formatRupiah(totalHasil)}
              </Text>
            </View>

            <View className="gap-4 pt-0.5">
              {grup.map((g) => (
                <View key={g.tanggal}>
                  <View className="flex-row items-baseline gap-2 px-0.5 pb-[7px]">
                    <Text className="flex-1 font-sans text-[13px] font-semibold text-fg" numberOfLines={1}>
                      {labelHariPanjang(g.tanggal, hariIni)}
                    </Text>
                    <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-xs font-semibold text-mid">
                      {formatRupiah(g.total)}
                    </Text>
                  </View>
                  <View className="overflow-hidden rounded-[20px] border border-line bg-card">
                    {g.items.map((tx, i) => (
                      <Pressable
                        key={tx.id}
                        accessibilityRole="button"
                        accessibilityHint="Buka detail"
                        accessibilityLabel={`${tx.catatan ?? tx.kategori ?? LABEL_JENIS[tx.jenis]}, ${nominalBertanda(tx)}, ${LABEL_JENIS[tx.jenis]}`}
                        onPress={() => bukaDetail(tx)}
                        className={`px-3.5 active:bg-card2 ${i > 0 ? 'border-t border-line' : ''}`}
                      >
                        <TxRow tx={tx} namaDompet={namaDompet} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <SheetTransaksi
        tx={dipilih}
        terbuka={sheetTerbuka}
        onTutup={() => setSheetTerbuka(false)}
        onUbah={ubah}
        namaDompet={namaDompet}
        hariIni={hariIni}
      />
    </>
  );
}
