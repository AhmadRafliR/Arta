import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

// Siklus & kurva dari docs/design/arta/splash-mark.svg (keyframes coinDrop / slotPulse, 1.8s).
const SIKLUS = 1800;
const KURVA = Easing.bezier(0.4, 0, 0.2, 1);
const KURVA_GLOW = Easing.bezier(0.42, 0, 0.58, 1); // ease-in-out CSS
const durasi = (persen: number) => (SIKLUS * persen) / 100;

// Koordinat viewBox 512: koin r=17 di (267,132), glow slot 108×44 di (213,136).
const KOIN = { cx: 267, cy: 132, r: 17 };
const GLOW = { x: 213, y: 136, width: 108, height: 44, rx: 22 };
const JATUH_DARI = -58;

/**
 * Mark memuat: mark celengan arta dengan koin yang jatuh ke slot dan glow slot berdenyut.
 * Koin & glow dianimasikan sebagai Animated.View absolut di atas Svg (hanya transform + opacity),
 * supaya berjalan di UI thread dan andal juga di web. Glow ditaruh di atas badan: warnanya sama
 * dengan aksen slot, jadi hasilnya tampak sebagai halo di sekitar slot.
 */
export function MarkMuat({ ukuran = 72 }: { ukuran?: number }) {
  const { mode } = useTheme();
  const gelap = mode === 'gelap';
  const badan = gelap ? '#F2F7F8' : 'url(#muatGrad)';
  const aksen = gelap ? '#0B424F' : '#52C3BF';
  const s = ukuran / 512;

  const kurangiGerak = useReducedMotion();
  // Satuan viewBox (bukan piksel) agar perubahan `ukuran` tidak mengacaukan animasi berjalan.
  const jatuh = useSharedValue(kurangiGerak ? 0 : JATUH_DARI);
  const skala = useSharedValue(kurangiGerak ? 1 : 0.7);
  const opasitas = useSharedValue(kurangiGerak ? 1 : 0);
  const glow = useSharedValue(kurangiGerak ? 0.35 : 0.22);

  useEffect(() => {
    if (kurangiGerak) {
      // Tanpa animasi: koin diam di slot, glow redup tetap.
      jatuh.set(0);
      skala.set(1);
      opasitas.set(1);
      glow.set(0.35);
      return;
    }
    jatuh.set(JATUH_DARI);
    skala.set(0.7);
    opasitas.set(0);
    glow.set(0.22);
    // 0% → 62%: turun & membesar; 62% → 100%: diam di slot.
    jatuh.set(
      withRepeat(
        withSequence(
          withTiming(0, { duration: durasi(62), easing: KURVA }),
          withTiming(0, { duration: durasi(38) }),
        ),
        -1,
      ),
    );
    // .7 → 1 (0–62%), tahan (62–80%), mengecil lagi ke .7 (80–100%).
    skala.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: durasi(62), easing: KURVA }),
          withTiming(1, { duration: durasi(18) }),
          withTiming(0.7, { duration: durasi(20), easing: KURVA }),
        ),
        -1,
      ),
    );
    // Muncul (0–22%), tampak (22–62%), memudar (62–80%), hilang (80–100%).
    opasitas.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: durasi(22), easing: KURVA }),
          withTiming(1, { duration: durasi(40) }),
          withTiming(0, { duration: durasi(18), easing: KURVA }),
          withTiming(0, { duration: durasi(20) }),
        ),
        -1,
      ),
    );
    glow.set(
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: durasi(55), easing: KURVA_GLOW }),
          withTiming(0.22, { duration: durasi(45), easing: KURVA_GLOW }),
        ),
        -1,
      ),
    );
    return () => {
      cancelAnimation(jatuh);
      cancelAnimation(skala);
      cancelAnimation(opasitas);
      cancelAnimation(glow);
    };
  }, [kurangiGerak, jatuh, skala, opasitas, glow]);

  const gayaKoin = useAnimatedStyle(() => ({
    opacity: opasitas.get(),
    transform: [{ translateY: jatuh.get() * s }, { scale: skala.get() }],
  }));
  const gayaGlow = useAnimatedStyle(() => ({ opacity: glow.get() }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Memuat"
      style={{ width: ukuran, height: ukuran }}
    >
      <Svg style={StyleSheet.absoluteFill} width={ukuran} height={ukuran} viewBox="0 0 512 512">
        <Defs>
          <LinearGradient id="muatGrad" x1="95" y1="106" x2="417" y2="406" gradientUnits="userSpaceOnUse">
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
      <Animated.View
        testID="glow-muat"
        style={[
          {
            position: 'absolute',
            left: GLOW.x * s,
            top: GLOW.y * s,
            width: GLOW.width * s,
            height: GLOW.height * s,
            borderRadius: GLOW.rx * s,
            backgroundColor: aksen,
          },
          gayaGlow,
        ]}
      />
      <Animated.View
        testID="koin-muat"
        style={[
          {
            position: 'absolute',
            left: (KOIN.cx - KOIN.r) * s,
            top: (KOIN.cy - KOIN.r) * s,
            width: KOIN.r * 2 * s,
            height: KOIN.r * 2 * s,
            borderRadius: KOIN.r * s,
            backgroundColor: aksen,
          },
          gayaKoin,
        ]}
      />
    </View>
  );
}
