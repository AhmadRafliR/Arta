import { useState } from 'react';
import { Text, View } from 'react-native';
import { AmountInput } from '@/components/AmountInput';
import { Chip } from '@/components/Chip';
import { KepalaSheet, SheetBawah } from '@/components/SheetBawah';
import { Tombol } from '@/components/Tombol';
import { formatRupiah } from '@/domain/money';

type Props = {
  terbuka: boolean;
  onTutup: () => void;
  saldo: number;
  target: number | null;
  /** Rata-rata pengeluaran bulanan; dasar chip 3×/6×/12×. Null = tanpa chip. */
  rata: number | null;
  busy: boolean;
  pesan: string | null;
  /** target null = hapus target. */
  onSimpan: (target: number | null) => void;
};

/** Sheet "Ubah target dana darurat" (mockup dana-darurat: #targetView). Isi 0 untuk menghapus target. */
export function SheetTarget({ terbuka, onTutup, saldo, target, rata, busy, pesan, onSimpan }: Props) {
  const [nilai, setNilai] = useState<number | null>(target ?? 0);
  const [versi, setVersi] = useState(0);
  const [awal, setAwal] = useState<number | null>(target);
  const v = nilai ?? 0;
  const bulan = rata && rata > 0 ? v / rata : null;
  const sisa = Math.max(0, v - saldo);
  const kurang = v > 0 && v < saldo ? `Saldo sekarang sudah ${formatRupiah(saldo)}, target jangan di bawah itu.` : null;
  const pilih = (n: number) => {
    setAwal(n);
    setNilai(n);
    setVersi((x) => x + 1);
  };
  const baris = (k: string, val: string) => (
    <View key={k} className="flex-row items-center justify-between gap-3">
      <Text className="font-sans text-[12.5px] text-mid">{k}</Text>
      <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[12.5px] font-bold text-fg">
        {val}
      </Text>
    </View>
  );
  return (
    <SheetBawah terbuka={terbuka} onTutup={onTutup} testID="sheet-target">
      <KepalaSheet
        ikon="ui-shield"
        judul="Ubah target dana darurat"
        sub={`Sekarang ${target ? formatRupiah(target) : 'belum ada'} · terkumpul ${formatRupiah(saldo)}`}
      />
      <View className="gap-2 rounded-[16px] border border-line bg-card2 p-3">
        <Text className="font-sans text-[11.5px] font-semibold text-mid">Target baru</Text>
        <AmountInput key={versi} value={awal} allowZero onChange={setNilai} editable={!busy} testID="target-baru" />
        {rata ? (
          <View className="flex-row flex-wrap gap-2">
            {[3, 6, 12].map((k) => {
              const n = Math.round(rata * k);
              return <Chip key={k} label={formatRupiah(n)} selected={v === n} onPress={() => pilih(n)} />;
            })}
          </View>
        ) : null}
        <Text className="font-sans text-xs text-mid">Isi 0 untuk menghapus target.</Text>
      </View>
      <View className="gap-1.5 rounded-[16px] border border-line bg-card p-3">
        {bulan !== null
          ? baris('Setara pengeluaran', `${(Math.round(bulan * 10) / 10).toString().replace('.', ',')} bulan`)
          : null}
        {baris('Sisa yang perlu disisihkan', v > 0 ? (sisa === 0 ? 'Sudah tercapai' : formatRupiah(sisa)) : '—')}
      </View>
      {kurang || pesan ? <Text className="font-sans text-[12.5px] text-dangerink">{kurang ?? pesan}</Text> : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Tombol label="Batal" onPress={onTutup} />
        </View>
        <View className="flex-1">
          <Tombol
            label="Simpan target"
            primary
            busy={busy}
            disabled={busy || nilai === null || kurang !== null}
            onPress={() => onSimpan(v === 0 ? null : v)}
          />
        </View>
      </View>
    </SheetBawah>
  );
}
