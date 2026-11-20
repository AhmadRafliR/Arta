import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AmountInput } from '@/components/AmountInput';
import { BarisField } from '@/components/BarisField';
import { BarisTagihan } from '@/components/BarisTagihan';
import { DaftarDetail } from '@/components/SheetBawah';
import { TxRow } from '@/components/TxRow';
import {
  BarisAksi,
  JudulSubHutang,
  KELAS_ISIAN,
  KepalaHutang,
  KotakIsian,
  Petunjuk,
  TombolAksi,
} from '@/components/hutang/BagianHutang';
import { labelPersen, labelTanggal, porsiTerbayar } from '@/components/hutang/tampilan';
import { useAuth } from '@/auth/AuthProvider';
import { useDebt, useDebtSchedule, useDeleteDebt, useTambahJadwal, useUpdateDebt } from '@/data/debts';
import { toAppError } from '@/data/errors';
import { useDebtTransactions } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { bungaBulanIni, labelJatuhTempo } from '@/domain/hutang';
import { formatRupiah } from '@/domain/money';
import { hariIni, tanggalValid } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

const PESAN_HAPUS = 'Hapus hutang ini? Semua pembayarannya ikut terhapus dan saldo dompet dihitung ulang.';

// Detail hutang (mockup: lembar detail): kepala + sisa, rincian, jadwal tagihan, aksi Bayar/Hapus, riwayat, arsip.
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
      <View className="flex-1 bg-bg px-[18px] pt-6">
        <Text className="text-mid font-sans">{hutang.error ? hutang.error.pesan : 'Memuat…'}</Text>
      </View>
    );
  }

  const berbunga = h.tipe === 'berbunga';
  const lunas = h.sisa_pokok <= 0;
  const info = berbunga
    ? `Berbunga ${labelPersen(h.bunga_persen_bulanan)}%/bln ${h.metode ?? ''}`.trim()
    : `Cicilan ${formatRupiah(h.nominal_cicilan ?? 0)} × ${h.tenor_bulan ?? 0} bulan`;
  const tagihan = jadwal.data ?? [];
  const jumlahLunas = tagihan.filter((x) => x.status === 'lunas').length;
  const txs = riwayat.data ?? [];
  const namaDompet = (wid: string | null) => wallets.data?.find((w) => w.id === wid)?.nama ?? null;
  const persen = Math.round(porsiTerbayar(h) * 100);
  const jt = h.jatuh_tempo_berikutnya;

  const rincian = [
    { label: 'Pokok awal', nilai: formatRupiah(h.pokok_awal) },
    { label: 'Sudah dibayar', nilai: `${formatRupiah(Math.max(0, h.pokok_awal - h.sisa_pokok))} (${persen}%)` },
    ...(berbunga
      ? [
          { label: 'Bunga', nilai: `${labelPersen(h.bunga_persen_bulanan)}% / bulan (${h.metode ?? 'flat'})` },
          { label: 'Perkiraan bunga bulan ini', nilai: formatRupiah(bungaBulanIni(h, h.sisa_pokok)) },
          { label: 'Total bunga dibayar', nilai: formatRupiah(h.total_bunga) },
        ]
      : [
          { label: 'Cicilan', nilai: `${formatRupiah(h.nominal_cicilan ?? 0)} / bulan` },
          { label: 'Tenor', nilai: `${h.tenor_bulan ?? 0} bulan` },
        ]),
    { label: 'Mulai', nilai: labelTanggal(h.tanggal_mulai) },
    { label: 'Jatuh tempo', nilai: lunas ? 'Lunas' : jt ? `${labelTanggal(jt)} · ${labelJatuhTempo(jt, hari)}` : '—' },
  ];

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

  const tombolTambahTagihan =
    berbunga && !h.diarsip && !formTagihan ? (
      <BarisAksi>
        <TombolAksi label="Tambah tagihan" ikon="ui-plus" onPress={() => setFormTagihan(true)} />
      </BarisAksi>
    ) : null;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-3 px-[18px] pb-8 pt-5" keyboardShouldPersistTaps="handled">
      <KepalaHutang ikon="nav-hutang" judul={h.pemberi} sub={info} nominal={formatRupiah(h.sisa_pokok)} onTutup={tutup} />
      {h.diarsip ? (
        <View className="rounded-[14px] bg-warnbg px-3 py-2">
          <Text className="font-sans text-xs font-semibold text-warnink">Hutang ini diarsipkan.</Text>
        </View>
      ) : null}

      <View className="rounded-[14px] bg-card">
        <DaftarDetail baris={rincian} />
      </View>

      <JudulSubHutang judul="Jadwal tagihan" lencana={tagihan.length > 0 ? `${jumlahLunas}/${tagihan.length} lunas` : undefined} />
      {tagihan.length === 0 ? (
        <View className="rounded-[14px] border border-line bg-card px-3 py-2.5">
          <Text className="font-sans text-[12.5px] font-semibold text-fg">Belum ada jadwal.</Text>
          {berbunga ? (
            <Text className="font-sans text-[11px] text-mid">Tambahkan tagihan bila pemberi memberi tanggal jatuh tempo.</Text>
          ) : null}
        </View>
      ) : (
        <View className="overflow-hidden rounded-[14px] border border-line bg-card">
          {tagihan.map((x, i) => (
            <BarisTagihan key={x.id} tagihan={x} hariIni={hari} pertama={i === 0} />
          ))}
        </View>
      )}
      {tombolTambahTagihan}
      {formTagihan ? (
        <View className="gap-2">
          <KotakIsian>
            <BarisField ikon="status-jatuh-tempo" label="Tanggal jatuh tempo (YYYY-MM-DD)" pertama>
              <TextInput
                value={tgl}
                onChangeText={setTgl}
                accessibilityLabel="Tanggal jatuh tempo"
                placeholder="YYYY-MM-DD"
                placeholderTextColor={t.mid}
                autoCapitalize="none"
                className={`font-sans ${KELAS_ISIAN}`}
              />
            </BarisField>
            <BarisField ikon="ui-money" label="Nominal tagihan">
              <AmountInput value={null} onChange={setNominal} editable={!busy} testID="nominal-tagihan" />
            </BarisField>
          </KotakIsian>
          <BarisAksi>
            <TombolAksi label="Batal" onPress={() => setFormTagihan(false)} disabled={busy} />
            <TombolAksi label="Simpan tagihan" varian="utama" busy={busy} disabled={busy} onPress={simpanTagihan} />
          </BarisAksi>
        </View>
      ) : null}

      <View className="mt-1 gap-2">
        {!h.diarsip ? (
          <BarisAksi>
            <TombolAksi
              label="Bayar"
              ikon="ui-money"
              varian="utama"
              disabled={lunas}
              onPress={() => router.push({ pathname: '/hutang/bayar', params: { id } })}
            />
            <TombolAksi label="Hapus hutang" ikon="act-hapus" varian="bahaya" onPress={konfirmasiHapus} disabled={busy} />
          </BarisAksi>
        ) : (
          <BarisAksi>
            <TombolAksi label="Aktifkan lagi" ikon="ui-check" onPress={() => ubahArsip(false)} disabled={busy} />
            <TombolAksi label="Hapus hutang" ikon="act-hapus" varian="bahaya" onPress={konfirmasiHapus} disabled={busy} />
          </BarisAksi>
        )}
        {!h.diarsip ? (
          <BarisAksi>
            {berbunga ? (
              <TombolAksi
                label="Sesuaikan sisa"
                ikon="act-ubah"
                onPress={() => router.push({ pathname: '/hutang/sesuaikan', params: { id } })}
              />
            ) : null}
            <TombolAksi label="Arsipkan" ikon="ui-archive" onPress={() => ubahArsip(true)} disabled={busy} />
          </BarisAksi>
        ) : null}
      </View>
      {pesan ? <Petunjuk>{pesan}</Petunjuk> : null}

      <JudulSubHutang judul="Riwayat pembayaran" />
      {txs.length === 0 ? (
        <Text className="font-sans text-[12.5px] text-mid">Belum ada transaksi.</Text>
      ) : (
        <View className="rounded-[14px] border border-line bg-card px-3 py-1">
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
    </ScrollView>
  );
}
