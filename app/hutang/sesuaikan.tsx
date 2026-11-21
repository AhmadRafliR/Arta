import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMomen } from '@/animasi/useMomen';
import { AmountInput } from '@/components/AmountInput';
import { BarisField } from '@/components/BarisField';
import {
  BarisAksi,
  CatatanKecil,
  KepalaHutang,
  KotakHitung,
  KotakIsian,
  Petunjuk,
  TombolAksi,
} from '@/components/hutang/BagianHutang';
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

function FormSesuaikan({
  hutang,
  txId,
  onSaved,
  onBatal,
}: {
  hutang: Hutang;
  txId: string;
  onSaved: () => void;
  onBatal: () => void;
}) {
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

  // Selisih positif = sisa turun; negatif = sisa naik (mis. bunga/denda dari pemberi).
  const labelSelisih =
    selisih === null || sama ? '—' : selisih > 0 ? `Turun ${formatRupiah(selisih)}` : `Naik ${formatRupiah(-selisih)}`;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-3 px-[18px] pb-8 pt-1" keyboardShouldPersistTaps="handled">
      <KotakIsian>
        <BarisField ikon="ui-money" label="Sisa pokok sebenarnya" pertama>
          <AmountInput value={null} onChange={setSisaBaru} testID="sisa-baru" />
        </BarisField>
      </KotakIsian>
      <KotakHitung
        item={[
          { label: 'Sisa tercatat', nilai: formatRupiah(hutang.sisa_pokok) },
          { label: 'Selisih', nilai: labelSelisih, masuk: true },
        ]}
      />
      {sisaBaru !== null ? (
        <Petunjuk ok>{sama ? 'Sudah sama' : `${formatRupiah(hutang.sisa_pokok)} → ${formatRupiah(sisaBaru)}`}</Petunjuk>
      ) : null}
      <CatatanKecil>
        Pakai ini bila sisa dari pemberi berbeda dengan catatan (mis. bunga atau denda). Saldo dompet tidak berubah.
      </CatatanKecil>
      {error ? <Petunjuk>{error}</Petunjuk> : null}
      <View className="mt-1">
        <BarisAksi>
          <TombolAksi label="Batal" onPress={onBatal} />
          <TombolAksi label="Simpan" varian="utama" onPress={simpan} disabled={nonaktif} busy={busy} />
        </BarisAksi>
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
  const momen = useMomen();
  const selesai = () => {
    momen('Penyesuaian tersimpan');
    tutup();
  };
  const h = debt.data;
  return (
    <View className="flex-1 bg-bg">
      <View className="px-[18px] pb-3 pt-5">
        <KepalaHutang
          ikon="act-ubah"
          judul="Sesuaikan sisa hutang"
          sub={h ? `${h.pemberi} · tercatat ${formatRupiah(h.sisa_pokok)}` : undefined}
          onTutup={tutup}
        />
      </View>
      {h ? (
        <FormSesuaikan hutang={h} txId={txId} onSaved={selesai} onBatal={tutup} />
      ) : (
        <Text className="px-[18px] py-4 text-mid font-sans">{debt.error ? debt.error.pesan : 'Memuat…'}</Text>
      )}
    </View>
  );
}
