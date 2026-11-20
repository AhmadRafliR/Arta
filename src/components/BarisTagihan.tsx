import { Text, View } from 'react-native';
import { labelTanggal } from '@/components/hutang/tampilan';
import { Ikon } from '@/components/ikon/Ikon';
import { hariMenuju, labelJatuhTempo } from '@/domain/hutang';
import { formatRupiah } from '@/domain/money';
import type { Tagihan } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { tagihan: Tagihan; hariIni: string; /** Baris pertama: tanpa garis atas. */ pertama?: boolean };

// Satu baris jadwal (mockup: .sched-row): bulatan centang, tanggal + status, nominal (dicoret bila lunas).
export function BarisTagihan({ tagihan, hariIni, pertama }: Props) {
  const { t } = useTheme();
  const lunas = tagihan.status === 'lunas';
  const lewat = !lunas && hariMenuju(tagihan.jatuh_tempo, hariIni) < 0;
  return (
    <View className={`flex-row items-center gap-2.5 px-3 py-[9px] ${pertama ? '' : 'border-t border-line'}`}>
      <View
        style={{ width: 22, height: 22, borderWidth: 1.5 }}
        className={`items-center justify-center rounded-full ${lunas ? 'border-accink bg-accsoft' : 'border-line'}`}
      >
        {lunas ? <Ikon nama="ui-check" ukuran={13} warna={t.accInk} /> : null}
      </View>
      <View className="min-w-0 flex-1 gap-px">
        <Text className={`font-sans text-[12.5px] ${lunas ? 'font-medium text-fg2' : 'font-semibold text-fg'}`}>
          {labelTanggal(tagihan.jatuh_tempo)}
        </Text>
        <Text className={`font-sans text-[11px] ${lewat ? 'font-semibold text-dangerink' : 'text-mid'}`}>
          {lunas ? 'Lunas' : labelJatuhTempo(tagihan.jatuh_tempo, hariIni)}
        </Text>
      </View>
      <Text
        style={{ fontVariant: ['tabular-nums'], textDecorationLine: lunas ? 'line-through' : 'none' }}
        className={`font-sans text-[12.5px] font-semibold ${lunas ? 'text-mid' : 'text-fg'}`}
      >
        {formatRupiah(tagihan.nominal)}
      </Text>
    </View>
  );
}
