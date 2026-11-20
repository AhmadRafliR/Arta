import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { formatRupiah, parseNominal } from '@/domain/money';

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
};

function parse(text: string, allowZero: boolean): number | null {
  const s = text.trim();
  if (allowZero) {
    if (s === '') return 0;
    if (/^(rp)?\s*0+$/i.test(s)) return 0;
  }
  return parseNominal(s);
}

export function AmountInput({ value, onChange, allowZero = false, editable = true, placeholder = '0', testID }: Props) {
  const [text, setText] = useState(value ? String(value) : '');
  const kosong = text.trim() === '';
  const nilai = parse(text, allowZero);
  const salah = !kosong && nilai === null;

  function ubah(v: string) {
    setText(v);
    onChange(parse(v, allowZero));
  }

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
