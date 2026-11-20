import { useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { AmountInput } from '@/components/AmountInput';
import { Chip } from '@/components/Chip';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { toAppError, type AppError } from '@/data/errors';
import { useSaveTransactions, type HutangBaru, type NewTx } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { formatRupiah } from '@/domain/money';
import type { MetodeBunga, TipeHutang } from '@/domain/types';
import { geserBulan, hariIni, tanggalValid } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}

function Label({ children }: { children: string }) {
  return <Text className="mt-2 text-xs font-semibold text-mid font-sans">{children}</Text>;
}

/** Bunga %/bulan; koma atau titik, maks 2 desimal, 0-100. Null = tidak valid. */
export function parseBunga(teks: string): number | null {
  const s = teks.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 100 ? n : null;
}

/** Tanggal yang sama bulan depan; hari dipotong ke akhir bulan bila perlu. */
function bulanDepan(tanggal: string): string {
  const bulan = geserBulan(tanggal.slice(0, 7), 1);
  for (let d = Number(tanggal.slice(8, 10)); d >= 28; d--) {
    const t = `${bulan}-${String(d).padStart(2, '0')}`;
    if (tanggalValid(t)) return t;
  }
  return `${bulan}-28`;
}

type Props = {
  /** Id transaksi dan id hutang: dibuat sekali oleh pemanggil, dipakai ulang di setiap percobaan simpan. */
  txId: string;
  debtId: string;
  onSaved: (debtId: string) => void;
};

export function FormHutang({ txId, debtId, onSaved }: Props) {
  const { profile } = useAuth();
  const { t } = useTheme();
  const save = useSaveTransactions();
  const wallets = useWallets();
  const aktif = (wallets.data ?? []).filter((w) => !w.diarsip);
  const zona = profile?.zona_waktu || undefined;

  const [pemberi, setPemberi] = useState('');
  const [tipe, setTipe] = useState<TipeHutang>('cicilan_tetap');
  const [nominalCicilan, setNominalCicilan] = useState<number | null>(null);
  const [tenorTeks, setTenorTeks] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState(() => bulanDepan(hariIni(zona)));
  const [pokokAwal, setPokokAwal] = useState<number | null>(null);
  const [bungaTeks, setBungaTeks] = useState('');
  const [metode, setMetode] = useState<MetodeBunga>('efektif');
  const [berjalan, setBerjalan] = useState(false);
  const [sisaPokok, setSisaPokok] = useState<number | null>(null);
  // undefined = belum dipilih; null = "Tidak masuk dompet".
  const [dompetPilih, setDompetPilih] = useState<string | null | undefined>(undefined);
  const [danaDisentuh, setDanaDisentuh] = useState(false);
  const [danaNilai, setDanaNilai] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState(() => hariIni(zona));
  const [catatan, setCatatan] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sedangSimpan = useRef(false);

  const cicilan = tipe === 'cicilan_tetap';
  const tenor = /^\d+$/.test(tenorTeks.trim()) ? Number(tenorTeks.trim()) : null;
  const tenorOk = tenor !== null && tenor >= 1 && tenor <= 60;
  const total = cicilan && nominalCicilan !== null && tenorOk ? nominalCicilan * tenor : null;
  const bunga = parseBunga(bungaTeks);

  const dompet = dompetPilih === undefined ? (cicilan ? null : undefined) : dompetPilih;
  const danaBawaan = cicilan ? total : pokokAwal;
  const dana = danaDisentuh ? danaNilai : danaBawaan;
  const sisaLebih = !cicilan && berjalan && pokokAwal !== null && sisaPokok !== null && sisaPokok > pokokAwal;

  const valid =
    pemberi.trim().length > 0 &&
    tanggalValid(tanggal) &&
    dompet !== undefined &&
    dana !== null &&
    dana > 0 &&
    (cicilan
      ? nominalCicilan !== null && nominalCicilan > 0 && tenorOk && tanggalValid(jatuhTempo)
      : pokokAwal !== null && pokokAwal > 0 && bunga !== null && (!berjalan || (sisaPokok !== null && !sisaLebih)));
  const nonaktif = busy || !valid;

  function ubahTipe(baru: TipeHutang) {
    if (baru === tipe) return;
    setTipe(baru);
    setNominalCicilan(null);
    setPokokAwal(null);
    setSisaPokok(null);
    setBerjalan(false);
    setDompetPilih(undefined);
    setDanaDisentuh(false);
    setDanaNilai(null);
    setError(null);
  }

  async function simpan() {
    if (nonaktif || sedangSimpan.current || dana === null) return;
    const hutang: HutangBaru = cicilan
      ? {
          pemberi: pemberi.trim(),
          tipe,
          tanggal_mulai: tanggal,
          nominal_cicilan: nominalCicilan ?? undefined,
          tenor_bulan: tenor ?? undefined,
          jatuh_tempo_pertama: jatuhTempo,
        }
      : {
          pemberi: pemberi.trim(),
          tipe,
          tanggal_mulai: tanggal,
          pokok_awal: pokokAwal ?? undefined,
          bunga_persen_bulanan: bunga ?? undefined,
          metode,
          ...(berjalan && sisaPokok !== null ? { sisa_pokok_sekarang: sisaPokok } : {}),
        };
    const item: NewTx = {
      id: txId,
      tanggal,
      jenis: 'hutang_baru',
      kategori: pemberi.trim(),
      nominal: dana,
      wallet_id: dompet ?? null,
      wallet_tujuan_id: null,
      debt_id: debtId,
      hutang,
      catatan: catatan.trim() || null,
      transkrip: null,
      sumber: 'manual',
    };
    sedangSimpan.current = true;
    setBusy(true);
    setError(null);
    try {
      await save.mutateAsync([item]);
      onSaved(debtId);
    } catch (e) {
      setError(pesanGalat(e));
    } finally {
      sedangSimpan.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-2 px-5 py-4" keyboardShouldPersistTaps="handled">
      <Label>Pemberi</Label>
      <TextInput
        testID="pemberi"
        value={pemberi}
        onChangeText={setPemberi}
        maxLength={60}
        placeholder="Mis. Kredivo, Shopee PayLater"
        placeholderTextColor={t.mid}
        className="rounded-xl border border-line bg-card px-4 py-3 text-fg font-sans"
      />

      <Label>Jenis hutang</Label>
      <View className="flex-row flex-wrap gap-2">
        <Chip testID="tipe-cicilan" label="Cicilan tetap" selected={cicilan} onPress={() => ubahTipe('cicilan_tetap')} />
        <Chip testID="tipe-berbunga" label="Berbunga" selected={!cicilan} onPress={() => ubahTipe('berbunga')} />
      </View>

      {cicilan ? (
        <>
          <Label>Nominal cicilan per bulan</Label>
          <AmountInput value={null} onChange={setNominalCicilan} testID="nominal-cicilan" />
          <Label>Sisa tenor (bulan, 1-60)</Label>
          <TextInput
            testID="tenor"
            value={tenorTeks}
            onChangeText={setTenorTeks}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="12"
            placeholderTextColor={t.mid}
            className={`font-sans rounded-xl border bg-card px-4 py-3 text-fg ${tenorTeks === '' || tenorOk ? 'border-line' : 'border-fg'}`}
          />
          {total !== null ? <Text className="text-xs text-mid font-sans">{`Total ${formatRupiah(total)}`}</Text> : null}
          <Label>Jatuh tempo berikutnya (YYYY-MM-DD)</Label>
          <TextInput
            testID="jatuh-tempo"
            value={jatuhTempo}
            onChangeText={setJatuhTempo}
            autoCapitalize="none"
            placeholderTextColor={t.mid}
            className={`font-sans rounded-xl border bg-card px-4 py-3 text-fg ${tanggalValid(jatuhTempo) ? 'border-line' : 'border-fg'}`}
          />
          {tanggalValid(jatuhTempo) ? null : <Text className="text-xs text-fg font-sans">Tanggal tidak valid</Text>}
        </>
      ) : (
        <>
          <Label>Pokok awal</Label>
          <AmountInput value={null} onChange={setPokokAwal} testID="pokok-awal" />
          <Label>Bunga per bulan (%)</Label>
          <TextInput
            testID="bunga"
            value={bungaTeks}
            onChangeText={setBungaTeks}
            keyboardType="decimal-pad"
            placeholder="2,5"
            placeholderTextColor={t.mid}
            className={`font-sans rounded-xl border bg-card px-4 py-3 text-fg ${bungaTeks === '' || bunga !== null ? 'border-line' : 'border-fg'}`}
          />
          {bungaTeks === '' || bunga !== null ? null : <Text className="text-xs text-fg font-sans">Bunga 0–100% per bulan</Text>}
          <Label>Metode bunga</Label>
          <View className="flex-row flex-wrap gap-2">
            <Chip testID="metode-efektif" label="Efektif" selected={metode === 'efektif'} onPress={() => setMetode('efektif')} />
            <Chip testID="metode-flat" label="Flat" selected={metode === 'flat'} onPress={() => setMetode('flat')} />
          </View>
          <View className="flex-row flex-wrap gap-2 pt-1">
            <Chip testID="sudah-berjalan" label="Sudah berjalan" selected={berjalan} onPress={() => setBerjalan((b) => !b)} />
          </View>
          {berjalan ? (
            <>
              <Label>Sisa pokok sekarang</Label>
              <AmountInput value={null} onChange={setSisaPokok} testID="sisa-pokok" />
              {sisaLebih ? <Text className="text-xs text-fg font-sans">Sisa pokok tidak boleh lebih dari pokok awal</Text> : null}
            </>
          ) : null}
        </>
      )}

      <Label>Uangnya masuk ke dompet?</Label>
      {aktif.length === 0 ? <Text className="text-mid font-sans">Belum ada dompet aktif.</Text> : null}
      <View className="flex-row flex-wrap gap-2">
        {aktif.map((w) => (
          <Chip key={w.id} testID={`dompet-${w.id}`} label={w.nama} selected={dompet === w.id} onPress={() => setDompetPilih(w.id)} />
        ))}
        <Chip testID="dompet-tidak" label="Tidak masuk dompet" selected={dompet === null} onPress={() => setDompetPilih(null)} />
      </View>

      {dompet ? (
        <>
          <Label>Dana yang masuk</Label>
          <AmountInput
            key={danaDisentuh ? 'dana-ubah' : `dana-${tipe}-${danaBawaan ?? 0}`}
            value={dana}
            onChange={(n) => {
              setDanaDisentuh(true);
              setDanaNilai(n);
            }}
            testID="dana-masuk"
          />
        </>
      ) : null}

      <Label>Tanggal mulai (YYYY-MM-DD)</Label>
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

      <View className="mt-4">
        <Tombol primary label="Simpan" onPress={simpan} disabled={nonaktif} busy={busy} />
      </View>
    </ScrollView>
  );
}
