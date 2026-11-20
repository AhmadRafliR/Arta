import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

/** Mark arta (dari kit.html): badan gradien + aksen; gelap memakai badan terang. */
export function MarkArta({ ukuran = 52 }: { ukuran?: number }) {
  const { mode } = useTheme();
  const gelap = mode === 'gelap';
  const badan = gelap ? '#F2F7F8' : 'url(#brandGrad)';
  const aksen = gelap ? '#0B424F' : '#52C3BF';
  return (
    <Svg width={ukuran} height={ukuran} viewBox="0 0 512 512" accessibilityLabel="arta" accessible>
      <Defs>
        <LinearGradient id="brandGrad" x1="95" y1="106" x2="417" y2="406" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#0B424F" />
          <Stop offset="1" stopColor="#1F6A76" />
        </LinearGradient>
      </Defs>
      <G fill={badan}>
        <Circle cx="267" cy="256" r="150" />
        <Rect x="95" y="226" width="96" height="96" rx="48" />
      </G>
      <G fill={aksen}>
        <Rect x="225" y="148" width="84" height="20" rx="10" />
        <Circle cx="130" cy="262" r="8" />
        <Circle cx="130" cy="286" r="8" />
      </G>
    </Svg>
  );
}
