import { Pressable, ScrollView, Text, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { ikonDompet } from '@/components/ikon/peta';
import type { FilterTx } from '@/lib/filterTx';
import type { Jenis, TipeDompet } from '@/domain/types';

const JENIS: { nilai: Jenis; label: string }[] = [
  { nilai: 'pengeluaran', label: 'Pengeluaran' },
  { nilai: 'pemasukan', label: 'Pemasukan' },
  { nilai: 'transfer', label: 'Transfer' },
  { nilai: 'hutang_baru', label: 'Hutang baru' },
  { nilai: 'hutang_bayar', label: 'Bayar hutang' },
  { nilai: 'penyesuaian', label: 'Penyesuaian' },
];

type Props = {
  filter: FilterTx;
  onChange: (f: FilterTx) => void;
  kategori: string[];
  /** `tipe` opsional: bila ada, chip dompet memakai ikon sesuai tipe dompet. */
  dompet: { id: string; nama: string; tipe?: TipeDompet }[];
};

/** Ada filter yang sedang aktif? */
export function adaFilter(f: FilterTx): boolean {
  return !!(f.jenis || f.kategori || f.walletId);
}

// Rel chip horizontal (mockup: .rail-wrap): label kecil kapital + chip bergulir sampai tepi layar.
function Rel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="font-sans text-[11px] font-semibold uppercase tracking-[1px] text-mid">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 1, gap: 7 }}
        accessibilityLabel={label}
      >
        {children}
      </ScrollView>
    </View>
  );
}

// Chip menyala/mati: menekan chip terpilih melepas filternya; chip "Semua" melepas filter rel itu.
export function RiwayatFilter({ filter, onChange, kategori, dompet }: Props) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2 px-px pt-0.5">
        <Text className="font-sans text-[13px] font-semibold uppercase tracking-[0.5px] text-mid">Filter</Text>
        {adaFilter(filter) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset filter"
            testID="f-reset"
            onPress={() => onChange({})}
            hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
            style={{ minHeight: 28 }}
            className="ml-auto justify-center px-0.5"
          >
            <Text className="font-sans text-[12.5px] font-bold text-accink underline">Reset</Text>
          </Pressable>
        ) : null}
      </View>
      <Rel label="Jenis">
        <Chip testID="f-jenis-semua" label="Semua" selected={!filter.jenis} onPress={() => onChange({ ...filter, jenis: undefined })} />
        {JENIS.map((j) => (
          <Chip
            key={j.nilai}
            testID={`f-jenis-${j.nilai}`}
            label={j.label}
            selected={filter.jenis === j.nilai}
            onPress={() => onChange({ ...filter, jenis: filter.jenis === j.nilai ? undefined : j.nilai })}
          />
        ))}
      </Rel>
      {kategori.length > 0 ? (
        <Rel label="Kategori">
          <Chip
            testID="f-kat-semua"
            label="Semua"
            selected={!filter.kategori}
            onPress={() => onChange({ ...filter, kategori: undefined })}
          />
          {kategori.map((k) => (
            <Chip
              key={k}
              testID={`f-kat-${k}`}
              label={k}
              selected={filter.kategori === k}
              onPress={() => onChange({ ...filter, kategori: filter.kategori === k ? undefined : k })}
            />
          ))}
        </Rel>
      ) : null}
      {dompet.length > 0 ? (
        <Rel label="Dompet">
          <Chip
            testID="f-dompet-semua"
            label="Semua"
            selected={!filter.walletId}
            onPress={() => onChange({ ...filter, walletId: undefined })}
          />
          {dompet.map((w) => (
            <Chip
              key={w.id}
              testID={`f-dompet-${w.id}`}
              label={w.nama}
              ikon={ikonDompet(w.tipe ?? 'harian')}
              selected={filter.walletId === w.id}
              onPress={() => onChange({ ...filter, walletId: filter.walletId === w.id ? undefined : w.id })}
            />
          ))}
        </Rel>
      ) : null}
    </View>
  );
}
