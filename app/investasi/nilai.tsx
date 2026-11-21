import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMomen } from '@/animasi/useMomen';
import { AmountInput } from '@/components/AmountInput';
import { BarJudul } from '@/components/BarJudul';
import { BarisField } from '@/components/BarisField';
import { tipeAset, untungTeks } from '@/components/KartuAset';
import { tanggalInvestasi } from '@/components/RingkasanInvestasi';
import { KepalaSheet } from '@/components/SheetBawah';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { adjustmentFor } from '@/domain/adjust';
import { walletBalances } from '@/domain/balances';
import { ringkasAset } from '@/domain/investasi';
import { formatRupiah } from '@/domain/money';
import { hariIni } from '@/lib/tanggal';
import { pesanDompet } from '@/data/pesan';
import { newTxId, useAllTransactions, useSaveTransactions, type NewTx } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { useTheme } from '@/theme/ThemeProvider';

/** Satu sel kotak hitung (mockup: .calc-item). `nada` mewarnai nilai naik/turun. */
function SelHitung({ label, nilai, nada }: { label: string; nilai: string; nada?: 'naik' | 'turun' }) {
  const { t } = useTheme();
  return (
    <View style={{ width: '50%' }} className="min-w-0 gap-px pr-2">
      <Text className="font-sans text-[10.5px] font-semibold tracking-[0.4px] text-mid">{label}</Text>
      <Text
        style={{
          color: nada === 'naik' ? t.accInk : nada === 'turun' ? t.dangerInk : t.fg,
          fontVariant: ['tabular-nums'],
        }}
        className="font-sans text-[12.5px] font-semibold"
        numberOfLines={1}
      >
        {nilai}
      </Text>
    </View>
  );
}

const bertanda = (n: number) => (n > 0 ? `+${formatRupiah(n)}` : formatRupiah(n));

export default function NilaiInvestasi() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const wallets = useWallets();
  const txs = useAllTransactions();
  const simpanTx = useSaveTransactions();
  const [txId] = useState(() => newTxId()); // sekali per layar dibuka; dipakai ulang saat coba lagi
  const [baru, setBaru] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const sibuk = useRef(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));
  const momen = useMomen();
  const wallet = wallets.data?.find((w) => w.id === id);
  const tanggal = hariIni(profile?.zona_waktu);

  const bungkus = (isi: ReactNode) => (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-3 px-[18px] pb-8"
      contentContainerStyle={{ paddingTop: insets.top + 8 }}
    >
      <BarJudul judul="Update nilai" onKembali={tutup} />
      {isi}
    </ScrollView>
  );

  if (!wallet || !txs.data) {
    return bungkus(
      <Text className="text-mid font-sans">{wallets.error ? pesanDompet(wallets.error) : 'Memuat…'}</Text>,
    );
  }
  const dompet = wallet;

  // Dasar: tanpa penyesuaian kita sendiri (id tetap), agar coba ulang tidak menghitung ganda.
  const lain = txs.data.filter((x) => x.id !== txId);
  const nilai = walletBalances(wallets.data ?? [], lain)[dompet.id] ?? 0;
  const selisih = baru === null ? null : adjustmentFor(nilai, baru);
  const sama = baru !== null && selisih === null;
  const modal = ringkasAset(dompet, nilai, lain).modal;
  const untungBaru = baru === null ? null : baru - modal;
  const beda = baru === null ? null : baru - nilai;
  const perubahan =
    beda === null || nilai <= 0 ? null : `${beda > 0 ? '+' : ''}${(Math.round((beda / nilai) * 1000) / 10).toString().replace('.', ',')}%`;
  const nada = beda === null || beda === 0 ? undefined : beda > 0 ? 'naik' : 'turun';

  async function simpan() {
    if (selisih === null || sibuk.current) return;
    sibuk.current = true;
    setBusy(true);
    setPesan(null);
    try {
      const item: NewTx = {
        id: txId,
        tanggal: hariIni(profile?.zona_waktu),
        jenis: 'penyesuaian',
        kategori: 'penyesuaian',
        nominal: selisih,
        wallet_id: dompet.id,
        wallet_tujuan_id: null,
        catatan: 'Update nilai investasi',
        transkrip: null,
        sumber: 'manual',
      };
      await simpanTx.mutateAsync([item]);
      momen('Nilai investasi tersimpan');
      tutup();
    } catch (e) {
      setPesan(pesanDompet(e));
    } finally {
      sibuk.current = false;
      setBusy(false);
    }
  }

  return bungkus(
    <>
      <View className="rounded-[20px] border border-line bg-card px-4 py-3.5">
        <KepalaSheet
          ikon={tipeAset(dompet.nama).ikon}
          judul={dompet.nama}
          sub={`Nilai sekarang ${formatRupiah(nilai)}`}
        />
      </View>
      <View className="rounded-[14px] border border-line bg-card2 px-3 pt-2.5">
        <BarisField ikon="ui-money" label="Nilai baru" pertama>
          <AmountInput value={null} allowZero onChange={setBaru} editable={!busy} testID="nilai-baru" />
        </BarisField>
        <BarisField ikon="status-jatuh-tempo" label="Tanggal update">
          <Text className="py-0.5 font-sans text-[14.5px] font-semibold text-fg">{tanggalInvestasi(tanggal)}</Text>
        </BarisField>
      </View>
      <View style={{ rowGap: 8 }} className="flex-row flex-wrap rounded-[14px] border border-line bg-card2 px-3 py-2.5">
        <SelHitung label="Nilai sebelumnya" nilai={formatRupiah(nilai)} />
        <SelHitung label="Selisih" nilai={beda === null ? '—' : bertanda(beda)} nada={nada} />
        <SelHitung label="Perubahan" nilai={perubahan ?? '—'} nada={nada} />
        <SelHitung label="Modal awal" nilai={formatRupiah(modal)} />
      </View>
      {untungBaru !== null ? (
        <Text className="font-sans text-[13px] font-semibold text-fg2">{`Untung jadi ${untungTeks(untungBaru, null)}`}</Text>
      ) : null}
      <Text className="font-sans text-[11.5px] text-fg2" style={{ lineHeight: 16.5 }}>
        Selisih nilai dicatat sebagai penyesuaian, modal awal tetap.
      </Text>
      {pesan ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-[11.5px] text-fg">
          {pesan}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Tombol label="Batal" onPress={tutup} disabled={busy} />
        </View>
        <View className="flex-1">
          <Tombol
            label={sama ? 'Nilainya sama' : 'Simpan'}
            primary
            busy={busy}
            disabled={busy || selisih === null}
            onPress={() => void simpan()}
          />
        </View>
      </View>
    </>,
  );
}
