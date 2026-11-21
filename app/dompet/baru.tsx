import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmountInput } from '@/components/AmountInput';
import { BarisField } from '@/components/BarisField';
import { Segmented } from '@/components/Segmented';
import { KepalaSheet } from '@/components/SheetBawah';
import { Ikon } from '@/components/ikon/Ikon';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import type { TipeDompet } from '@/domain/types';
import { hariIni } from '@/lib/tanggal';
import { pesanDompet } from '@/data/pesan';
import { useCreateWallet } from '@/data/wallets';
import { useTheme } from '@/theme/ThemeProvider';

// Label 'Darurat' dipertahankan (dipakai tes); mockup menulis 'Dana darurat'.
const TIPE: { nilai: TipeDompet; label: string }[] = [
  { nilai: 'harian', label: 'Harian' },
  { nilai: 'darurat', label: 'Darurat' },
  { nilai: 'investasi', label: 'Investasi' },
];

// Teks kontekstual per tipe dompet.
const TEKS: Record<
  TipeDompet,
  { judul: string; sub: string; placeholder: string; labelSaldo: string; bantuSaldo: string }
> = {
  harian: {
    judul: 'Tambah dompet',
    sub: 'Saldo awal dicatat sebagai titik mulai',
    placeholder: 'Mis. GoPay, Cash, BCA',
    labelSaldo: 'Saldo awal (Rp)',
    bantuSaldo: 'Isi saldo dompet ini saat ini. Boleh 0.',
  },
  darurat: {
    judul: 'Tambah dana darurat',
    sub: 'Uang cadangan yang tidak dihitung di sisa uang',
    placeholder: 'Mis. Dana darurat, Tabungan BCA',
    labelSaldo: 'Saldo awal (Rp)',
    bantuSaldo: 'Isi jumlah dana darurat yang sudah terkumpul. Boleh 0.',
  },
  investasi: {
    judul: 'Tambah aset investasi',
    sub: 'Nilai awal dicatat sebagai modal',
    placeholder: 'Mis. Reksa dana, Saham, Emas',
    labelSaldo: 'Nilai awal (Rp)',
    bantuSaldo: 'Isi nilai aset saat ini sebagai modal awal. Boleh 0.',
  },
};

export default function DompetBaru() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { t } = useTheme();
  const create = useCreateWallet();
  const [nama, setNama] = useState('');
  const { tipe: tipeAwal } = useLocalSearchParams<{ tipe?: string }>();
  const [tipe, setTipe] = useState<TipeDompet>(TIPE.find((x) => x.nilai === tipeAwal)?.nilai ?? 'harian');
  const [saldo, setSaldo] = useState<number | null>(0);
  const [target, setTarget] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));
  const teks = TEKS[tipe];
  const valid = nama.trim() !== '' && saldo !== null && (tipe !== 'darurat' || target !== null);

  async function simpan() {
    if (!valid || busy) return;
    setBusy(true);
    setPesan(null);
    try {
      await create.mutateAsync({
        nama: nama.trim(),
        tipe,
        saldo_awal: saldo ?? 0,
        tanggal_saldo_awal: hariIni(profile?.zona_waktu),
        target: tipe === 'darurat' && target ? target : null,
      });
      tutup();
    } catch (e) {
      setPesan(pesanDompet(e, { namaUnik: true }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-4 px-[18px]"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Kepala (mockup akun: addView): ikon tambah, judul, subjudul, tombol tutup bulat. */}
      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <KepalaSheet ikon="ui-plus" judul={teks.judul} sub={teks.sub} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Batal"
          onPress={tutup}
          style={{ width: 38, height: 38 }}
          className="items-center justify-center rounded-full border border-line bg-card"
        >
          <Ikon nama="ui-close" ukuran={18} warna={t.fg} />
        </Pressable>
      </View>

      <Segmented pilihan={TIPE} nilai={tipe} onChange={setTipe} />

      <View className="rounded-[14px] border border-line bg-card px-3 pt-2.5">
        <BarisField ikon="wallet-harian" label="Nama dompet" pertama>
          <TextInput
            value={nama}
            onChangeText={setNama}
            accessibilityLabel="Nama dompet"
            placeholder={teks.placeholder}
            placeholderTextColor={t.mid}
            maxLength={24}
            className="py-0.5 font-sans text-[14.5px] font-semibold text-fg"
          />
        </BarisField>
        <BarisField ikon="status-jatuh-tempo" label="Tanggal saldo awal">
          <Text className="font-sans text-[14.5px] font-semibold text-fg">{hariIni(profile?.zona_waktu)}</Text>
        </BarisField>
      </View>

      <View className="gap-1.5">
        <Text className="font-sans text-[11.5px] font-semibold text-mid">{teks.labelSaldo}</Text>
        <AmountInput value={null} allowZero onChange={setSaldo} testID="saldo-awal" />
        <Text className="font-sans text-xs text-mid">{teks.bantuSaldo}</Text>
      </View>
      {tipe === 'darurat' ? (
        <View className="gap-1.5">
          <Text className="font-sans text-[11.5px] font-semibold text-mid">Target dana darurat (opsional)</Text>
          <AmountInput value={null} allowZero onChange={setTarget} testID="target" />
          <Text className="font-sans text-xs text-mid">
            Kosongkan bila belum punya target. Umumnya 3–6× pengeluaran bulanan.
          </Text>
        </View>
      ) : null}

      <Tombol label="Simpan" primary busy={busy} disabled={!valid || busy} onPress={() => void simpan()} />
      {pesan ? (
        <Text accessibilityLiveRegion="polite" style={{ color: t.dangerInk }} className="font-sans text-[12.5px]">
          {pesan}
        </Text>
      ) : null}
    </ScrollView>
  );
}
