import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AmountInput } from '@/components/AmountInput';
import { BarisField } from '@/components/BarisField';
import { KartuSeksi, LabelSub } from '@/components/KartuSeksi';
import { DaftarDetail, KepalaSheet } from '@/components/SheetBawah';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { adjustmentFor, canArchive } from '@/domain/adjust';
import { walletBalances } from '@/domain/balances';
import { formatRupiah } from '@/domain/money';
import { hariIni } from '@/lib/tanggal';
import { pesanDompet } from '@/data/pesan';
import { newTxId, useAllTransactions, useSaveTransactions, useUpdateTransaction, type NewTx } from '@/data/transactions';
import { useUpdateWallet, useWallets } from '@/data/wallets';
import type { TipeDompet } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

export const PESAN_ARSIP = 'Pindahkan dulu saldonya ke dompet lain';
export const PESAN_SAMA = 'Saldo sudah sama';

const LABEL_TIPE: Record<TipeDompet, { label: string; ikon: NamaIkon }> = {
  harian: { label: 'Harian', ikon: 'wallet-harian' },
  darurat: { label: 'Dana darurat', ikon: 'ui-shield' },
  investasi: { label: 'Investasi', ikon: 'wallet-investasi' },
};

// Detail dompet (mockup akun: sheet dompet): ubah nama, sesuaikan saldo, arsipkan. Tidak ada hapus (FK ke transaksi).
export default function DetailDompet() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { t } = useTheme();
  const wallets = useWallets();
  const txs = useAllTransactions();
  const update = useUpdateWallet();
  const simpanTx = useSaveTransactions();
  const ubahTx = useUpdateTransaction();
  const [txId] = useState(() => newTxId()); // sekali per layar dibuka; dipakai ulang saat coba lagi
  const [nama, setNama] = useState<string | null>(null);
  const [saldoBaru, setSaldoBaru] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));
  const wallet = wallets.data?.find((w) => w.id === id);

  if (!wallet) {
    return (
      <View className="flex-1 bg-bg px-[18px] pt-6">
        <Text className="text-mid font-sans">{wallets.error ? pesanDompet(wallets.error) : 'Memuat…'}</Text>
      </View>
    );
  }

  const saldo = txs.data ? (walletBalances(wallets.data ?? [], txs.data)[wallet.id] ?? 0) : null;
  // Dasar penyesuaian: saldo tanpa penyesuaian kita sendiri (id tetap), agar coba-ulang tidak menghitung ganda.
  const saldoDasar = txs.data
    ? (walletBalances(wallets.data ?? [], txs.data.filter((x) => x.id !== txId))[wallet.id] ?? 0)
    : null;
  const namaIsi = nama ?? wallet.nama;
  const namaOk = namaIsi.trim() !== '' && namaIsi.trim() !== wallet.nama;

  async function jalankan(fn: () => Promise<void>, namaUnik = false) {
    setBusy(true);
    setPesan(null);
    try {
      await fn();
    } catch (e) {
      setPesan(pesanDompet(e, { namaUnik }));
    } finally {
      setBusy(false);
    }
  }

  const simpanNama = () =>
    jalankan(async () => {
      await update.mutateAsync({ id: wallet.id, patch: { nama: namaIsi.trim() } });
      setNama(null);
    }, true);

  const sesuaikan = () => {
    if (saldoDasar === null || saldoBaru === null) return;
    const selisih = adjustmentFor(saldoDasar, saldoBaru);
    if (selisih === null) {
      setPesan(PESAN_SAMA);
      return;
    }
    void jalankan(async () => {
      const item: NewTx = {
        id: txId,
        tanggal: hariIni(profile?.zona_waktu),
        jenis: 'penyesuaian',
        kategori: 'penyesuaian',
        nominal: selisih,
        wallet_id: wallet.id,
        wallet_tujuan_id: null,
        catatan: 'Penyesuaian saldo',
        transkrip: null,
        sumber: 'manual',
      };
      const hasil = await simpanTx.mutateAsync([item]);
      if (!hasil.some((x) => x.id === txId)) {
        // Id sudah ada dari percobaan sebelumnya (respons hilang): server menyimpan nilai lama, jadi
        // perbarui ke nominal yang baru dikonfirmasi pengguna.
        const { id: _id, sumber: _sumber, ...patch } = item;
        await ubahTx.mutateAsync({ id: txId, patch });
      }
      tutup();
    });
  };

  const ubahArsip = (diarsip: boolean) => {
    if (diarsip && (saldo === null || !canArchive(saldo))) {
      setPesan(PESAN_ARSIP);
      return;
    }
    void jalankan(async () => {
      await update.mutateAsync({ id: wallet.id, patch: { diarsip } });
      tutup();
    });
  };

  const tipe = LABEL_TIPE[wallet.tipe];
  const persenTarget =
    wallet.tipe === 'darurat' && wallet.target && saldo !== null ? Math.floor((saldo * 100) / wallet.target) : null;
  const rincian = [
    { label: 'Tipe', nilai: tipe.label },
    { label: 'Saldo sekarang', nilai: saldo === null ? '…' : formatRupiah(saldo) },
    ...(wallet.tipe === 'darurat' && wallet.target
      ? [{ label: 'Target', nilai: `${formatRupiah(wallet.target)}${persenTarget !== null ? ` (${persenTarget}%)` : ''}` }]
      : []),
    { label: 'Status', nilai: wallet.diarsip ? 'Diarsipkan' : 'Aktif' },
  ];
  // Pratinjau selisih penyesuaian (mockup: .calc-box).
  const selisih = saldoDasar !== null && saldoBaru !== null ? saldoBaru - saldoDasar : null;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-3 px-[18px] py-5"
      keyboardShouldPersistTaps="handled"
    >
      {/* Kepala (mockup: .sheet-head): ikon tipe, nama, tipe/target, saldo; tombol tutup bulat. */}
      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <KepalaSheet
            ikon={tipe.ikon}
            judul={wallet.nama}
            sub={`${tipe.label}${wallet.tipe === 'darurat' && wallet.target ? ` · target ${formatRupiah(wallet.target)}` : ''}`}
            kanan={saldo === null ? '…' : formatRupiah(saldo)}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tutup"
          onPress={tutup}
          style={{ width: 38, height: 38 }}
          className="items-center justify-center rounded-full border border-line bg-card"
        >
          <Ikon nama="ui-close" ukuran={18} warna={t.fg} />
        </Pressable>
      </View>
      {wallet.diarsip ? (
        <View className="flex-row items-center gap-2 rounded-[14px] bg-warnbg px-3 py-2.5">
          <Ikon nama="ui-archive" ukuran={16} warna={t.warnInk} />
          <Text style={{ color: t.warnInk }} className="flex-1 font-sans text-[12.5px] font-semibold">
            Dompet ini diarsipkan.
          </Text>
        </View>
      ) : null}

      <DaftarDetail baris={rincian} />

      {/* Sesuaikan saldo (mockup: adjustView). */}
      <KartuSeksi judul="Sesuaikan saldo">
        <LabelSub>Saldo sebenarnya saat ini</LabelSub>
        <AmountInput value={null} allowZero onChange={setSaldoBaru} editable={!busy} testID="saldo-baru" />
        <View className="mt-3 rounded-[14px] border border-line bg-card2 px-3 pt-2.5">
          <BarisField ikon="status-jatuh-tempo" label="Tanggal penyesuaian" pertama>
            <Text className="font-sans text-[14.5px] font-semibold text-fg">{hariIni(profile?.zona_waktu)}</Text>
          </BarisField>
        </View>
        <View className="mt-3 flex-row gap-2 rounded-[14px] border border-line bg-card2 px-3 py-2.5">
          <View className="min-w-0 flex-1 gap-px">
            <Text className="font-sans text-[10.5px] font-semibold tracking-[0.4px] text-mid">Saldo lama</Text>
            <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[12.5px] font-semibold text-fg" numberOfLines={1}>
              {saldo === null ? '…' : formatRupiah(saldo)}
            </Text>
          </View>
          <View className="min-w-0 flex-1 gap-px">
            <Text className="font-sans text-[10.5px] font-semibold tracking-[0.4px] text-mid">Selisih</Text>
            <Text
              style={{ fontVariant: ['tabular-nums'], color: selisih !== null && selisih < 0 ? t.dangerInk : t.accInk }}
              className="font-sans text-[12.5px] font-semibold"
              numberOfLines={1}
            >
              {selisih === null || selisih === 0 ? '—' : `${selisih > 0 ? '+' : ''}${formatRupiah(selisih)}`}
            </Text>
          </View>
        </View>
        <Text className="mb-3 mt-3 font-sans text-[11.5px] leading-[17px] text-fg2">
          Selisih dicatat sebagai transaksi penyesuaian, jadi riwayat tetap utuh.
        </Text>
        <Tombol
          label="Simpan penyesuaian"
          primary
          busy={busy}
          onPress={sesuaikan}
          disabled={busy || saldo === null || saldoBaru === null}
        />
      </KartuSeksi>

      {/* Ubah nama (mockup: renameView). */}
      <KartuSeksi judul="Ubah nama">
        <View className="mb-3 mt-3 rounded-[14px] border border-line bg-card2 px-3">
          <BarisField ikon="wallet-harian" label="Nama dompet" pertama>
            <TextInput
              value={namaIsi}
              onChangeText={setNama}
              accessibilityLabel="Nama dompet"
              placeholder="Nama dompet"
              placeholderTextColor={t.mid}
              maxLength={24}
              className="py-0.5 font-sans text-[14.5px] font-semibold text-fg"
            />
          </BarisField>
        </View>
        <Tombol label="Simpan nama" onPress={() => void simpanNama()} disabled={busy || !namaOk} />
      </KartuSeksi>

      {wallet.diarsip ? (
        <Tombol label="Aktifkan kembali" onPress={() => ubahArsip(false)} disabled={busy} />
      ) : (
        <Tombol label="Arsipkan" bahaya onPress={() => ubahArsip(true)} disabled={busy} />
      )}
      {pesan ? (
        <Text accessibilityLiveRegion="polite" style={{ color: t.dangerInk }} className="font-sans text-[12.5px]">
          {pesan}
        </Text>
      ) : null}
    </ScrollView>
  );
}
