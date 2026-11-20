import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AmountInput } from '@/components/AmountInput';
import { BarisField } from '@/components/BarisField';
import { Chip } from '@/components/Chip';
import { Ikon } from '@/components/ikon/Ikon';
import { ikonDompet, ikonKategori } from '@/components/ikon/peta';
import { KartuSeksi, LabelSub } from '@/components/KartuSeksi';
import { PeringatanBudget } from '@/components/PeringatanBudget';
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

// Teks per jenis mengikuti mockup catat (TYPE_COPY + QUICK). Jenis "Hutang" di mockup ditangani layar hutang/baru.
const JENIS: { nilai: JenisForm; label: string; labelNominal: string; simpan: string; cepat: number[] }[] = [
  {
    nilai: 'pengeluaran',
    label: 'Pengeluaran',
    labelNominal: 'Nominal pengeluaran',
    simpan: 'Simpan pengeluaran',
    cepat: [10000, 25000, 50000, 100000],
  },
  {
    nilai: 'pemasukan',
    label: 'Pemasukan',
    labelNominal: 'Nominal pemasukan',
    simpan: 'Simpan pemasukan',
    cepat: [50000, 100000, 500000, 1000000],
  },
  {
    nilai: 'transfer',
    label: 'Transfer',
    labelNominal: 'Nominal transfer',
    simpan: 'Simpan transfer',
    cepat: [50000, 100000, 250000, 500000],
  },
];

function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}

/** Label chip nominal cepat: 10000 -> "10rb", 1000000 -> "1jt". */
function labelCepat(v: number): string {
  return v >= 1000000 ? `${v / 1000000}jt` : `${v / 1000}rb`;
}

/** Rel jenis berbentuk pil (mockup: .type-rail); terpilih = gradien hero. */
function RelJenis({ nilai, onPilih }: { nilai: JenisForm; onPilih: (j: JenisForm) => void }) {
  const { t } = useTheme();
  return (
    <View className="flex-row gap-1.5 pb-1.5 pt-0.5" accessibilityLabel="Jenis catatan">
      {JENIS.map((j) => {
        const aktif = j.nilai === nilai;
        return (
          <Pressable
            key={j.nilai}
            testID={`jenis-${j.nilai}`}
            accessibilityRole="button"
            accessibilityLabel={j.label}
            accessibilityState={{ selected: aktif }}
            onPress={() => onPilih(j.nilai)}
            style={{ minHeight: 40 }}
            className={`flex-1 items-center justify-center overflow-hidden rounded-full px-1 ${
              aktif ? '' : 'border border-line bg-card'
            }`}
          >
            {aktif ? (
              <LinearGradient
                colors={[t.heroFrom, t.heroTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
              />
            ) : null}
            <Text
              style={aktif ? { color: t.heroFg } : undefined}
              className={`font-sans text-[12.5px] font-semibold ${aktif ? '' : 'text-fg2'}`}
              numberOfLines={1}
            >
              {j.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Kartu nominal bergradien (mockup: .amount-card): label kapital, "Rp" + angka besar, chip nominal cepat. */
function KartuNominal({ label, children, cepat, onCepat }: {
  label: string;
  children: React.ReactNode;
  cepat?: number[];
  onCepat?: (v: number) => void;
}) {
  const { t } = useTheme();
  return (
    <LinearGradient
      colors={[t.heroFrom, t.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16 }}
    >
      <Text style={{ color: t.amSub }} className="font-sans text-[11.5px] font-semibold uppercase tracking-[1.6px]">
        {label}
      </Text>
      {children}
      {cepat && onCepat ? (
        <View className="mt-3.5 flex-row flex-wrap gap-[7px]">
          {cepat.map((v) => (
            <Pressable
              key={v}
              testID={`cepat-${v}`}
              accessibilityRole="button"
              accessibilityLabel={`Isi ${formatRupiah(v)}`}
              onPress={() => onCepat(v)}
              style={{ minHeight: 32, borderColor: t.amLine }}
              className="items-center justify-center rounded-full border px-3 py-1.5"
            >
              <Text style={{ color: t.heroFg }} className="font-sans text-[12.5px] font-semibold">
                {labelCepat(v)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  );
}

/** Petak kategori 4 kolom (mockup: .tiles/.tile). Terpilih = accSoft + garis accInk. */
function PetakKategori({ nama, terpilih, onPress }: { nama: string; terpilih: boolean; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      testID={`kat-${nama}`}
      accessibilityRole="button"
      accessibilityLabel={nama}
      accessibilityState={{ selected: terpilih }}
      onPress={onPress}
      className="flex-1 items-center gap-[7px] px-1"
    >
      <View
        style={{ aspectRatio: 1, borderWidth: 1.5 }}
        className={`w-full items-center justify-center rounded-2xl ${terpilih ? 'border-accink bg-accsoft' : 'border-transparent bg-card2'}`}
      >
        <Ikon nama={ikonKategori(nama)} ukuran={23} warna={terpilih ? t.accInk : t.fg2} />
      </View>
      <Text
        numberOfLines={2}
        className={`text-center font-sans text-[11.5px] leading-[14px] ${terpilih ? 'font-semibold text-accink' : 'font-medium text-fg2'}`}
      >
        {nama}
      </Text>
    </Pressable>
  );
}

/** Pemisah panah antara "Dari" dan "Ke" pada kartu Pindah dana (mockup: .swap-divider). */
function PemisahPanah() {
  const { t } = useTheme();
  return (
    <View className="flex-row items-center gap-2.5 pb-1 pt-2" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View className="h-px flex-1 bg-line" />
      <View style={{ width: 26, height: 26 }} className="items-center justify-center rounded-full border border-line bg-card">
        <Ikon nama="ui-swap" ukuran={14} warna={t.mid} />
      </View>
      <View className="h-px flex-1 bg-line" />
    </View>
  );
}

/** Tombol utama CTA bawah (mockup: .btn-primary dengan ikon centang). */
function TombolSimpan({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled: boolean; busy: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 52, borderRadius: 14 }}
      className={`flex-row items-center justify-center gap-2 bg-acc px-5 ${disabled ? 'opacity-50' : ''}`}
    >
      {busy ? (
        <ActivityIndicator color={t.accFg} />
      ) : (
        <>
          <Ikon nama="ui-check" ukuran={19} warna={t.accFg} />
          <Text style={{ color: t.accFg }} className="font-sans text-base font-bold">
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

type BodyProps = {
  /** Diisi pada mode ubah. */
  initial?: Tx;
  submit: (v: NilaiForm) => Promise<void>;
  /** Isi tambahan di area CTA bawah, di bawah tombol simpan (mis. tombol Hapus pada mode ubah). */
  bawah?: React.ReactNode;
};

function TxFormBody({ initial, submit, bawah }: BodyProps) {
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
  // Chip nominal cepat mengisi ulang AmountInput (teksnya dipegang komponen itu) dengan me-remount lewat key.
  const [nominalAwal, setNominalAwal] = useState<number | null>(ubah ? initial.nominal : null);
  const [kunciNominal, setKunciNominal] = useState(0);
  const [kategori, setKategori] = useState<string | null>(ubah ? initial.kategori : null);
  const [asalPilih, setAsalPilih] = useState<string | null>(ubah ? initial.wallet_id : null);
  const [tujuanPilih, setTujuanPilih] = useState<string | null>(ubah ? initial.wallet_tujuan_id : null);
  const zona = profile?.zona_waktu || undefined;
  const [tanggal, setTanggal] = useState(() => (ubah ? initial.tanggal : hariIni(zona)));
  const [catatan, setCatatan] = useState(ubah ? (initial.catatan ?? '') : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transfer = jenis === 'transfer';
  const salinan = JENIS.find((j) => j.nilai === jenis) ?? JENIS[0];
  const kategoriQ = useCategories(jenis === 'pemasukan' ? 'pemasukan' : 'pengeluaran');
  const daftarKategori = transfer ? [] : (kategoriQ.data ?? []);

  const asalId = asalPilih && aktif.some((w) => w.id === asalPilih) ? asalPilih : (aktif[0]?.id ?? null);
  const tujuanOpsi = aktif.filter((w) => w.id !== asalId);
  const tujuanId = tujuanPilih && tujuanOpsi.some((w) => w.id === tujuanPilih) ? tujuanPilih : null;

  const tglOk = tanggalValid(tanggal);
  const valid = terkunci
    ? tglOk
    : nominal !== null &&
    nominal > 0 &&
    asalId !== null &&
    tglOk &&
    (transfer ? tujuanId !== null : daftarKategori.length === 0 || kategori !== null);
  const nonaktif = busy || !valid;

  // Pesan status di atas tombol (mockup: .status): galat simpan, atau petunjuk yang belum lengkap.
  let petunjuk: string | null = null;
  if (!terkunci && !busy) {
    if (nominal === null || nominal <= 0) petunjuk = 'Isi nominal dulu.';
    else if (transfer && asalId !== null && tujuanId === null) petunjuk = 'Pilih dompet tujuan.';
    else if (!transfer && daftarKategori.length > 0 && kategori === null) petunjuk = 'Pilih kategori dulu.';
  }

  function ubahJenis(j: JenisForm) {
    setJenis(j);
    setKategori(null);
    setError(null);
  }

  function isiCepat(v: number) {
    setNominal(v);
    setNominalAwal(v);
    setKunciNominal((k) => k + 1);
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

  const labelSimpan = ubah ? 'Simpan perubahan' : salinan.simpan;
  const tagTerkunci = terkunci ? (initial.jenis.startsWith('hutang_') ? 'Hutang' : 'Penyesuaian') : '';

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-[18px] pb-3.5" keyboardShouldPersistTaps="handled">
        {terkunci ? (
          <Text className="text-xs text-mid font-sans">
            {initial.jenis.startsWith('hutang_')
              ? 'Transaksi hutang · hanya tanggal dan catatan yang dapat diubah. Ubah hutangnya dari tab Hutang.'
              : `${initial.jenis.replace('_', ' ')} · hanya tanggal dan catatan yang dapat diubah`}
          </Text>
        ) : (
          <RelJenis nilai={jenis} onPilih={ubahJenis} />
        )}

        {terkunci ? (
          <KartuNominal label="Nominal">
            <TextInput
              testID="nominal"
              editable={false}
              value={formatRupiah(initial.nominal)}
              accessibilityLabel="Nominal"
              style={{ color: t.heroFg, fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'], opacity: 0.85 }}
              className="mt-1.5 p-0 font-sans font-semibold"
            />
          </KartuNominal>
        ) : (
          <KartuNominal label={salinan.labelNominal} cepat={salinan.cepat} onCepat={isiCepat}>
            <AmountInput key={kunciNominal} varian="hero" value={nominalAwal} onChange={setNominal} testID="nominal" />
          </KartuNominal>
        )}

        {terkunci ? (
          <KartuSeksi judul="Detail" tag={tagTerkunci}>
            <LabelSub>Dompet</LabelSub>
            <Text className="font-sans text-[15px] text-fg">
              {(wallets.data ?? []).find((w) => w.id === initial.wallet_id)?.nama ?? '-'}
            </Text>
          </KartuSeksi>
        ) : transfer ? (
          <KartuSeksi judul="Pindah dana" tag="Antar dompet">
            <LabelSub>Dari dompet</LabelSub>
            {aktif.length === 0 ? <Text className="text-mid font-sans">Belum ada dompet aktif.</Text> : null}
            <View className="flex-row flex-wrap gap-2">
              {aktif.map((w) => (
                <Chip
                  key={w.id}
                  testID={`src-${w.id}`}
                  label={w.nama}
                  ikon={ikonDompet(w.tipe)}
                  selected={asalId === w.id}
                  onPress={() => setAsalPilih(w.id)}
                />
              ))}
            </View>
            <PemisahPanah />
            <LabelSub>Ke dompet</LabelSub>
            {aktif.length > 0 && tujuanOpsi.length === 0 ? (
              <Text className="text-mid font-sans">Butuh dompet aktif lain sebagai tujuan.</Text>
            ) : null}
            <View className="flex-row flex-wrap gap-2">
              {tujuanOpsi.map((w) => (
                <Chip
                  key={w.id}
                  testID={`dst-${w.id}`}
                  label={w.nama}
                  ikon={ikonDompet(w.tipe)}
                  selected={tujuanId === w.id}
                  onPress={() => setTujuanPilih(w.id)}
                />
              ))}
            </View>
          </KartuSeksi>
        ) : (
          <KartuSeksi judul="Detail" tag={salinan.label}>
            {daftarKategori.length > 0 ? (
              // Baris isi 4 dengan flex-1 (tanpa lebar persen, yang menyusut di Android); sisa baris diisi kosong.
              <View className="-mx-1 mt-3.5 gap-3">
                {Array.from({ length: Math.ceil(daftarKategori.length / 4) }, (_, i) => daftarKategori.slice(i * 4, i * 4 + 4)).map(
                  (baris, i) => (
                    <View key={i} className="flex-row">
                      {baris.map((k) => (
                        <PetakKategori key={k.id} nama={k.nama} terpilih={kategori === k.nama} onPress={() => setKategori(k.nama)} />
                      ))}
                      {Array.from({ length: 4 - baris.length }, (_, j) => (
                        <View key={`kosong-${j}`} className="flex-1 px-1" />
                      ))}
                    </View>
                  ),
                )}
              </View>
            ) : null}
            <LabelSub>Dompet</LabelSub>
            {aktif.length === 0 ? <Text className="text-mid font-sans">Belum ada dompet aktif.</Text> : null}
            <View className="flex-row flex-wrap gap-2">
              {aktif.map((w) => (
                <Chip
                  key={w.id}
                  testID={`src-${w.id}`}
                  label={w.nama}
                  ikon={ikonDompet(w.tipe)}
                  selected={asalId === w.id}
                  onPress={() => setAsalPilih(w.id)}
                />
              ))}
            </View>
          </KartuSeksi>
        )}

        {jenis === 'pengeluaran' && !terkunci && nominal !== null && nominal > 0 && tglOk ? (
          <PeringatanBudget kategori={kategori} nominal={nominal} tanggal={tanggal} abaikanTxId={ubah ? initial.id : undefined} />
        ) : null}

        <KartuSeksi judul="Jadwal & catatan" tag="Hari ini" onTag={() => setTanggal(hariIni(zona))}>
          <View className="mt-3.5">
            <BarisField ikon="status-jatuh-tempo" label="Tanggal" pertama>
              <TextInput
                testID="tanggal"
                value={tanggal}
                onChangeText={setTanggal}
                autoCapitalize="none"
                placeholder="YYYY-MM-DD"
                placeholderTextColor={t.mid}
                className="py-0.5 font-sans text-[15px] text-fg"
              />
              {tglOk ? null : <Text className="font-sans text-xs font-semibold text-dangerink">Tanggal tidak valid</Text>}
            </BarisField>
            <BarisField ikon="cat-lainnya" label="Catatan (opsional)">
              <TextInput
                testID="catatan"
                value={catatan}
                onChangeText={setCatatan}
                placeholder="Mis. kopi tadi pagi"
                placeholderTextColor={t.mid}
                className="py-0.5 font-sans text-[15px] text-fg"
              />
            </BarisField>
          </View>
        </KartuSeksi>
      </ScrollView>

      <View className="gap-[7px] bg-bg px-[18px] pb-4 pt-2.5">
        {error ? (
          <Text accessibilityLiveRegion="polite" className="text-center font-sans text-[12.5px] text-dangerink">
            {error}
          </Text>
        ) : petunjuk ? (
          <Text className="text-center font-sans text-[12.5px] text-mid">{petunjuk}</Text>
        ) : null}
        <TombolSimpan label={labelSimpan} onPress={simpan} disabled={nonaktif} busy={busy} />
        {bawah}
      </View>
    </View>
  );
}

type Props = {
  /** Mode baru: id transaksi, dibuat sekali oleh pemanggil dan dipakai ulang untuk setiap percobaan simpan. */
  txId?: string;
  /** 'ubah' mengisi dari `initial` dan memperbarui baris itu; bawaan 'baru'. */
  mode?: 'baru' | 'ubah';
  initial?: Tx;
  onSaved: () => void;
  /** Isi tambahan di area CTA bawah (di bawah tombol simpan). */
  bawah?: React.ReactNode;
};

function FormBaru({ txId, onSaved, bawah }: { txId: string; onSaved: () => void; bawah?: React.ReactNode }) {
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
  return <TxFormBody submit={submit} bawah={bawah} />;
}

function FormUbah({ initial, onSaved, bawah }: { initial: Tx; onSaved: () => void; bawah?: React.ReactNode }) {
  const update = useUpdateTransaction();
  async function submit(v: NilaiForm) {
    const patch = buatPatch(initial, v);
    if (Object.keys(patch).length > 0) await update.mutateAsync({ id: initial.id, patch });
    onSaved();
  }
  return <TxFormBody initial={initial} submit={submit} bawah={bawah} />;
}

export function TxForm({ txId, mode = 'baru', initial, onSaved, bawah }: Props) {
  if (mode === 'ubah' && initial) return <FormUbah initial={initial} onSaved={onSaved} bawah={bawah} />;
  return <FormBaru txId={txId ?? ''} onSaved={onSaved} bawah={bawah} />;
}
