import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarAlokasi } from '@/components/BarAlokasi';
import { BarJudul } from '@/components/BarJudul';
import { Ikon } from '@/components/ikon/Ikon';
import { KartuAset, TombolAksiAset, plTeks, tipeAset } from '@/components/KartuAset';
import { RingkasanInvestasi, tanggalInvestasi, updateTerakhirPerAset } from '@/components/RingkasanInvestasi';
import { DaftarDetail, KepalaSheet, SheetBawah } from '@/components/SheetBawah';
import { walletBalances } from '@/domain/balances';
import { ringkasInvestasi } from '@/domain/investasi';
import { formatRupiah } from '@/domain/money';
import { useAllTransactions } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { useTheme } from '@/theme/ThemeProvider';

/** Keadaan kosong (mockup: .empty): petak ikon, judul, pesan, tombol garis "Tambah aset". */
function KosongInvestasi({ onTambah }: { onTambah: () => void }) {
  const { t } = useTheme();
  return (
    <View className="items-center gap-2.5 rounded-[20px] border border-line bg-card px-[18px] pb-5 pt-6">
      <View style={{ width: 72, height: 72 }} className="items-center justify-center rounded-full bg-accsoft">
        <Ikon nama="wallet-investasi" ukuran={34} warna={t.accInk} />
      </View>
      <Text accessibilityRole="header" className="font-sans text-[16.5px] font-semibold text-fg">
        Belum ada investasi
      </Text>
      <Text className="max-w-[260px] text-center font-sans text-[13px] text-fg2" style={{ lineHeight: 19.5 }}>
        Tambahkan aset seperti reksa dana, saham, atau emas supaya nilainya terpantau.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tambah aset"
        onPress={onTambah}
        style={{ minHeight: 40, borderColor: t.accInk }}
        className="mt-1 justify-center rounded-full border px-4 py-[9px]"
      >
        <Text className="font-sans text-[13px] font-bold text-accink">Tambah aset</Text>
      </Pressable>
    </View>
  );
}

export default function Investasi() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wallets = useWallets();
  const txs = useAllTransactions();
  const [dipilihId, setDipilihId] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));
  const tambah = () => router.push('/dompet/baru?tipe=investasi');
  const ringkas =
    wallets.data && txs.data ? ringkasInvestasi(wallets.data, walletBalances(wallets.data, txs.data), txs.data) : null;
  const updatePeta = txs.data ? updateTerakhirPerAset(txs.data) : {};
  // Update terakhir portofolio = update nilai terbaru di antara aset yang aktif.
  const updateTotal =
    ringkas?.aset.reduce<string | null>((m, a) => {
      const u = updatePeta[a.id];
      return u && (!m || u > m) ? u : m;
    }, null) ?? null;
  const dipilih = ringkas?.aset.find((a) => a.id === dipilihId) ?? null;
  // Tutup sheet dulu, lalu pindah layar.
  const aksi = (rute: Href) => {
    setDipilihId(null);
    router.push(rute);
  };

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-[18px] pb-[34px]"
        contentContainerStyle={{ paddingTop: insets.top + 8 }}
      >
        <BarJudul
          judul="Investasi"
          onKembali={tutup}
          kanan={
            ringkas ? (
              <View className="rounded-full border border-line bg-card px-[9px] py-[3px]">
                <Text className="font-sans text-[11.5px] font-bold text-fg2">{`${ringkas.aset.length} aset`}</Text>
              </View>
            ) : null
          }
        />
        {ringkas === null ? (
          <Text className="text-mid font-sans">Memuat…</Text>
        ) : ringkas.aset.length === 0 ? (
          <>
            <RingkasanInvestasi totalNilai={0} totalModal={0} totalUntung={0} persen={null} update={null} tanpaLencana />
            <KosongInvestasi onTambah={tambah} />
          </>
        ) : (
          <>
            <RingkasanInvestasi
              totalNilai={ringkas.totalNilai}
              totalModal={ringkas.totalModal}
              totalUntung={ringkas.totalUntung}
              persen={ringkas.persen}
              update={updateTotal}
            />
            <BarAlokasi item={ringkas.aset.map((a) => ({ id: a.id, nama: a.nama, nilai: a.nilai }))} />
            <View className="flex-row items-center gap-2 px-px pt-0.5">
              <Text
                accessibilityRole="header"
                className="font-sans text-[13px] font-semibold uppercase tracking-[0.5px] text-mid"
              >
                Aset
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tambah aset"
                onPress={tambah}
                hitSlop={9}
                style={{ minHeight: 28 }}
                className="ml-auto justify-center px-0.5"
              >
                <Text className="font-sans text-[12.5px] font-bold text-accink underline">Tambah</Text>
              </Pressable>
            </View>
            <View className="gap-2.5">
              {ringkas.aset.map((a) => {
                const u = updatePeta[a.id];
                return (
                  <KartuAset
                    key={a.id}
                    a={a}
                    update={u ? tanggalInvestasi(u, true) : null}
                    onBuka={() => setDipilihId(a.id)}
                    onBeli={() => aksi(`/pindah-dana?ke=${a.id}&mode=beli`)}
                    onJual={() => aksi(`/pindah-dana?dari=${a.id}&mode=jual`)}
                    onNilai={() => aksi(`/investasi/nilai?id=${a.id}`)}
                  />
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <SheetBawah terbuka={dipilih !== null} onTutup={() => setDipilihId(null)} testID="sheet-aset">
        {dipilih ? (
          <>
            <KepalaSheet
              ikon={tipeAset(dipilih.nama).ikon}
              judul={dipilih.nama}
              sub={tipeAset(dipilih.nama).label ?? 'Investasi'}
              kanan={formatRupiah(dipilih.nilai)}
            />
            <DaftarDetail
              baris={[
                { label: 'Modal awal', nilai: formatRupiah(dipilih.modal) },
                { label: 'Nilai sekarang', nilai: formatRupiah(dipilih.nilai) },
                { label: 'Untung / rugi', nilai: plTeks(dipilih.untung, dipilih.persen) },
                {
                  label: 'Update terakhir',
                  nilai: updatePeta[dipilih.id] ? tanggalInvestasi(updatePeta[dipilih.id]) : '—',
                },
              ]}
            />
            <View className="flex-row gap-2">
              <TombolAksiAset
                label="Update nilai"
                ikon="wallet-investasi"
                primary
                onPress={() => aksi(`/investasi/nilai?id=${dipilih.id}`)}
              />
              <TombolAksiAset label="Beli" ikon="ui-plus" onPress={() => aksi(`/pindah-dana?ke=${dipilih.id}&mode=beli`)} />
            </View>
            <View className="flex-row gap-2">
              <TombolAksiAset label="Ubah" ikon="act-ubah" onPress={() => aksi(`/dompet/${dipilih.id}`)} />
              <TombolAksiAset
                label="Jual"
                ikon="ui-arrow-down"
                onPress={() => aksi(`/pindah-dana?dari=${dipilih.id}&mode=jual`)}
              />
            </View>
            <Text className="font-sans text-[11.5px] text-fg2" style={{ lineHeight: 16.5 }}>
              Beli dan jual dicatat sebagai transfer antara dompet harian dan dompet investasi ini.
            </Text>
          </>
        ) : null}
      </SheetBawah>
    </View>
  );
}
