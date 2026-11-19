import { ScrollView } from 'react-native';
import { Chip } from '@/components/Chip';
import type { FilterTx } from '@/lib/filterTx';
import type { Jenis } from '@/domain/types';

const JENIS: { nilai: Jenis; label: string }[] = [
  { nilai: 'pemasukan', label: 'Pemasukan' },
  { nilai: 'pengeluaran', label: 'Pengeluaran' },
  { nilai: 'transfer', label: 'Transfer' },
  { nilai: 'hutang_baru', label: 'Hutang baru' },
  { nilai: 'hutang_bayar', label: 'Bayar hutang' },
  { nilai: 'penyesuaian', label: 'Penyesuaian' },
];

type Props = {
  filter: FilterTx;
  onChange: (f: FilterTx) => void;
  kategori: string[];
  dompet: { id: string; nama: string }[];
};

function Baris({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {children}
    </ScrollView>
  );
}

// Chip menyala/mati: menekan chip terpilih melepas filternya.
export function RiwayatFilter({ filter, onChange, kategori, dompet }: Props) {
  return (
    <>
      <Baris>
        {JENIS.map((j) => (
          <Chip
            key={j.nilai}
            testID={`f-jenis-${j.nilai}`}
            label={j.label}
            selected={filter.jenis === j.nilai}
            onPress={() => onChange({ ...filter, jenis: filter.jenis === j.nilai ? undefined : j.nilai })}
          />
        ))}
      </Baris>
      {kategori.length > 0 ? (
        <Baris>
          {kategori.map((k) => (
            <Chip
              key={k}
              testID={`f-kat-${k}`}
              label={k}
              selected={filter.kategori === k}
              onPress={() => onChange({ ...filter, kategori: filter.kategori === k ? undefined : k })}
            />
          ))}
        </Baris>
      ) : null}
      {dompet.length > 0 ? (
        <Baris>
          {dompet.map((w) => (
            <Chip
              key={w.id}
              testID={`f-dompet-${w.id}`}
              label={w.nama}
              selected={filter.walletId === w.id}
              onPress={() => onChange({ ...filter, walletId: filter.walletId === w.id ? undefined : w.id })}
            />
          ))}
        </Baris>
      ) : null}
    </>
  );
}
