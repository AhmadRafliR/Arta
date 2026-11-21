import { useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { AmountInput } from '@/components/AmountInput';
import { BarisField } from '@/components/BarisField';
import { Chip } from '@/components/Chip';
import {
  BarisAksi,
  CatatanKecil,
  KELAS_ISIAN,
  KotakHitung,
  KotakIsian,
  Petunjuk,
  SegmenHutang,
  TombolAksi,
} from '@/components/hutang/BagianHutang';
import { useAuth } from '@/auth/AuthProvider';
import { toAppError, type AppError } from '@/data/errors';
import type { DrafHutang } from '@/data/hutangGambar';
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
  /** Bila ada, tampil tombol "Batal" di samping "Simpan" (mockup: .sheet-actions). */
  onBatal?: () => void;
  /** Draf dari screenshot: mengisi state awal. Pemanggil memasang ulang form (key baru) untuk draf baru. */
  awal?: DrafHutang;
};

const TIPE: { nilai: TipeHutang; label: string; testID: string }[] = [
  { nilai: 'cicilan_tetap', label: 'Cicilan tetap', testID: 'tipe-cicilan' },
  { nilai: 'berbunga', label: 'Berbunga', testID: 'tipe-berbunga' },
];

// Form hutang baru (mockup: lembar "Tambah hutang"): segmen jenis, baris isian berikon, kotak hitung, Batal/Simpan.
export function FormHutang({ txId, debtId, onSaved, onBatal, awal }: Props) {
  const { profile } = useAuth();
  const { t } = useTheme();
  const save = useSaveTransactions();
  const wallets = useWallets();
  const aktif = (wallets.data ?? []).filter((w) => !w.diarsip);
  const zona = profile?.zona_waktu || undefined;

  const [pemberi, setPemberi] = useState(awal?.pemberi ?? '');
  const [tipe, setTipe] = useState<TipeHutang>(awal?.tipe ?? 'cicilan_tetap');
  const [nominalCicilan, setNominalCicilan] = useState<number | null>(awal?.nominal_cicilan ?? null);
  const [tenorTeks, setTenorTeks] = useState(awal?.tenor_bulan != null ? String(awal.tenor_bulan) : '');
  const [jatuhTempo, setJatuhTempo] = useState(() =>
    awal?.jatuh_tempo && tanggalValid(awal.jatuh_tempo) ? awal.jatuh_tempo : bulanDepan(hariIni(zona)),
  );
  const [pokokAwal, setPokokAwal] = useState<number | null>(awal?.pokok_awal ?? null);
  const [bungaTeks, setBungaTeks] = useState(
    awal?.bunga_persen_bulanan != null ? String(awal.bunga_persen_bulanan).replace('.', ',') : '',
  );
  const [metode, setMetode] = useState<MetodeBunga>('efektif');
  const [berjalan, setBerjalan] = useState(awal?.sisa_pokok != null);
  const [sisaPokok, setSisaPokok] = useState<number | null>(awal?.sisa_pokok ?? null);
  // undefined = belum dipilih; null = "Tidak masuk dompet".
  const [dompetPilih, setDompetPilih] = useState<string | null | undefined>(undefined);
  const [danaDisentuh, setDanaDisentuh] = useState(false);
  const [danaNilai, setDanaNilai] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState(() => hariIni(zona));
  const [catatan, setCatatan] = useState(awal?.catatan ?? '');
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

  // Alasan Simpan nonaktif, berurutan seperti kolom di layar. Sisa pokok > pokok awal sudah punya petunjuk sendiri.
  const kekurangan: string[] = [];
  if (pemberi.trim().length === 0) kekurangan.push('nama pemberi');
  if (cicilan) {
    if (nominalCicilan === null || nominalCicilan <= 0) kekurangan.push('nominal cicilan per bulan');
    if (!tenorOk) kekurangan.push('sisa tenor (1–60 bulan)');
    if (!tanggalValid(jatuhTempo)) kekurangan.push('jatuh tempo berikutnya (format YYYY-MM-DD)');
  } else {
    if (pokokAwal === null || pokokAwal <= 0) kekurangan.push('pokok awal');
    if (bunga === null) kekurangan.push('bunga per bulan (0–100%)');
    if (berjalan && sisaPokok === null) kekurangan.push('sisa pokok sekarang');
  }
  if (!tanggalValid(tanggal)) kekurangan.push('tanggal mulai (format YYYY-MM-DD)');
  if (dompet === undefined) kekurangan.push('dompet tujuan uang, atau pilih "Tidak masuk dompet"');
  else if (danaDisentuh && (danaNilai === null || danaNilai <= 0)) kekurangan.push('jumlah uang yang masuk (lebih dari 0)');

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

  // Kotak hitung (mockup: #editCalc). Bunga bulan pertama: flat dari pokok awal, efektif dari sisa sekarang.
  const dasarBunga = metode === 'efektif' && berjalan && sisaPokok !== null ? sisaPokok : pokokAwal;
  const bungaPerBulan = bunga !== null && dasarBunga !== null ? Math.round((dasarBunga * bunga) / 100) : null;
  const hitung = cicilan
    ? total !== null
      ? [
          { label: 'Total dibayar', nilai: formatRupiah(total), testID: 'total-hutang' },
          { label: 'Per bulan', nilai: formatRupiah(nominalCicilan ?? 0), masuk: true },
        ]
      : null
    : pokokAwal !== null
      ? [
          { label: 'Pokok pinjaman', nilai: formatRupiah(pokokAwal), masuk: true },
          { label: 'Bunga bulan pertama', nilai: bungaPerBulan !== null ? formatRupiah(bungaPerBulan) : '—' },
          { label: 'Metode', nilai: metode === 'flat' ? 'Flat' : 'Efektif' },
          { label: 'Sisa pokok', nilai: formatRupiah(berjalan && sisaPokok !== null ? sisaPokok : pokokAwal) },
        ]
      : null;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-3 px-[18px] pb-8 pt-1" keyboardShouldPersistTaps="handled">
      <SegmenHutang pilihan={TIPE} nilai={tipe} onChange={ubahTipe} />
      <CatatanKecil>
        {cicilan
          ? 'Cicilan tetap tanpa bunga, mis. paylater. Jadwal tagihan dibuat otomatis.'
          : 'Pembayaran pertama tiap bulan melunasi bunga dulu, sisanya mengurangi pokok.'}
      </CatatanKecil>

      <KotakIsian>
        <BarisField ikon="nav-akun" label="Pemberi" pertama>
          <TextInput
            testID="pemberi"
            value={pemberi}
            onChangeText={setPemberi}
            maxLength={60}
            placeholder="Mis. Kredivo, Shopee PayLater"
            placeholderTextColor={t.mid}
            className={`font-sans ${KELAS_ISIAN}`}
          />
        </BarisField>

        {cicilan ? (
          <>
            <BarisField ikon="ui-money" label="Nominal cicilan per bulan">
              <AmountInput value={nominalCicilan} onChange={setNominalCicilan} testID="nominal-cicilan" />
            </BarisField>
            <BarisField ikon="nav-riwayat" label="Sisa tenor (bulan, 1-60)">
              <TextInput
                testID="tenor"
                value={tenorTeks}
                onChangeText={setTenorTeks}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="12"
                placeholderTextColor={t.mid}
                className={`font-sans ${KELAS_ISIAN}`}
              />
              {tenorTeks === '' || tenorOk ? null : <Petunjuk>Tenor harus 1–60 bulan</Petunjuk>}
            </BarisField>
            <BarisField ikon="status-jatuh-tempo" label="Jatuh tempo berikutnya (YYYY-MM-DD)">
              <TextInput
                testID="jatuh-tempo"
                value={jatuhTempo}
                onChangeText={setJatuhTempo}
                autoCapitalize="none"
                placeholderTextColor={t.mid}
                className={`font-sans ${KELAS_ISIAN}`}
              />
              {tanggalValid(jatuhTempo) ? null : <Petunjuk>Tanggal tidak valid</Petunjuk>}
            </BarisField>
          </>
        ) : (
          <>
            <BarisField ikon="ui-money" label="Pokok awal">
              <AmountInput value={pokokAwal} onChange={setPokokAwal} testID="pokok-awal" />
            </BarisField>
            <BarisField ikon="ui-percent" label="Bunga per bulan (%)">
              <TextInput
                testID="bunga"
                value={bungaTeks}
                onChangeText={setBungaTeks}
                keyboardType="decimal-pad"
                placeholder="2,5"
                placeholderTextColor={t.mid}
                className={`font-sans ${KELAS_ISIAN}`}
              />
              {bungaTeks === '' || bunga !== null ? null : <Petunjuk>Bunga 0–100% per bulan</Petunjuk>}
              <View className="mt-1 flex-row flex-wrap gap-[7px]">
                <Chip testID="metode-efektif" label="Efektif" selected={metode === 'efektif'} onPress={() => setMetode('efektif')} />
                <Chip testID="metode-flat" label="Flat" selected={metode === 'flat'} onPress={() => setMetode('flat')} />
              </View>
            </BarisField>
            <BarisField ikon="nav-riwayat" label="Sudah berjalan sebelumnya?">
              <View className="mt-0.5 flex-row flex-wrap gap-[7px]">
                <Chip
                  testID="sudah-berjalan"
                  label="Sudah berjalan"
                  ikon={berjalan ? 'ui-check' : undefined}
                  selected={berjalan}
                  onPress={() => setBerjalan((b) => !b)}
                />
              </View>
            </BarisField>
            {berjalan ? (
              <BarisField ikon="ui-money" label="Sisa pokok sekarang">
                <AmountInput value={sisaPokok} onChange={setSisaPokok} testID="sisa-pokok" />
                {sisaLebih ? <Petunjuk>Sisa pokok tidak boleh lebih dari pokok awal</Petunjuk> : null}
              </BarisField>
            ) : null}
          </>
        )}

        <BarisField ikon="status-jatuh-tempo" label="Tanggal mulai (YYYY-MM-DD)">
          <TextInput
            testID="tanggal"
            value={tanggal}
            onChangeText={setTanggal}
            autoCapitalize="none"
            placeholderTextColor={t.mid}
            className={`font-sans ${KELAS_ISIAN}`}
          />
          {tanggalValid(tanggal) ? null : <Petunjuk>Tanggal tidak valid</Petunjuk>}
        </BarisField>

        <BarisField ikon="wallet-harian" label="Uangnya masuk ke dompet?">
          {aktif.length === 0 ? <CatatanKecil>Belum ada dompet aktif.</CatatanKecil> : null}
          <View className="mt-0.5 flex-row flex-wrap gap-[7px]">
            {aktif.map((w) => (
              <Chip
                key={w.id}
                testID={`dompet-${w.id}`}
                label={w.nama}
                ikon="wallet-harian"
                selected={dompet === w.id}
                onPress={() => setDompetPilih(w.id)}
              />
            ))}
            <Chip testID="dompet-tidak" label="Tidak masuk dompet" selected={dompet === null} onPress={() => setDompetPilih(null)} />
          </View>
        </BarisField>

        {dompet ? (
          <BarisField ikon="ui-money" label="Dana yang masuk">
            <AmountInput
              key={danaDisentuh ? 'dana-ubah' : `dana-${tipe}-${danaBawaan ?? 0}`}
              value={dana}
              onChange={(n) => {
                setDanaDisentuh(true);
                setDanaNilai(n);
              }}
              testID="dana-masuk"
            />
          </BarisField>
        ) : null}

        <BarisField ikon="ui-note" label="Catatan (opsional)">
          <TextInput
            testID="catatan"
            value={catatan}
            onChangeText={setCatatan}
            placeholder="Catatan"
            placeholderTextColor={t.mid}
            className={`font-sans ${KELAS_ISIAN}`}
          />
        </BarisField>
      </KotakIsian>

      {hitung ? <KotakHitung item={hitung} /> : null}
      {error ? <Petunjuk>{error}</Petunjuk> : null}
      {!valid && !busy && kekurangan.length > 0 ? (
        <Petunjuk>{`Belum bisa disimpan. Lengkapi: ${kekurangan.join('; ')}.`}</Petunjuk>
      ) : null}

      <View className="mt-1">
        <BarisAksi>
          {onBatal ? <TombolAksi label="Batal" onPress={onBatal} /> : null}
          <TombolAksi label="Simpan" varian="utama" onPress={simpan} disabled={nonaktif} busy={busy} />
        </BarisAksi>
      </View>
    </ScrollView>
  );
}
