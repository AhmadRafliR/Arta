import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMomen } from '@/animasi/useMomen';
import { AmountInput } from '@/components/AmountInput';
import { Chip } from '@/components/Chip';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { formatRupiah } from '@/domain/money';
import { hariIni } from '@/lib/tanggal';
import { pesanDompet } from '@/data/pesan';
import { newTxId, useSaveTransactions, type NewTx } from '@/data/transactions';
import { useSaldoDompet, useWallets } from '@/data/wallets';

type Mode = 'setor' | 'tarik' | 'beli' | 'jual';

const JUDUL: Record<Mode, string> = {
  setor: 'Setor dana darurat',
  tarik: 'Tarik dana darurat',
  beli: 'Beli investasi',
  jual: 'Jual investasi',
};

// Setor/beli: dompet harian -> dompet khusus. Tarik/jual: kebalikannya. Semuanya satu transfer.
export default function PindahDana() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ke, dari, mode } = useLocalSearchParams<{ ke?: string; dari?: string; mode?: string }>();
  const { profile } = useAuth();
  const wallets = useWallets();
  const saldoQ = useSaldoDompet();
  const simpanTx = useSaveTransactions();
  const [txId] = useState(() => newTxId()); // sekali per layar dibuka; dipakai ulang saat coba lagi
  const [nominal, setNominal] = useState<number | null>(null);
  const [pilih, setPilih] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sibuk = useRef(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));
  const momen = useMomen();

  const m = mode as Mode;
  const modeOk = m in JUDUL;
  const judul = modeOk ? JUDUL[m] : 'Pindah dana';
  const masuk = m === 'setor' || m === 'beli'; // dana masuk ke dompet khusus
  const khususId = (masuk ? ke : dari) ?? ke ?? dari;
  const khusus = wallets.data?.find((w) => w.id === khususId && w.tipe !== 'harian' && !w.diarsip);
  const harian = (wallets.data ?? []).filter((w) => w.tipe === 'harian' && !w.diarsip);
  const saldo = wallets.data && saldoQ.data ? saldoQ.data : null;
  const pasangan = harian.find((w) => w.id === pilih) ?? harian[0];

  const bungkus = (isi: ReactNode) => (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-4 px-5 pb-8"
      contentContainerStyle={{ paddingTop: insets.top + 16 }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-fg font-sans">{judul}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Batal" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Batal</Text>
        </Pressable>
      </View>
      {isi}
    </ScrollView>
  );

  if (!modeOk || !khusus) {
    return bungkus(
      <Text className="text-mid font-sans">
        {wallets.error ? pesanDompet(wallets.error) : wallets.data && modeOk ? 'Dompet tidak ditemukan.' : 'Memuat…'}
      </Text>,
    );
  }

  const valid = nominal !== null && nominal > 0 && !!pasangan;

  async function simpan() {
    if (!valid || !pasangan || nominal === null || sibuk.current) return;
    sibuk.current = true;
    setBusy(true);
    setPesan(null);
    try {
      const item: NewTx = {
        id: txId,
        tanggal: hariIni(profile?.zona_waktu),
        jenis: 'transfer',
        kategori: 'transfer',
        nominal,
        wallet_id: masuk ? pasangan.id : khusus!.id,
        wallet_tujuan_id: masuk ? khusus!.id : pasangan.id,
        catatan: `${judul} ${khusus!.nama}`,
        transkrip: null,
        sumber: 'manual',
      };
      await simpanTx.mutateAsync([item]);
      momen('Dana dipindahkan');
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
      <Text className="text-fg2 font-sans">
        {`${khusus.nama}${saldo ? ` · ${formatRupiah(saldo[khusus.id] ?? 0)}` : ''}`}
      </Text>
      <Text className="text-mid font-sans">{masuk ? 'Dari dompet' : 'Ke dompet'}</Text>
      {harian.length === 0 ? (
        <Text className="text-fg font-sans">Belum ada dompet harian.</Text>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            {harian.map((w) => (
              <Chip key={w.id} label={w.nama} selected={pasangan?.id === w.id} onPress={() => setPilih(w.id)} />
            ))}
          </View>
          {pasangan && saldo ? (
            <Text className="text-[13px] text-mid font-sans">{`Saldo ${pasangan.nama}: ${formatRupiah(saldo[pasangan.id] ?? 0)}`}</Text>
          ) : null}
        </>
      )}
      <Text className="text-mid font-sans">Nominal</Text>
      <AmountInput value={null} onChange={setNominal} editable={!busy} testID="nominal" />
      <Tombol label="Simpan" primary busy={busy} disabled={!valid || busy} onPress={() => void simpan()} />
      {pesan ? <Text className="text-fg font-sans">{pesan}</Text> : null}
    </>,
  );
}
