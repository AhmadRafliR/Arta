import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { kapital } from '@/components/BarBudget';
import { ikonBudget } from '@/components/IsiBudget';
import { Ikon } from '@/components/ikon/Ikon';
import { Tombol } from '@/components/Tombol';
import { useMomen } from '@/animasi/useMomen';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { pesanBudget, useBudgets, useHapusBudget, useSimpanBudget } from '@/data/budgets';
import { useCategories } from '@/data/categories';
import { useTransactions } from '@/data/transactions';
import { KATEGORI_SEMUA, labelKategoriBudget, pemakaianBudget } from '@/domain/budget';
import { formatRingkas, formatRupiah } from '@/domain/money';
import { hariIni } from '@/lib/tanggal';

const kunci = (s: string) => s.trim().toLowerCase();
const CEPAT = [200_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000];
const MIN = 10_000;
const MAKS = 100_000_000;

const angka = (s: string) => {
  const d = s.replace(/\D/g, '');
  return d ? Number(d) : 0;
};
const titik = (n: number) => (n > 0 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');

/** Form tambah/ubah budget (mockup akun: #budgetFormView): nominal besar, chip cepat, petak kategori. */
export default function BudgetUbah() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const { profile } = useAuth();
  const momen = useMomen();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const bulan = hariIni(profile?.zona_waktu || undefined).slice(0, 7);
  const budgets = useBudgets();
  const txs = useTransactions(bulan);
  const kategoriQ = useCategories('pengeluaran');
  const simpanM = useSimpanBudget();
  const hapusM = useHapusBudget();
  const [pilih, setPilih] = useState<string | null>(null);
  const [teks, setTeks] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/budget'));

  const ada = id ? (budgets.data ?? []).find((b) => b.id === id) : undefined;
  const ubah = !!id;
  const terpakaiKunci = new Set((budgets.data ?? []).map((b) => kunci(b.kategori)));
  const kategori = ubah ? (ada?.kategori ?? null) : pilih;
  const isian = teks ?? (ada ? titik(ada.batas_bulanan) : '');
  const nilai = angka(isian);
  const pakai = ada && txs.data ? (pemakaianBudget([ada], txs.data, bulan)[0]?.terpakai ?? 0) : null;

  // Petak: Seluruh kategori lalu kategori pengeluaran pengguna. Saat mengubah, kategori tidak bisa diganti.
  const petak = [
    { nama: KATEGORI_SEMUA, label: labelKategoriBudget(KATEGORI_SEMUA), testID: 'kat-semua' },
    ...(kategoriQ.data ?? []).map((k) => ({ nama: k.nama, label: kapital(k.nama), testID: `kat-${k.nama}` })),
  ];
  const bebas = petak.filter((p) => !terpakaiKunci.has(kunci(p.nama))).length;

  function catatan(): { teks: string; tebal?: string; waspada?: boolean } {
    if (!ubah || pakai === null) return { teks: 'Isi batas yang masih masuk akal buat bulan ini.' };
    if (!nilai) return { teks: 'Terpakai ', tebal: `${formatRupiah(pakai)} sejauh ini.` };
    const sisa = nilai - pakai;
    if (sisa < 0) return { teks: 'Batas lebih kecil dari pemakaian, akan langsung ', tebal: `lewat ${formatRupiah(-sisa)}.`, waspada: true };
    return { teks: `Terpakai ${formatRupiah(pakai)} · sisa `, tebal: `${formatRupiah(sisa)} setelah disimpan.` };
  }
  const c = catatan();

  async function simpan() {
    if (busy) return;
    if (kategori === null) return setPesan('Pilih kategori budget dulu.');
    if (nilai < MIN) return setPesan(`Batas minimal ${formatRupiah(MIN)}.`);
    if (nilai > MAKS) return setPesan(`Batas maksimal ${formatRupiah(MAKS)}.`);
    setBusy(true);
    setPesan(null);
    try {
      await simpanM.mutateAsync({ id: ada?.id, kategori, batas_bulanan: nilai });
      momen(ubah ? 'Budget diperbarui' : 'Budget tersimpan');
      tutup();
    } catch (e) {
      setPesan(pesanBudget(e));
    } finally {
      setBusy(false);
    }
  }

  async function lakukanHapus() {
    if (!ada) return;
    setBusy(true);
    setPesan(null);
    try {
      await hapusM.mutateAsync(ada.id);
      tutup();
    } catch (e) {
      setPesan(pesanBudget(e));
    } finally {
      setBusy(false);
    }
  }

  function konfirmasiHapus() {
    if (!ada) return;
    Alert.alert(`Hapus budget ${labelKategoriBudget(ada.kategori)}?`, undefined, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => void lakukanHapus() },
    ]);
  }

  const judul = ubah ? 'Ubah budget' : 'Tambah budget';
  const sub =
    ubah && ada
      ? `${kapital(labelKategoriBudget(ada.kategori))} · batas ${formatRupiah(ada.batas_bulanan)}`
      : 'Batas pengeluaran per kategori';

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-3 px-5"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-row items-center gap-3">
        <View style={{ width: 42, height: 42 }} className="items-center justify-center rounded-[14px] bg-accsoft">
          <Ikon nama="ui-budget" ukuran={21} warna={t.accInk} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text accessibilityRole="header" className="font-sans text-base font-semibold text-fg">
            {judul}
          </Text>
          <Text className="font-sans text-xs text-fg2" numberOfLines={1}>
            {sub}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tutup"
          onPress={tutup}
          style={{ width: 38, height: 38 }}
          className="items-center justify-center rounded-full border border-line bg-card"
        >
          <Ikon nama="ui-close" ukuran={18} warna={t.fg} />
        </Pressable>
      </View>

      {ubah && budgets.data && !ada ? (
        <Text className="text-fg font-sans">Budget tidak ditemukan</Text>
      ) : ubah && !budgets.data ? (
        <Text className="text-mid font-sans">{budgets.error ? budgets.error.pesan : 'Memuat…'}</Text>
      ) : (
        <>
          <View className="gap-[3px] rounded-[20px] border border-line bg-card2 px-[15px] pb-[15px] pt-3.5">
            <Text className="font-sans text-[10.5px] font-semibold tracking-[0.07em] text-mid">
              {ubah ? 'BATAS BARU' : 'BATAS BULANAN'}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Text className="font-sans text-[19px] font-bold text-mid">Rp</Text>
              <TextInput
                testID="batas"
                accessibilityLabel="Batas budget bulanan"
                value={isian}
                onChangeText={(s) => {
                  setTeks(titik(angka(s)));
                  setPesan(null);
                }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={t.mid}
                editable={!busy}
                style={{ fontVariant: ['tabular-nums'], color: t.fg, padding: 0 }}
                className="min-w-0 flex-1 font-sans text-[26px] font-bold"
              />
            </View>
            <Text className="font-sans text-[11px] leading-[15px] text-mid">
              {c.teks}
              {c.tebal ? (
                <Text style={{ color: c.waspada ? t.warnInk : t.accInk }} className="font-sans font-bold">
                  {c.tebal}
                </Text>
              ) : null}
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-1.5">
            {CEPAT.map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={`Isi ${formatRupiah(n)}`}
                onPress={() => {
                  setTeks(titik(n));
                  setPesan(null);
                }}
                style={{ minHeight: 32 }}
                className="justify-center rounded-full border border-line bg-card px-[11px]"
              >
                <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[11.5px] font-semibold text-fg2">
                  {`Rp${formatRingkas(n)}`}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="mt-1 flex-row items-baseline">
            <Text className="flex-1 font-sans text-[10.5px] font-bold tracking-[0.08em] text-mid">KATEGORI</Text>
            <Text className="font-sans text-[11px] font-semibold text-mid">
              {kategori ? kapital(labelKategoriBudget(kategori)) : 'Pilih satu'}
            </Text>
          </View>
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
            {petak.map((p) => {
              const terpilih = kategori !== null && kunci(kategori) === kunci(p.nama);
              const mati = ubah ? !terpilih : terpakaiKunci.has(kunci(p.nama));
              return (
                <View key={p.nama} style={{ width: '33.333%', padding: 4 }}>
                  <Pressable
                    testID={p.testID}
                    accessibilityRole="button"
                    accessibilityLabel={p.label}
                    accessibilityState={{ selected: terpilih, disabled: mati }}
                    disabled={mati}
                    onPress={() => {
                      setPilih(p.nama);
                      setPesan(null);
                    }}
                    style={{
                      minHeight: 74,
                      borderWidth: 1.5,
                      borderColor: terpilih ? t.accInk : 'transparent',
                      opacity: mati ? 0.38 : 1,
                    }}
                    className={`items-center justify-center gap-1.5 rounded-[14px] px-1.5 py-2.5 ${terpilih ? 'bg-accsoft' : 'bg-card2'}`}
                  >
                    <Ikon nama={ikonBudget(p.nama)} ukuran={21} warna={terpilih ? t.accInk : t.fg2} />
                    <Text
                      style={terpilih ? { color: t.accInk } : undefined}
                      className={`text-center font-sans text-[11px] leading-[13px] ${terpilih ? 'font-bold' : 'font-semibold text-fg2'}`}
                      numberOfLines={2}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <Text className="font-sans text-[11px] leading-[15px] text-mid">
            {ubah
              ? 'Kategori tidak bisa diganti saat mengubah. Hapus lalu buat baru bila perlu.'
              : bebas > 0
                ? `${bebas} kategori belum punya budget. Yang sudah punya ditandai pudar.`
                : 'Semua kategori sudah punya budget.'}
          </Text>

          {pesan ? (
            <Text accessibilityLiveRegion="polite" className="font-sans text-[12.5px] font-semibold text-dangerink">
              {pesan}
            </Text>
          ) : null}

          <View className="flex-row gap-2">
            <View className="flex-1">
              <Tombol label="Batal" disabled={busy} onPress={tutup} />
            </View>
            <View className="flex-1">
              <Tombol primary label="Simpan" busy={busy} disabled={busy} onPress={() => void simpan()} />
            </View>
          </View>
          {ubah ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hapus budget"
              disabled={busy}
              onPress={konfirmasiHapus}
              style={{ minHeight: 38 }}
              className="items-center justify-center rounded-full"
            >
              <Text className="font-sans text-[12.5px] font-semibold text-mid">Hapus budget kategori ini</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
