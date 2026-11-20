import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { IKON, type Elemen, type NamaIkon } from './data';

type Props = { nama: NamaIkon; ukuran?: number; warna?: string };

function gambar(e: Elemen, i: number, warna: string) {
  // Kelas `ln` = garis monoline; `fill` = isi warna tanpa garis.
  const gaya =
    e.kelas === 'ln'
      ? {
          fill: 'none',
          stroke: warna,
          strokeWidth: 1.75,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
        }
      : { fill: warna, stroke: 'none' };
  const attr = e.attr as Record<string, string>;
  if (e.tag === 'path') return <Path key={i} {...attr} {...gaya} />;
  if (e.tag === 'circle') return <Circle key={i} {...attr} {...gaya} />;
  return <Rect key={i} {...attr} {...gaya} />;
}

/** Ikon dekoratif; label aksesibilitas ada di komponen induknya. */
export function Ikon({ nama, ukuran = 24, warna }: Props) {
  const { t } = useTheme();
  const w = warna ?? t.fg;
  return (
    <Svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      accessible={false}
      testID={`ikon-${nama}`}
    >
      {IKON[nama].map((e, i) => gambar(e, i, w))}
    </Svg>
  );
}
