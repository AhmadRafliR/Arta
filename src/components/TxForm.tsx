import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AmountInput } from '@/components/AmountInput';
import { Chip } from '@/components/Chip';
import { useAuth } from '@/auth/AuthProvider';
import { useCategories } from '@/data/categories';
import { toAppError, type AppError } from '@/data/errors';
import { useSaveTransactions, type NewTx } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { hariIni, tanggalValid } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

type JenisForm = 'pengeluaran' | 'pemasukan' | 'transfer';

const JENIS: { nilai: JenisForm; label: string }[] = [
  { nilai: 'pengeluaran', label: 'Pengeluaran' },
  { nilai: 'pemasukan', label: 'Pemasukan' },
  { nilai: 'transfer', label: 'Transfer' },
];

function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}

function Label({ children }: { children: string }) {
  return <Text className="mt-2 text-xs font-semibold text-mid">{children}</Text>;
}

type Props = {
  /** Id transaksi; dibuat sekali oleh pemanggil dan dipakai ulang untuk setiap percobaan simpan. */
  txId: string;
  onSaved: () => void;
};

export function TxForm({ txId, onSaved }: Props) {
  const { profile } = useAuth();
  const { t } = useTheme();
  const wallets = useWallets();
  const save = useSaveTransactions();
  const aktif = (wallets.data ?? []).filter((w) => !w.diarsip);

  const [jenis, setJenis] = useState<JenisForm>('pengeluaran');
  const [nominal, setNominal] = useState<number | null>(null);
  const [kategori, setKategori] = useState<string | null>(null);
  const [asalPilih, setAsalPilih] = useState<string | null>(null);
  const [tujuanPilih, setTujuanPilih] = useState<string | null>(null);
  const [tanggal, setTanggal] = useState(() => hariIni(profile?.zona_waktu || undefined));
  const [catatan, setCatatan] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transfer = jenis === 'transfer';
  const kategoriQ = useCategories(jenis === 'pemasukan' ? 'pemasukan' : 'pengeluaran');
  const daftarKategori = transfer ? [] : (kategoriQ.data ?? []);

  const asalId = asalPilih && aktif.some((w) => w.id === asalPilih) ? asalPilih : (aktif[0]?.id ?? null);
  const tujuanOpsi = aktif.filter((w) => w.id !== asalId);
  const tujuanId = tujuanPilih && tujuanOpsi.some((w) => w.id === tujuanPilih) ? tujuanPilih : null;

  const valid =
    nominal !== null &&
    nominal > 0 &&
    asalId !== null &&
    tanggalValid(tanggal) &&
    (transfer ? tujuanId !== null : daftarKategori.length === 0 || kategori !== null);
  const nonaktif = busy || !valid;

  function ubahJenis(j: JenisForm) {
    setJenis(j);
    setKategori(null);
    setError(null);
  }

  async function simpan() {
    if (nonaktif || nominal === null) return;
    const item: NewTx = {
      id: txId,
      tanggal,
      jenis,
      kategori: transfer ? null : kategori,
      nominal,
      wallet_id: asalId,
      wallet_tujuan_id: transfer ? tujuanId : null,
      catatan: catatan.trim() || null,
      transkrip: null,
      sumber: 'manual',
    };
    setBusy(true);
    setError(null);
    try {
      // Hasil kosong ([]) berarti id sudah tersimpan oleh percobaan sebelumnya: tetap sukses.
      await save.mutateAsync([item]);
      onSaved();
    } catch (e) {
      setError(pesanGalat(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-2 px-5 py-4" keyboardShouldPersistTaps="handled">
      <View className="flex-row flex-wrap gap-2">
        {JENIS.map((j) => (
          <Chip key={j.nilai} testID={`jenis-${j.nilai}`} label={j.label} selected={jenis === j.nilai} onPress={() => ubahJenis(j.nilai)} />
        ))}
      </View>

      <Label>Nominal</Label>
      <AmountInput value={null} onChange={setNominal} testID="nominal" />

      {transfer ? null : (
        <>
          <Label>Kategori</Label>
          <View className="flex-row flex-wrap gap-2">
            {daftarKategori.map((k) => (
              <Chip key={k.id} testID={`kat-${k.nama}`} label={k.nama} selected={kategori === k.nama} onPress={() => setKategori(k.nama)} />
            ))}
          </View>
        </>
      )}

      <Label>{transfer ? 'Dari dompet' : 'Dompet'}</Label>
      {aktif.length === 0 ? <Text className="text-mid">Belum ada dompet aktif.</Text> : null}
      <View className="flex-row flex-wrap gap-2">
        {aktif.map((w) => (
          <Chip key={w.id} testID={`src-${w.id}`} label={w.nama} selected={asalId === w.id} onPress={() => setAsalPilih(w.id)} />
        ))}
      </View>

      {transfer ? (
        <>
          <Label>Ke dompet</Label>
          <View className="flex-row flex-wrap gap-2">
            {tujuanOpsi.map((w) => (
              <Chip key={w.id} testID={`dst-${w.id}`} label={w.nama} selected={tujuanId === w.id} onPress={() => setTujuanPilih(w.id)} />
            ))}
          </View>
        </>
      ) : null}

      <Label>Tanggal (YYYY-MM-DD)</Label>
      <TextInput
        testID="tanggal"
        value={tanggal}
        onChangeText={setTanggal}
        autoCapitalize="none"
        placeholderTextColor={t.mid}
        className={`rounded-xl border bg-card px-4 py-3 text-fg ${tanggalValid(tanggal) ? 'border-line' : 'border-fg'}`}
      />
      {tanggalValid(tanggal) ? null : <Text className="text-xs text-fg">Tanggal tidak valid</Text>}

      <Label>Catatan (opsional)</Label>
      <TextInput
        testID="catatan"
        value={catatan}
        onChangeText={setCatatan}
        placeholder="Catatan"
        placeholderTextColor={t.mid}
        className="rounded-xl border border-line bg-card px-4 py-3 text-fg"
      />

      {error ? <Text className="mt-2 text-fg">{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Simpan"
        accessibilityState={{ disabled: nonaktif }}
        disabled={nonaktif}
        onPress={simpan}
        className={`mt-4 items-center rounded-xl bg-acc py-3 ${nonaktif ? 'opacity-50' : ''}`}
      >
        {busy ? (
          <ActivityIndicator color={t.accFg} />
        ) : (
          <Text style={{ color: t.accFg }} className="font-semibold">
            Simpan
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
