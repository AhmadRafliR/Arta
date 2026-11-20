import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { ikonKategori } from '@/components/ikon/peta';
import type { DrafTx } from '@/ai/tipe';
import { formatRupiah } from '@/domain/money';
import { labelTanggalRelatif } from '@/lib/labelTanggal';
import { useTheme } from '@/theme/ThemeProvider';

const LABEL: Record<DrafTx['jenis'], string> = {
  pemasukan: 'Pemasukan',
  pengeluaran: 'Pengeluaran',
  transfer: 'Transfer',
};

const kapital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Peringatan yang ditampilkan: dari AI, ditambah dompet yang masih kosong. */
export function peringatanDraf(d: DrafTx): string[] {
  const out = [...d.peringatan];
  const sebutDompet = out.some((p) => p.toLowerCase().includes('dompet'));
  if (!d.wallet_id && !sebutDompet) out.push('Pilih dompet');
  if (d.jenis === 'transfer' && !d.wallet_tujuan_id && !sebutDompet) out.push('Pilih dompet tujuan');
  return out;
}

type Props = {
  draf: DrafTx;
  namaDompet: (id: string | null) => string | null;
  hariIni: string;
  onPress: () => void;
  onHapus: () => void;
};

// Baris draf hasil AI, bergaya TxRow. Ketuk untuk mengubah; ikon hapus membuang baris.
export function BarisDraf({ draf: d, namaDompet, hariIni, onPress, onHapus }: Props) {
  const { t } = useTheme();
  const kategori = d.jenis === 'transfer' ? null : kapital(d.kategori);
  const judul = d.catatan ?? kategori ?? LABEL[d.jenis];
  const asal = namaDompet(d.wallet_id) ?? 'Pilih dompet';
  const dompet = d.jenis === 'transfer' ? `${asal} → ${namaDompet(d.wallet_tujuan_id) ?? 'Pilih tujuan'}` : asal;
  const meta = [kategori ?? LABEL[d.jenis], dompet, labelTanggalRelatif(d.tanggal, hariIni)].join(' · ');
  const masuk = d.jenis === 'pemasukan';
  const tanda = masuk ? '+' : d.jenis === 'pengeluaran' ? '-' : '';
  const peringatan = peringatanDraf(d);
  const ada = peringatan.length > 0;
  return (
    <View className={`flex-row items-center gap-2 ${ada ? 'border-l-2 pl-2' : ''}`} style={ada ? { borderLeftColor: t.warnInk } : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ubah ${judul}`}
        testID={`draf-${d.id}`}
        onPress={onPress}
        className="flex-1 flex-row items-center gap-3 py-2.5"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-card2">
          <Ikon nama={ikonKategori(d.jenis === 'transfer' ? null : d.kategori)} ukuran={22} warna={t.fg2} />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-fg font-sans" numberOfLines={1}>
            {judul}
          </Text>
          <Text className="text-[12.5px] text-fg2 font-sans" numberOfLines={1}>
            {meta}
          </Text>
          {peringatan.map((p) => (
            <View key={p} className="mt-0.5 flex-row items-center gap-1">
              <Ikon nama="status-budget-waspada" ukuran={13} warna={t.warnInk} />
              <Text className="flex-1 text-[12px] text-warnink font-sans">{p}</Text>
            </View>
          ))}
        </View>
        <Text className={`font-sans text-[15px] font-semibold ${masuk ? 'text-accink' : 'text-fg'}`}>
          {`${tanda}${formatRupiah(d.nominal)}`}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Hapus ${judul}`}
        testID={`hapus-${d.id}`}
        onPress={onHapus}
        hitSlop={8}
        className="p-2"
      >
        <Ikon nama="act-hapus" ukuran={20} warna={t.mid} />
      </Pressable>
    </View>
  );
}
