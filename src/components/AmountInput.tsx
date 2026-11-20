import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { formatRupiah, parseNominal } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  /** Nilai awal; teks isian dipegang komponen ini. */
  value: number | null;
  /** null = tidak valid (atau kosong bila allowZero=false). */
  onChange: (n: number | null) => void;
  /** Izinkan 0 dan isian kosong (dihitung 0), mis. saldo awal dompet. */
  allowZero?: boolean;
  editable?: boolean;
  placeholder?: string;
  testID?: string;
  /**
   * 'bawaan' = kotak isian bergaris biasa. 'hero' = angka besar 40px dengan awalan "Rp" untuk dipasang di dalam
   * kartu bergradien (mockup catat: .amount-card); warna teks mengikuti token hero.
   */
  varian?: 'bawaan' | 'hero';
};

function parse(text: string, allowZero: boolean): number | null {
  const s = text.trim();
  if (allowZero) {
    if (s === '') return 0;
    if (/^(rp)?\s*0+$/i.test(s)) return 0;
  }
  return parseNominal(s);
}

type IsianProps = {
  text: string;
  ubah: (v: string) => void;
  salah: boolean;
  nilai: number | null;
  kosong: boolean;
  editable: boolean;
  placeholder: string;
  testID?: string;
};

function IsianBawaan({ text, ubah, salah, nilai, kosong, editable, placeholder, testID }: IsianProps) {
  return (
    <View>
      <TextInput
        value={text}
        onChangeText={ubah}
        placeholder={placeholder}
        keyboardType="default"
        autoCapitalize="none"
        testID={testID}
        editable={editable}
        className={`font-sans rounded-xl border bg-card px-4 py-3 text-fg ${salah ? 'border-fg' : 'border-line'}`}
      />
      {salah ? (
        <Text className="mt-1 text-xs text-fg font-sans">Nominal tidak valid</Text>
      ) : nilai !== null && !kosong ? (
        <Text className="mt-1 text-xs text-mid font-sans">{formatRupiah(nilai)}</Text>
      ) : null}
    </View>
  );
}

// Varian hero memakai useTheme; dipisah agar varian bawaan tetap bisa dirender tanpa ThemeProvider (tes lama).
function IsianHero({ text, ubah, salah, nilai, kosong, editable, placeholder, testID }: IsianProps) {
  const { t } = useTheme();
  return (
    <View>
      <View className="mt-1.5 flex-row items-baseline gap-[7px]">
        <Text style={{ color: t.heroFg, opacity: 0.82 }} className="font-sans text-xl font-semibold"
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          Rp
        </Text>
        <TextInput
          value={text}
          onChangeText={ubah}
          placeholder={placeholder}
          placeholderTextColor={t.amSub}
          keyboardType="default"
          autoCapitalize="none"
          accessibilityLabel="Nominal"
          testID={testID}
          editable={editable}
          selectionColor={t.heroFg}
          cursorColor={t.heroFg}
          style={{ color: t.heroFg, fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'], letterSpacing: -0.8 }}
          className="min-w-0 flex-1 p-0 font-sans font-semibold"
        />
      </View>
      {salah ? (
        <Text style={{ color: t.heroFg }} className="mt-1 font-sans text-xs font-semibold">
          Nominal tidak valid
        </Text>
      ) : nilai !== null && !kosong ? (
        <Text style={{ color: t.amSub }} className="mt-1 font-sans text-xs">
          {formatRupiah(nilai)}
        </Text>
      ) : null}
    </View>
  );
}

export function AmountInput({
  value,
  onChange,
  allowZero = false,
  editable = true,
  placeholder = '0',
  testID,
  varian = 'bawaan',
}: Props) {
  const [text, setText] = useState(value ? String(value) : '');
  const kosong = text.trim() === '';
  const nilai = parse(text, allowZero);
  const salah = !kosong && nilai === null;

  function ubah(v: string) {
    setText(v);
    onChange(parse(v, allowZero));
  }

  const p: IsianProps = { text, ubah, salah, nilai, kosong, editable, placeholder, testID };
  return varian === 'hero' ? <IsianHero {...p} /> : <IsianBawaan {...p} />;
}
