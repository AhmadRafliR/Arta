import { useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AmountInput } from '@/components/AmountInput';
import { BarisField } from '@/components/BarisField';
import { Chip } from '@/components/Chip';
import {
  BarisAksi,
  KELAS_ISIAN,
  KepalaHutang,
  KotakHitung,
  KotakIsian,
  Petunjuk,
  TombolAksi,
} from '@/components/hutang/BagianHutang';
import { useAuth } from '@/auth/AuthProvider';
import { useDebt } from '@/data/debts';
import { toAppError, type AppError } from '@/data/errors';
import { newTxId, useDebtTransactions, useSaveTransactions, type NewTx } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { bungaBulanIni, pecahPembayaran } from '@/domain/hutang';
import { formatRupiah } from '@/domain/money';
import type { Hutang } from '@/domain/types';
import { hariIni, tanggalValid } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}

function FormBayar({
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

  // Kotak hitung (mockup: #payCalc). Cicilan: tanpa bunga, cukup sisa sebelum/sesudah.
  const sisaSetelah = pecah && !lebih ? formatRupiah(Math.max(0, hutang.sisa_pokok - pecah.pokok)) : '—';
  const hitung = berbunga
    ? [
        { label: 'Porsi bunga', nilai: pecah && !lebih ? formatRupiah(pecah.bunga) : '—', testID: 'porsi-bunga' },
        { label: 'Porsi pokok', nilai: pecah && !lebih ? formatRupiah(pecah.pokok) : '—', masuk: true, testID: 'porsi-pokok' },
        { label: 'Sisa setelah bayar', nilai: sisaSetelah, testID: 'sisa-setelah' },
        {
          label: 'Bunga bulan ini',
          nilai: sudahBayarBulanIni ? 'Sudah dibayar' : formatRupiah(bungaBulanIni(hutang, hutang.sisa_pokok)),
        },
      ]
    : [
        { label: 'Sisa sekarang', nilai: formatRupiah(hutang.sisa_pokok) },
        { label: 'Sisa setelah bayar', nilai: sisaSetelah, masuk: true, testID: 'sisa-setelah' },
      ];

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-3 px-[18px] pb-8 pt-1" keyboardShouldPersistTaps="handled">
      <KotakIsian>
        <BarisField ikon="ui-money" label="Nominal bayar" pertama>
          <AmountInput value={hutang.nominal_berikutnya ?? null} onChange={setNominal} testID="nominal" />
        </BarisField>
        <BarisField ikon="status-jatuh-tempo" label="Tanggal bayar (YYYY-MM-DD)">
          <TextInput
            testID="tanggal"
            value={tanggal}
            onChangeText={setTanggal}
            autoCapitalize="none"
            placeholderTextColor={t.mid}
            className={KELAS_ISIAN}
          />
          {tglOk ? null : <Petunjuk>Tanggal tidak valid</Petunjuk>}
        </BarisField>
        <BarisField ikon="wallet-harian" label="Bayar dari dompet">
          {aktif.length === 0 ? <Text className="font-sans text-[12.5px] text-mid">Belum ada dompet aktif.</Text> : null}
          <View className="mt-0.5 flex-row flex-wrap gap-[7px]">
            {aktif.map((w) => (
              <Chip
                key={w.id}
                testID={`dompet-${w.id}`}
                label={w.nama}
                ikon="wallet-harian"
                selected={dompet === w.id}
                onPress={() => setDompet(w.id)}
              />
            ))}
          </View>
        </BarisField>
        <BarisField ikon="ui-note" label="Catatan (opsional)">
          <TextInput
            testID="catatan"
            value={catatan}
            onChangeText={setCatatan}
            placeholder="Catatan"
            placeholderTextColor={t.mid}
            className={KELAS_ISIAN}
          />
        </BarisField>
      </KotakIsian>

      <KotakHitung item={hitung} />
      {lebih ? <Petunjuk>{`Melebihi sisa hutang (${formatRupiah(hutang.sisa_pokok)})`}</Petunjuk> : null}
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

// Modal bayar hutang. Id transaksi dibuat sekali saat layar dibuka, dipakai ulang di setiap percobaan simpan.
export default function BayarHutang() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const debt = useDebt(id);
  const [txId] = useState(() => newTxId());
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const h = debt.data;
  return (
    <View className="flex-1 bg-bg">
      <View className="px-[18px] pb-3 pt-5">
        <KepalaHutang
          ikon="ui-money"
          judul="Bayar hutang"
          sub={h ? `${h.pemberi} · sisa ${formatRupiah(h.sisa_pokok)}` : undefined}
          onTutup={tutup}
        />
      </View>
      {h ? (
        <FormBayar hutang={h} txId={txId} onSaved={tutup} onBatal={tutup} />
      ) : (
        <Text className="px-[18px] py-4 text-mid font-sans">{debt.error ? debt.error.pesan : 'Memuat…'}</Text>
      )}
    </View>
  );
}
