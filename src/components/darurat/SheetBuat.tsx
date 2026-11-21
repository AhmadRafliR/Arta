import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { SheetBawah } from '@/components/SheetBawah';
import { Tombol } from '@/components/Tombol';
import { useTheme } from '@/theme/ThemeProvider';

export const NAMA_DANA_DARURAT = 'Dana darurat';

const angka = (s: string) => {
  const d = s.replace(/\D/g, '');
  return d ? Number(d) : 0;
};
const titik = (n: number) => (n > 0 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');

type Props = {
  terbuka: boolean;
  onTutup: () => void;
  /** Target awal (mis. dari "Pakai 3×"); 0 = kosong. */
  targetAwal?: number;
  busy: boolean;
  pesan: string | null;
  onBuat: (v: { target: number; saldo: number }) => void;
};

/** Sheet "Buat dana darurat" (mockup dana-darurat: #createView): target, saldo awal, nama tetap. */
export function SheetBuat({ terbuka, onTutup, targetAwal = 0, busy, pesan, onBuat }: Props) {
  const { t } = useTheme();
  const [target, setTarget] = useState(titik(targetAwal));
  const [saldo, setSaldo] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  function buat() {
    const tg = angka(target);
    const s = angka(saldo);
    if (tg <= 0) return setHint('Isi target dana darurat dulu.');
    if (s > tg) return setHint('Saldo awal tidak boleh melebihi target.');
    setHint(null);
    onBuat({ target: tg, saldo: s });
  }

  const baris = (ikon: NamaIkon, label: string, isi: React.ReactNode, pertama = false) => (
    <View className={`flex-row items-center gap-3 px-3.5 py-3 ${pertama ? '' : 'border-t border-line'}`}>
      <View style={{ width: 36, height: 36 }} className="items-center justify-center rounded-xl bg-card2">
        <Ikon nama={ikon} ukuran={18} warna={t.fg2} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans text-[11.5px] font-semibold text-mid">{label}</Text>
        {isi}
      </View>
    </View>
  );
  const isian = (testID: string, label: string, nilai: string, ubah: (s: string) => void) => (
    <TextInput
      testID={testID}
      accessibilityLabel={label}
      value={nilai}
      onChangeText={(s) => {
        ubah(titik(angka(s)));
        setHint(null);
      }}
      keyboardType="number-pad"
      placeholder="0"
      placeholderTextColor={t.mid}
      editable={!busy}
      style={{ fontVariant: ['tabular-nums'], color: t.fg, padding: 0 }}
      className="font-sans text-[16px] font-semibold"
    />
  );

  return (
    <SheetBawah terbuka={terbuka} onTutup={onTutup} testID="sheet-buat-darurat">
      <View className="flex-row items-center gap-3">
        <View style={{ width: 42, height: 42 }} className="items-center justify-center rounded-[14px] bg-accsoft">
          <Ikon nama="ui-shield" ukuran={21} warna={t.accInk} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-[10.5px] font-semibold tracking-[0.12em] text-mid">BARU</Text>
          <Text accessibilityRole="header" className="font-sans text-base font-semibold text-fg">
            Buat dana darurat
          </Text>
          <Text className="font-sans text-xs text-fg2">Tentukan target dan saldo awal</Text>
        </View>
      </View>
      <View className="overflow-hidden rounded-[18px] border border-line bg-card">
        {baris('ui-shield', 'Target (Rp)', isian('buat-target', 'Target', target, setTarget), true)}
        {baris('ui-money', 'Saldo awal (Rp)', isian('buat-saldo', 'Saldo awal', saldo, setSaldo))}
        {baris(
          'wallet-darurat',
          'Nama dompet',
          <Text className="font-sans text-[16px] font-semibold text-fg">{NAMA_DANA_DARURAT}</Text>,
        )}
      </View>
      {hint || pesan ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-[12.5px] font-semibold text-dangerink">
          {hint ?? pesan}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Tombol label="Batal" disabled={busy} onPress={onTutup} />
        </View>
        <View className="flex-1">
          <Tombol label="Buat" primary busy={busy} disabled={busy} onPress={buat} />
        </View>
      </View>
    </SheetBawah>
  );
}
