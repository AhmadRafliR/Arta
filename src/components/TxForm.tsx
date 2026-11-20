import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { AmountInput } from '@/components/AmountInput';
import { Chip } from '@/components/Chip';
import { PeringatanBudget } from '@/components/PeringatanBudget';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { useCategories } from '@/data/categories';
import { formatRupiah } from '@/domain/money';
import { toAppError, type AppError } from '@/data/errors';
import { useSaveTransactions, useUpdateTransaction, type NewTx } from '@/data/transactions';
import type { Tx } from '@/domain/types';
import { buatPatch, type NilaiForm } from '@/lib/txPatch';
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
  return <Text className="mt-2 text-xs font-semibold text-mid font-sans">{children}</Text>;
}

type BodyProps = {
  /** Diisi pada mode ubah. */
  initial?: Tx;
  submit: (v: NilaiForm) => Promise<void>;
};

function TxFormBody({ initial, submit }: BodyProps) {
  const { profile } = useAuth();
  const { t } = useTheme();
  const wallets = useWallets();
  const ubah = initial !== undefined;
  // hutang_* dan penyesuaian: jenis/nominal/dompet bergantung pada data lain, hanya tanggal + catatan yang boleh diubah.
  const terkunci = ubah && (initial.jenis.startsWith('hutang_') || initial.jenis === 'penyesuaian');
  // Dompet diarsip tetap tampil bila dipakai transaksi yang diubah, agar tidak berganti diam-diam.
  const aktif = (wallets.data ?? []).filter(
    (w) => !w.diarsip || (ubah && (w.id === initial.wallet_id || w.id === initial.wallet_tujuan_id)),
  );

  const [jenis, setJenis] = useState<JenisForm>(
    ubah && (initial.jenis === 'pemasukan' || initial.jenis === 'transfer') ? initial.jenis : 'pengeluaran',
  );
  const [nominal, setNominal] = useState<number | null>(ubah ? initial.nominal : null);
  const [kategori, setKategori] = useState<string | null>(ubah ? initial.kategori : null);
  const [asalPilih, setAsalPilih] = useState<string | null>(ubah ? initial.wallet_id : null);
  const [tujuanPilih, setTujuanPilih] = useState<string | null>(ubah ? initial.wallet_tujuan_id : null);
  const [tanggal, setTanggal] = useState(() => (ubah ? initial.tanggal : hariIni(profile?.zona_waktu || undefined)));
  const [catatan, setCatatan] = useState(ubah ? (initial.catatan ?? '') : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transfer = jenis === 'transfer';
  const kategoriQ = useCategories(jenis === 'pemasukan' ? 'pemasukan' : 'pengeluaran');
  const daftarKategori = transfer ? [] : (kategoriQ.data ?? []);

  const asalId = asalPilih && aktif.some((w) => w.id === asalPilih) ? asalPilih : (aktif[0]?.id ?? null);
  const tujuanOpsi = aktif.filter((w) => w.id !== asalId);
  const tujuanId = tujuanPilih && tujuanOpsi.some((w) => w.id === tujuanPilih) ? tujuanPilih : null;

  const valid = terkunci
    ? tanggalValid(tanggal)
    : nominal !== null &&
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
    const v: NilaiForm = terkunci
      ? { ...initial, tanggal, catatan: catatan.trim() || null }
      : {
          tanggal,
          jenis,
          kategori: transfer ? null : kategori,
          nominal,
          wallet_id: asalId,
          wallet_tujuan_id: transfer ? tujuanId : null,
          catatan: catatan.trim() || null,
        };
    setBusy(true);
    setError(null);
    try {
      await submit(v);
    } catch (e) {
      setError(pesanGalat(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-2 px-5 py-4" keyboardShouldPersistTaps="handled">
      {terkunci ? (
        <Text className="text-xs text-mid font-sans">
          {initial.jenis.startsWith('hutang_')
            ? 'Transaksi hutang · hanya tanggal dan catatan yang dapat diubah. Ubah hutangnya dari tab Hutang.'
            : `${initial.jenis.replace('_', ' ')} · hanya tanggal dan catatan yang dapat diubah`}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {(terkunci ? [] : JENIS).map((j) => (
          <Chip key={j.nilai} testID={`jenis-${j.nilai}`} label={j.label} selected={jenis === j.nilai} onPress={() => ubahJenis(j.nilai)} />
        ))}
      </View>

      <Label>Nominal</Label>
      {terkunci ? (
        <TextInput testID="nominal" editable={false} value={formatRupiah(initial.nominal)} className="rounded-xl border border-line bg-card px-4 py-3 text-mid font-sans" />
      ) : (
        <AmountInput value={ubah ? initial.nominal : null} onChange={setNominal} testID="nominal" />
      )}

      {transfer || terkunci ? null : (
        <>
          <Label>Kategori</Label>
          <View className="flex-row flex-wrap gap-2">
            {daftarKategori.map((k) => (
              <Chip key={k.id} testID={`kat-${k.nama}`} label={k.nama} selected={kategori === k.nama} onPress={() => setKategori(k.nama)} />
            ))}
          </View>
        </>
      )}

      {terkunci ? (
        <>
          <Label>Dompet</Label>
          <Text className="text-mid font-sans">{(wallets.data ?? []).find((w) => w.id === initial.wallet_id)?.nama ?? '-'}</Text>
        </>
      ) : (
        <Label>{transfer ? 'Dari dompet' : 'Dompet'}</Label>
      )}
      {aktif.length === 0 && !terkunci ? <Text className="text-mid font-sans">Belum ada dompet aktif.</Text> : null}
      <View className="flex-row flex-wrap gap-2">
        {(terkunci ? [] : aktif).map((w) => (
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
        className={`font-sans rounded-xl border bg-card px-4 py-3 text-fg ${tanggalValid(tanggal) ? 'border-line' : 'border-fg'}`}
      />
      {tanggalValid(tanggal) ? null : <Text className="text-xs text-fg font-sans">Tanggal tidak valid</Text>}

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

      {jenis === 'pengeluaran' && nominal !== null && nominal > 0 && tanggalValid(tanggal) ? (
        <PeringatanBudget kategori={kategori} nominal={nominal} tanggal={tanggal} abaikanTxId={ubah ? initial.id : undefined} />
      ) : null}

      <View className="mt-4">
        <Tombol primary label="Simpan" onPress={simpan} disabled={nonaktif} busy={busy} />
      </View>
    </ScrollView>
  );
}

type Props = {
  /** Mode baru: id transaksi, dibuat sekali oleh pemanggil dan dipakai ulang untuk setiap percobaan simpan. */
  txId?: string;
  /** 'ubah' mengisi dari `initial` dan memperbarui baris itu; bawaan 'baru'. */
  mode?: 'baru' | 'ubah';
  initial?: Tx;
  onSaved: () => void;
};

function FormBaru({ txId, onSaved }: { txId: string; onSaved: () => void }) {
  const save = useSaveTransactions();
  const update = useUpdateTransaction();
  async function submit(v: NilaiForm) {
    const item: NewTx = { id: txId, ...v, transkrip: null, sumber: 'manual' };
    const hasil = await save.mutateAsync([item]);
    // Id tidak ada di hasil = sudah tersimpan oleh percobaan sebelumnya (respons hilang). Server menyimpan nilai
    // lama, jadi perbarui ke nilai form saat ini sebelum menutup.
    if (!hasil.some((t) => t.id === txId)) {
      await update.mutateAsync({ id: txId, patch: v });
    }
    onSaved();
  }
  return <TxFormBody submit={submit} />;
}

function FormUbah({ initial, onSaved }: { initial: Tx; onSaved: () => void }) {
  const update = useUpdateTransaction();
  async function submit(v: NilaiForm) {
    const patch = buatPatch(initial, v);
    if (Object.keys(patch).length > 0) await update.mutateAsync({ id: initial.id, patch });
    onSaved();
  }
  return <TxFormBody initial={initial} submit={submit} />;
}

export function TxForm({ txId, mode = 'baru', initial, onSaved }: Props) {
  if (mode === 'ubah' && initial) return <FormUbah initial={initial} onSaved={onSaved} />;
  return <FormBaru txId={txId ?? ''} onSaved={onSaved} />;
}
