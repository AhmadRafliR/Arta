import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AmountInput } from '@/components/AmountInput';
import { Chip } from '@/components/Chip';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { useDebt } from '@/data/debts';
import { toAppError, type AppError } from '@/data/errors';
import { newTxId, useDebtTransactions, useSaveTransactions, type NewTx } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { pecahPembayaran } from '@/domain/hutang';
import { formatRupiah } from '@/domain/money';
import type { Hutang } from '@/domain/types';
import { hariIni, tanggalValid } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}

function Label({ children }: { children: string }) {
  return <Text className="mt-2 text-xs font-semibold text-mid font-sans">{children}</Text>;
}

function FormBayar({ hutang, txId, onSaved }: { hutang: Hutang; txId: string; onSaved: () => void }) {
  const { profile } = useAuth();
  const { t } = useTheme();
  const save = useSaveTransactions();
  const wallets = useWallets();
  const txs = useDebtTransactions(hutang.id);
  const aktif = (wallets.data ?? []).filter((w) => !w.diarsip);

  const [nominal, setNominal] = useState<number | null>(hutang.nominal_berikutnya ?? null);
  const [dompet, setDompet] = useState<string | null>(null);
  const [tanggal, setTanggal] = useState(() => hariIni(profile?.zona_waktu || undefined));
  const [catatan, setCatatan] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sedangSimpan = useRef(false);

  const berbunga = hutang.tipe === 'berbunga';
  const tglOk = tanggalValid(tanggal);
  const sudahBayarBulanIni =
    tglOk && (txs.data ?? []).some((x) => x.jenis === 'hutang_bayar' && x.tanggal.slice(0, 7) === tanggal.slice(0, 7));
  const pecah = nominal !== null && nominal > 0 ? pecahPembayaran(hutang, nominal, sudahBayarBulanIni) : null;
  const lebih = pecah?.lebih ?? false;
  const valid = nominal !== null && nominal > 0 && dompet !== null && tglOk && !lebih;
  const nonaktif = busy || !valid;

  async function simpan() {
    if (nonaktif || sedangSimpan.current || nominal === null) return;
    const item: NewTx = {
      id: txId,
      tanggal,
      jenis: 'hutang_bayar',
      kategori: hutang.pemberi,
      nominal,
      wallet_id: dompet,
      wallet_tujuan_id: null,
      debt_id: hutang.id,
      catatan: catatan.trim() || null,
      transkrip: null,
      sumber: 'manual',
    };
    sedangSimpan.current = true;
    setBusy(true);
    setError(null);
    try {
      await save.mutateAsync([item]);
      onSaved();
    } catch (e) {
      setError(pesanGalat(e));
    } finally {
      sedangSimpan.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-2 px-5 py-4" keyboardShouldPersistTaps="handled">
      <Text className="text-mid font-sans">{`${hutang.pemberi} · Sisa ${formatRupiah(hutang.sisa_pokok)}`}</Text>

      <Label>Nominal</Label>
      <AmountInput value={hutang.nominal_berikutnya ?? null} onChange={setNominal} testID="nominal" />
      {berbunga && pecah && !lebih ? (
        <Text className="text-xs text-mid font-sans">{`Bunga ${formatRupiah(pecah.bunga)} · Pokok ${formatRupiah(pecah.pokok)}`}</Text>
      ) : null}
      {lebih ? <Text className="text-xs text-fg font-sans">{`Melebihi sisa hutang (${formatRupiah(hutang.sisa_pokok)})`}</Text> : null}

      <Label>Dompet</Label>
      {aktif.length === 0 ? <Text className="text-mid font-sans">Belum ada dompet aktif.</Text> : null}
      <View className="flex-row flex-wrap gap-2">
        {aktif.map((w) => (
          <Chip key={w.id} testID={`dompet-${w.id}`} label={w.nama} selected={dompet === w.id} onPress={() => setDompet(w.id)} />
        ))}
      </View>

      <Label>Tanggal (YYYY-MM-DD)</Label>
      <TextInput
        testID="tanggal"
        value={tanggal}
        onChangeText={setTanggal}
        autoCapitalize="none"
        placeholderTextColor={t.mid}
        className={`font-sans rounded-xl border bg-card px-4 py-3 text-fg ${tglOk ? 'border-line' : 'border-fg'}`}
      />
      {tglOk ? null : <Text className="text-xs text-fg font-sans">Tanggal tidak valid</Text>}

      <Label>Catatan (opsional)</Label>
      <TextInput
        testID="catatan"
        value={catatan}
        onChangeText={setCatatan}
        placeholder="Catatan"
        placeholderTextColor={t.mid}
        className="rounded-xl border border-line bg-card px-4 py-3 text-fg font-sans"
      />

      {error ? <Text className="mt-2 text-fg font-sans">{error}</Text> : null}

      <View className="mt-4">
        <Tombol primary label="Simpan" onPress={simpan} disabled={nonaktif} busy={busy} />
      </View>
    </ScrollView>
  );
}

// Modal bayar hutang. Id transaksi dibuat sekali saat layar dibuka, dipakai ulang di setiap percobaan simpan.
export default function BayarHutang() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const debt = useDebt(id);
  const [txId] = useState(() => newTxId());
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pb-1 pt-4">
        <Text className="text-lg font-bold text-fg font-sans">Bayar hutang</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Batal" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Batal</Text>
        </Pressable>
      </View>
      {debt.data ? (
        <FormBayar hutang={debt.data} txId={txId} onSaved={tutup} />
      ) : (
        <Text className="px-5 py-4 text-mid font-sans">{debt.error ? debt.error.pesan : 'Memuat…'}</Text>
      )}
    </View>
  );
}
