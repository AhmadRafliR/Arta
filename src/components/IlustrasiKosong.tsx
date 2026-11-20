import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

export type JenisIlustrasi = 'transaksi' | 'hutang' | 'laporan';

// Ujung gradien "tint" per jenis, sama dengan SVG desainer (docs/design/arta/empty-*.svg).
const GRADIEN: Record<JenisIlustrasi, { x1: number; y1: number; x2: number; y2: number }> = {
  transaksi: { x1: 150, y1: 128, x2: 256, y2: 238 },
  hutang: { x1: 74, y1: 44, x2: 246, y2: 216 },
  laporan: { x1: 168, y1: 112, x2: 204, y2: 196 },
};

/** Ilustrasi keadaan kosong (viewBox 320x260). Dekoratif: disembunyikan dari pembaca layar. */
export function IlustrasiKosong({ jenis, lebar = 160 }: { jenis: JenisIlustrasi; lebar?: number }) {
  const { t } = useTheme();
  // Id gradien unik per jenis agar tidak bentrok bila dua ilustrasi tampil bersamaan.
  const idTint = `ilusTint-${jenis}`;
  const g = GRADIEN[jenis];
  const garis = { fill: 'none', stroke: t.ilusGaris, strokeWidth: 6, strokeLinecap: 'round' as const, strokeOpacity: 0.55 };
  const bingkai = {
    fill: 'none',
    stroke: t.ilusGaris,
    strokeWidth: 5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeOpacity: 0.4,
  };
  return (
    <Svg
      testID={`ilustrasi-${jenis}`}
      width={lebar}
      height={(lebar * 260) / 320}
      viewBox="0 0 320 260"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id={idTint} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={t.ilusTintFrom} />
          <Stop offset="1" stopColor={t.ilusTintTo} />
        </LinearGradient>
      </Defs>
      {jenis === 'transaksi' ? (
        <>
          <Rect {...bingkai} x="66" y="30" width="152" height="200" rx="24" />
          <Path {...garis} d="M96 72 H188" />
          <Path {...garis} d="M96 106 H166" />
          <Path {...garis} d="M96 140 H188" />
          <Path {...garis} d="M96 174 H150" />
          <Circle fill={`url(#${idTint})`} cx="222" cy="186" r="44" />
          <Path fill="none" stroke={t.ilusAksen} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" d="M222 168 V204" />
          <Path fill="none" stroke={t.ilusAksen} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" d="M204 186 H240" />
        </>
      ) : jenis === 'hutang' ? (
        <>
          <Circle fill={`url(#${idTint})`} cx="160" cy="130" r="88" />
          <Path
            fill="none"
            stroke={t.ilusOnTint}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M112 118 L160 94 L208 118 V180 A10 10 0 0 1 198 190 H122 A10 10 0 0 1 112 180 Z"
          />
          <Path fill="none" stroke={t.ilusAksen} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" d="M142 138 L158 154 L182 124" />
        </>
      ) : (
        <>
          <Rect {...bingkai} x="84" y="34" width="152" height="192" rx="20" />
          <Path {...garis} d="M110 74 H210" />
          <Path {...garis} d="M110 102 H180" />
          <Rect fill={t.ilusGaris} fillOpacity={0.4} x="110" y="132" width="18" height="60" rx="8" />
          <Rect fill={t.ilusGaris} fillOpacity={0.4} x="142" y="152" width="18" height="40" rx="8" />
          <Rect fill={`url(#${idTint})`} x="174" y="118" width="18" height="74" rx="8" />
          <Circle fill={t.ilusAksen} cx="222" cy="62" r="11" />
        </>
      )}
    </Svg>
  );
}
