import Svg, { Circle, Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

type BentukRect = { x: number; y: number; width: number; height: number; rx: number };
type BentukLingkaran = { cx: number; cy: number; r: number };
type BentukCrest = { path: string; rect: BentukRect[]; lingkaran: BentukLingkaran[] };

/** Data bentuk crest premium (docs/design/arta/premium-mark.svg), koordinat viewBox 512. */
export const CREST_BADAN: BentukCrest = {
  path: 'M150 244 L150 186 L196 112 L226 186 L256 86 L286 186 L316 112 L362 186 L362 244 Z',
  rect: [
    { x: 150, y: 204, width: 212, height: 44, rx: 8 },
    { x: 167.45, y: 323.5, width: 52.8, height: 52.8, rx: 26.4 },
  ],
  lingkaran: [{ cx: 262.05, cy: 340, r: 82.5 }],
};

/** Permata, slot koin, lubang hidung, dan butir pita crest. */
export const CREST_AKSEN: BentukCrest = {
  path: 'M256 122 L282 150 L256 178 L230 150 Z',
  rect: [{ x: 238.95, y: 280.6, width: 46.2, height: 11, rx: 5.5 }],
  lingkaran: [
    { cx: 186.7, cy: 343.3, r: 4.4 },
    { cx: 186.7, cy: 356.5, r: 4.4 },
    { cx: 190, cy: 226, r: 5 },
    { cx: 223, cy: 226, r: 5 },
    { cx: 256, cy: 226, r: 5 },
    { cx: 289, cy: 226, r: 5 },
    { cx: 322, cy: 226, r: 5 },
  ],
};

/** Kotak batas crest (x 150–362, y 86–422.5) untuk viewBox yang dipangkas rapat. */
export const CREST_VIEWBOX_RAPAT = '150 86 212 337';

/** Menggambar satu kelompok bentuk crest; dipakai MarkPremium dan BadgeTier. */
export function BentukCrestSvg({ bentuk, fill }: { bentuk: BentukCrest; fill: string }) {
  return (
    <>
      <Path d={bentuk.path} fill={fill} />
      {bentuk.rect.map((r, i) => (
        <Rect key={`r${i}`} {...r} fill={fill} />
      ))}
      {bentuk.lingkaran.map((c, i) => (
        <Circle key={`c${i}`} {...c} fill={fill} />
      ))}
    </>
  );
}

/**
 * Crest premium arta. gradien: badan gradien teal + aksen mint (gelap: badan terang, aksen teal tua,
 * seperti MarkArta). mono: satu warna t.fg, aksen dilubangi lewat Mask.
 * dekoratif: sembunyikan dari pembaca layar.
 */
export function MarkPremium({
  ukuran = 52,
  varian = 'gradien',
  dekoratif = false,
}: {
  ukuran?: number;
  varian?: 'gradien' | 'mono';
  dekoratif?: boolean;
}) {
  const { mode, t } = useTheme();
  const gelap = mode === 'gelap';
  const a11y = dekoratif
    ? { accessible: false, importantForAccessibility: 'no-hide-descendants' as const }
    : { accessibilityLabel: 'Premium', accessible: true };

  if (varian === 'mono') {
    return (
      <Svg width={ukuran} height={ukuran} viewBox="0 0 512 512" {...a11y}>
        <Defs>
          <Mask id="premiumCut" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
            <Rect x="0" y="0" width="512" height="512" fill="#FFFFFF" />
            <BentukCrestSvg bentuk={CREST_AKSEN} fill="#000000" />
          </Mask>
        </Defs>
        <G mask="url(#premiumCut)">
          <BentukCrestSvg bentuk={CREST_BADAN} fill={t.fg} />
        </G>
      </Svg>
    );
  }

  const badan = gelap ? '#F2F7F8' : 'url(#premiumGrad)';
  const aksen = gelap ? '#0B424F' : '#52C3BF';
  return (
    <Svg width={ukuran} height={ukuran} viewBox="0 0 512 512" {...a11y}>
      <Defs>
        <LinearGradient id="premiumGrad" x1="150" y1="86" x2="362" y2="422" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#0B424F" />
          <Stop offset="1" stopColor="#1F6A76" />
        </LinearGradient>
      </Defs>
      <BentukCrestSvg bentuk={CREST_BADAN} fill={badan} />
      <BentukCrestSvg bentuk={CREST_AKSEN} fill={aksen} />
    </Svg>
  );
}
