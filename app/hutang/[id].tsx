import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AmountInput } from '@/components/AmountInput';
import { BarisTagihan } from '@/components/BarisTagihan';
import { Tombol } from '@/components/Tombol';
import { TxRow } from '@/components/TxRow';
import { useAuth } from '@/auth/AuthProvider';
import { useDebt, useDebtSchedule, useDeleteDebt, useTambahJadwal, useUpdateDebt } from '@/data/debts';
import { toAppError } from '@/data/errors';
import { useDebtTransactions } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { formatRupiah } from '@/domain/money';
import { hariIni, tanggalValid } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

const PESAN_HAPUS = 'Hapus hutang ini? Semua pembayarannya ikut terhapus dan saldo dompet dihitung ulang.';

// Detail hutang: ringkasan, jadwal tagihan, riwayat pembayaran, arsip, dan hapus.
export default function DetailHutang() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { t } = useTheme();
  const hari = hariIni(profile?.zona_waktu || undefined);
  const hutang = useDebt(id);
  const jadwal = useDebtSchedule(id);
  const riwayat = useDebtTransactions(id);
  const wallets = useWallets();
  const ubah = useUpdateDebt();
  const hapus = useDeleteDebt();
  const tambah = useTambahJadwal();
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [formTagihan, setFormTagihan] = useState(false);
  const [tgl, setTgl] = useState('');
  const [nominal, setNominal] = useState<number | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const h = hutang.data;

  if (!h) {
    return (
      <View className="flex-1 bg-bg px-5 pt-6">
        <Text className="text-mid font-sans">{hutang.error ? hutang.error.pesan : 'Memuat…'}</Text>
      </View>
    );
  }

  const berbunga = h.tipe === 'berbunga';
  const info = berbunga
    ? `Pokok awal ${formatRupiah(h.pokok_awal)} · bunga ${h.bunga_persen_bulanan ?? 0}%/bln ${h.metode ?? ''}`.trim()
    : `Cicilan ${formatRupiah(h.nominal_cicilan ?? 0)} × ${h.tenor_bulan ?? 0} bulan`;
  const tagihan = jadwal.data ?? [];
  const txs = riwayat.data ?? [];
  const namaDompet = (wid: string | null) => wallets.data?.find((w) => w.id === wid)?.nama ?? null;

  async function jalankan(fn: () => Promise<void>) {
    setBusy(true);
    setPesan(null);
    try {
      await fn();
    } catch (e) {
      setPesan(toAppError(e, { aksi: 'simpan-transaksi' }).pesan);
    } finally {
      setBusy(false);
    }
  }

  const ubahArsip = (diarsip: boolean) => void jalankan(async () => void (await ubah.mutateAsync({ id, patch: { diarsip } })));

  const konfirmasiHapus = () =>
    Alert.alert(PESAN_HAPUS, undefined, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () =>
          void jalankan(async () => {
            await hapus.mutateAsync(id);
            tutup();
          }),
      },
    ]);

  const simpanTagihan = () => {
    if (!tanggalValid(tgl.trim())) {
      setPesan('Tanggal tidak valid. Pakai format YYYY-MM-DD.');
      return;
    }
    if (nominal === null) {
      setPesan('Nominal tidak valid');
      return;
    }
    void jalankan(async () => {
      await tambah.mutateAsync({ debt_id: id, jatuh_tempo: tgl.trim(), nominal });
      setFormTagihan(false);
      setTgl('');
      setNominal(null);
    });
  };

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 px-5 py-6">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-lg font-bold text-fg font-sans" numberOfLines={1}>
          {h.pemberi}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Tutup</Text>
        </Pressable>
      </View>

      <View className="gap-1">
        <Text className="text-xs text-fg2 font-sans">Sisa pokok</Text>
        <Text className="text-3xl font-bold text-fg font-sans">{formatRupiah(h.sisa_pokok)}</Text>
        <Text className="text-xs text-fg2 font-sans">{info}</Text>
        {berbunga ? <Text className="text-xs text-fg2 font-sans">{`Total bunga dibayar ${formatRupiah(h.total_bunga)}`}</Text> : null}
        {h.diarsip ? <Text className="text-xs text-mid font-sans">Hutang ini diarsipkan.</Text> : null}
      </View>

      {!h.diarsip ? (
        <View className="gap-2">
          <Tombol label="Bayar" primary onPress={() => router.push({ pathname: '/hutang/bayar', params: { id } })} />
          {berbunga ? (
            <Tombol label="Sesuaikan sisa" onPress={() => router.push({ pathname: '/hutang/sesuaikan', params: { id } })} />
          ) : null}
        </View>
      ) : null}

      <Text className="font-semibold text-fg font-sans">Jadwal tagihan</Text>
      {tagihan.length === 0 ? (
        <View className="gap-2">
          <Text className="text-mid font-sans">Belum ada jadwal.</Text>
          {berbunga && !h.diarsip && !formTagihan ? <Tombol label="Tambah tagihan" onPress={() => setFormTagihan(true)} /> : null}
        </View>
      ) : (
        <View className="rounded-2xl border border-line bg-card px-3 py-1">
          {tagihan.map((x) => (
            <BarisTagihan key={x.id} tagihan={x} hariIni={hari} />
          ))}
        </View>
      )}
      {berbunga && !h.diarsip && tagihan.length > 0 && !formTagihan ? (
        <Tombol label="Tambah tagihan" onPress={() => setFormTagihan(true)} />
      ) : null}
      {formTagihan ? (
        <View className="gap-2 rounded-2xl border border-line bg-card p-3">
          <TextInput
            value={tgl}
            onChangeText={setTgl}
            accessibilityLabel="Tanggal jatuh tempo"
            placeholder="YYYY-MM-DD"
            placeholderTextColor={t.mid}
            autoCapitalize="none"
            className="rounded-xl border border-line bg-card px-4 py-3 text-fg font-sans"
          />
          <AmountInput value={null} onChange={setNominal} editable={!busy} testID="nominal-tagihan" />
          <Tombol label="Simpan tagihan" primary busy={busy} disabled={busy} onPress={simpanTagihan} />
          <Tombol label="Batal" onPress={() => setFormTagihan(false)} disabled={busy} />
        </View>
      ) : null}

      <Text className="font-semibold text-fg font-sans">Riwayat pembayaran</Text>
      {txs.length === 0 ? (
        <Text className="text-mid font-sans">Belum ada transaksi.</Text>
      ) : (
        <View className="rounded-2xl border border-line bg-card px-3 py-1">
          {txs.map((tx) => (
            <Pressable
              key={tx.id}
              accessibilityRole="button"
              accessibilityLabel={`Riwayat ${tx.id}`}
              onPress={() => router.push({ pathname: '/transaksi/[id]', params: { id: tx.id } })}
            >
              <TxRow tx={tx} namaDompet={namaDompet} hariIni={hari} />
              {berbunga && tx.jenis === 'hutang_bayar' ? (
                <Text className="-mt-1.5 pb-2 pl-[52px] text-[12.5px] text-fg2 font-sans">
                  {`Bunga ${formatRupiah(tx.porsi_bunga ?? 0)} · Pokok ${formatRupiah(tx.porsi_pokok ?? 0)}`}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      <View className="mt-2 gap-2">
        {h.diarsip ? (
          <Tombol label="Aktifkan lagi" onPress={() => ubahArsip(false)} disabled={busy} />
        ) : (
          <Tombol label="Arsipkan" onPress={() => ubahArsip(true)} disabled={busy} />
        )}
        <Tombol label="Hapus hutang" onPress={konfirmasiHapus} disabled={busy} />
      </View>
      {pesan ? <Text className="text-fg font-sans">{pesan}</Text> : null}
    </ScrollView>
  );
}
