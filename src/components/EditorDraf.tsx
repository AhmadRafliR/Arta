import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmountInput } from '@/components/AmountInput';
import { Chip } from '@/components/Chip';
import { Tombol } from '@/components/Tombol';
import type { DrafTx } from '@/ai/tipe';
import { useCategories } from '@/data/categories';
import type { Wallet } from '@/domain/types';
import { tanggalValid } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

type Jenis = DrafTx['jenis'];
export type PatchDraf = Omit<DrafTx, 'id' | 'peringatan'>;

const JENIS: { nilai: Jenis; label: string }[] = [
  { nilai: 'pengeluaran', label: 'Pengeluaran' },
  { nilai: 'pemasukan', label: 'Pemasukan' },
  { nilai: 'transfer', label: 'Transfer' },
];

function Label({ children }: { children: string }) {
  return <Text className="mt-2 text-xs font-semibold text-mid font-sans">{children}</Text>;
}

type Props = {
  draf: DrafTx;
  /** Dompet aktif (tidak diarsip). */
  dompet: Wallet[];
  onSimpan: (patch: PatchDraf) => void;
  onTutup: () => void;
};

// Lembar bawah untuk mengubah satu draf. Perubahan baru diterapkan ke store saat "Selesai".
export function EditorDraf({ draf, dompet, onSimpan, onTutup }: Props) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const [jenis, setJenis] = useState<Jenis>(draf.jenis);
  const [kategori, setKategori] = useState(draf.kategori);
  const [nominal, setNominal] = useState<number | null>(draf.nominal);
  const [asal, setAsal] = useState<string | null>(draf.wallet_id);
  const [tujuan, setTujuan] = useState<string | null>(draf.wallet_tujuan_id);
  const [tanggal, setTanggal] = useState(draf.tanggal);
  const [catatan, setCatatan] = useState(draf.catatan ?? '');

  const transfer = jenis === 'transfer';
  const kategoriQ = useCategories(jenis === 'pemasukan' ? 'pemasukan' : 'pengeluaran');
  const daftarKategori = transfer ? [] : (kategoriQ.data ?? []);
  const tujuanOpsi = dompet.filter((w) => w.id !== asal);
  const valid = nominal !== null && nominal > 0 && tanggalValid(tanggal);

  function ubahJenis(j: Jenis) {
    if (j === jenis) return;
    setJenis(j);
    // transfer -> kategori 'transfer'; selain itu mulai dari 'lainnya' (kategori lama milik jenis lain).
    setKategori(j === 'transfer' ? 'transfer' : 'lainnya');
  }

  function pilihAsal(id: string) {
    setAsal(id);
    if (tujuan === id) setTujuan(null);
  }

  function selesai() {
    if (!valid || nominal === null) return;
    onSimpan({
      jenis,
      kategori: transfer ? 'transfer' : kategori,
      nominal,
      wallet_id: asal,
      wallet_tujuan_id: transfer ? tujuan : null,
      tanggal,
      catatan: catatan.trim() || null,
    });
  }

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onTutup}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Tutup editor" onPress={onTutup} className="absolute inset-0 bg-black/40" />
        <View className="max-h-[88%] rounded-t-3xl bg-bg" style={{ paddingBottom: insets.bottom + 12 }}>
          <View className="flex-row items-center justify-between px-5 pb-1 pt-4">
            <Text className="text-lg font-bold text-fg font-sans">Ubah transaksi</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={onTutup} className="px-2 py-1">
              <Text className="text-mid font-sans">Tutup</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="gap-2 px-5 pb-2" keyboardShouldPersistTaps="handled">
            <View className="flex-row flex-wrap gap-2">
              {JENIS.map((j) => (
                <Chip key={j.nilai} testID={`jenis-${j.nilai}`} label={j.label} selected={jenis === j.nilai} onPress={() => ubahJenis(j.nilai)} />
              ))}
            </View>

            <Label>Nominal</Label>
            <AmountInput value={draf.nominal} onChange={setNominal} testID="nominal" />

            {transfer ? null : (
              <>
                <Label>Kategori</Label>
                <View className="flex-row flex-wrap gap-2">
                  {daftarKategori.map((k) => (
                    <Chip
                      key={k.id}
                      testID={`kat-${k.nama}`}
                      label={k.nama}
                      selected={kategori.toLowerCase() === k.nama.toLowerCase()}
                      onPress={() => setKategori(k.nama)}
                    />
                  ))}
                </View>
              </>
            )}

            <Label>{transfer ? 'Dari dompet' : 'Dompet'}</Label>
            {dompet.length === 0 ? <Text className="text-mid font-sans">Belum ada dompet aktif.</Text> : null}
            <View className="flex-row flex-wrap gap-2">
              {dompet.map((w) => (
                <Chip key={w.id} testID={`src-${w.id}`} label={w.nama} selected={asal === w.id} onPress={() => pilihAsal(w.id)} />
              ))}
            </View>

            {transfer ? (
              <>
                <Label>Ke dompet</Label>
                <View className="flex-row flex-wrap gap-2">
                  {tujuanOpsi.map((w) => (
                    <Chip key={w.id} testID={`dst-${w.id}`} label={w.nama} selected={tujuan === w.id} onPress={() => setTujuan(w.id)} />
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

            <View className="mt-4">
              <Tombol primary label="Selesai" onPress={selesai} disabled={!valid} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
