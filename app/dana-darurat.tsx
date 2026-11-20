import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmountInput } from '@/components/AmountInput';
import { KeadaanKosong } from '@/components/KeadaanKosong';
import { TombolKecil } from '@/components/KartuAset';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { walletBalances } from '@/domain/balances';
import { ringkasDarurat } from '@/domain/danaDarurat';
import { formatRupiah } from '@/domain/money';
import { hariIni } from '@/lib/tanggal';
import { pesanDompet } from '@/data/pesan';
import { useAllTransactions } from '@/data/transactions';
import { useUpdateWallet, useWallets } from '@/data/wallets';
import { useTheme } from '@/theme/ThemeProvider';

function Bar({ persen }: { persen: number }) {
  const { t } = useTheme();
  return (
    <View className="h-2 overflow-hidden rounded-full bg-line">
      <View style={{ width: `${Math.min(100, Math.max(0, persen))}%`, backgroundColor: t.acc }} className="h-2 rounded-full" />
    </View>
  );
}

export default function DanaDarurat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const wallets = useWallets();
  const txs = useAllTransactions();
  const update = useUpdateWallet();
  const [ubahId, setUbahId] = useState<string | null>(null);
  const [targetBaru, setTargetBaru] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const sibuk = useRef(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));
  const bulanIni = hariIni(profile?.zona_waktu).slice(0, 7);
  const r =
    wallets.data && txs.data
      ? ringkasDarurat(wallets.data, walletBalances(wallets.data, txs.data), txs.data, bulanIni)
      : null;

  async function simpanTarget(id: string) {
    if (targetBaru === null || sibuk.current) return;
    sibuk.current = true;
    setBusy(true);
    setPesan(null);
    try {
      await update.mutateAsync({ id, patch: { target: targetBaru === 0 ? null : targetBaru } });
      setUbahId(null);
    } catch (e) {
      setPesan(pesanDompet(e));
    } finally {
      sibuk.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-4 px-5 pb-8"
      contentContainerStyle={{ paddingTop: insets.top + 16 }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-fg font-sans">Dana darurat</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Kembali" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Kembali</Text>
        </Pressable>
      </View>
      {r === null ? (
        <Text className="text-mid font-sans">{wallets.error ? pesanDompet(wallets.error) : 'Memuat…'}</Text>
      ) : r.dompet.length === 0 ? (
        <>
          <KeadaanKosong
            ikon="wallet-darurat"
            pesan="Belum ada dana darurat. Sisihkan sedikit tiap bulan untuk jaga-jaga."
          />
          <Tombol label="Buat dana darurat" primary onPress={() => router.push('/dompet/baru?tipe=darurat')} />
        </>
      ) : (
        <>
          <View className="gap-2 rounded-2xl border border-line bg-card2 p-4">
            <Text className="text-mid font-sans">Total dana darurat</Text>
            <Text className="text-2xl font-bold text-fg font-sans">{formatRupiah(r.total)}</Text>
            {r.totalTarget !== null ? (
              <>
                <Text className="text-[13px] text-mid font-sans">{`dari target ${formatRupiah(r.totalTarget)}`}</Text>
                {r.persen !== null ? <Text className="text-[13px] text-mid font-sans">{`${r.persen}%`}</Text> : null}
                <Bar persen={r.persen ?? 0} />
              </>
            ) : null}
            {r.cakupanBulan !== null ? (
              <Text className="text-fg2 font-sans">
                {`Cukup untuk ${String(r.cakupanBulan).replace('.', ',')} bulan pengeluaran`}
              </Text>
            ) : null}
          </View>
          {r.dompet.map((d) => (
            <View key={d.id} className="gap-2 rounded-2xl border border-line bg-card p-4">
              <Text className="font-semibold text-fg font-sans">{d.nama}</Text>
              <Text className="text-xl font-bold text-fg font-sans">{formatRupiah(d.saldo)}</Text>
              {d.target !== null && d.persen !== null ? (
                <>
                  <Text className="text-[13px] text-mid font-sans">{`Target ${formatRupiah(d.target)} (${d.persen}%)`}</Text>
                  <Bar persen={d.persen} />
                </>
              ) : (
                <Text className="text-[13px] text-mid font-sans">Belum ada target</Text>
              )}
              <View className="mt-1 flex-row flex-wrap gap-2">
                <TombolKecil label="Setor" onPress={() => router.push(`/pindah-dana?ke=${d.id}&mode=setor`)} />
                <TombolKecil label="Tarik" onPress={() => router.push(`/pindah-dana?dari=${d.id}&mode=tarik`)} />
                <TombolKecil
                  label="Ubah target"
                  onPress={() => {
                    setUbahId(ubahId === d.id ? null : d.id);
                    setTargetBaru(null);
                    setPesan(null);
                  }}
                />
              </View>
              {ubahId === d.id ? (
                <View className="gap-2">
                  <Text className="text-[13px] text-mid font-sans">Isi 0 untuk menghapus target.</Text>
                  <AmountInput value={null} allowZero onChange={setTargetBaru} editable={!busy} testID="target-baru" />
                  <Tombol
                    label="Simpan target"
                    primary
                    busy={busy}
                    disabled={busy || targetBaru === null}
                    onPress={() => void simpanTarget(d.id)}
                  />
                </View>
              ) : null}
            </View>
          ))}
          {pesan ? <Text className="text-fg font-sans">{pesan}</Text> : null}
        </>
      )}
    </ScrollView>
  );
}
