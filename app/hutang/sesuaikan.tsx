import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AmountInput } from '@/components/AmountInput';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { useDebt } from '@/data/debts';
import { toAppError, type AppError } from '@/data/errors';
import { newTxId, useSaveTransactions, type NewTx } from '@/data/transactions';
import { formatRupiah } from '@/domain/money';
import type { Hutang } from '@/domain/types';
import { hariIni } from '@/lib/tanggal';

function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}

function FormSesuaikan({ hutang, txId, onSaved }: { hutang: Hutang; txId: string; onSaved: () => void }) {
  const { profile } = useAuth();
  const save = useSaveTransactions();
  const [sisaBaru, setSisaBaru] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sedangSimpan = useRef(false);

  const selisih = sisaBaru === null ? null : hutang.sisa_pokok - sisaBaru;
  const sama = selisih === 0;
  const nonaktif = busy || selisih === null || sama;

  async function simpan() {
    if (nonaktif || sedangSimpan.current || selisih === null) return;
    const item: NewTx = {
      id: txId,
      tanggal: hariIni(profile?.zona_waktu || undefined),
      jenis: 'penyesuaian',
      kategori: 'penyesuaian',
      nominal: selisih,
      wallet_id: null,
      wallet_tujuan_id: null,
      debt_id: hutang.id,
      catatan: 'Sesuaikan sisa hutang',
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
      <Text className="text-mid font-sans">{`${hutang.pemberi} · Sisa pokok tercatat ${formatRupiah(hutang.sisa_pokok)}`}</Text>
      <Text className="mt-2 text-xs font-semibold text-mid font-sans">Sisa pokok sebenarnya</Text>
      <AmountInput value={null} onChange={setSisaBaru} testID="sisa-baru" />
      {sisaBaru !== null ? (
        <Text className="text-xs text-mid font-sans">
          {sama ? 'Sudah sama' : `${formatRupiah(hutang.sisa_pokok)} → ${formatRupiah(sisaBaru)}`}
        </Text>
      ) : null}
      {error ? <Text className="mt-2 text-fg font-sans">{error}</Text> : null}
      <View className="mt-4">
        <Tombol primary label="Simpan" onPress={simpan} disabled={nonaktif} busy={busy} />
      </View>
    </ScrollView>
  );
}

// Modal sesuaikan sisa pokok hutang berbunga (mis. bunga/denda dari pemberi). Tidak menyentuh dompet.
export default function SesuaikanHutang() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const debt = useDebt(id);
  const [txId] = useState(() => newTxId());
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pb-1 pt-4">
        <Text className="text-lg font-bold text-fg font-sans">Sesuaikan sisa hutang</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Batal" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Batal</Text>
        </Pressable>
      </View>
      {debt.data ? (
        <FormSesuaikan hutang={debt.data} txId={txId} onSaved={tutup} />
      ) : (
        <Text className="px-5 py-4 text-mid font-sans">{debt.error ? debt.error.pesan : 'Memuat…'}</Text>
      )}
    </View>
  );
}
