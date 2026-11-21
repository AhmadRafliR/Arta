import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MarkArta } from '@/components/MarkArta';
import { useTheme } from '@/theme/ThemeProvider';

const LEBAR_BAR = 148;
export const DURASI_OVERLAY = 1200;

/** Overlay singkat "Akun siap" (akun.html: .overlay): ± 1,2 dtk dengan progress tipis; tanpa animasi -> langsung tutup. */
export function OverlayAkunSiap({ onSelesai }: { onSelesai: () => void }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const kurangiGerak = useReducedMotion();
  const p = useSharedValue(0);
  const gayaBar = useAnimatedStyle(() => ({ width: p.value * LEBAR_BAR }));

  useEffect(() => {
    if (kurangiGerak) {
      onSelesai();
      return;
    }
    p.value = withTiming(1, { duration: DURASI_OVERLAY - 200, easing: Easing.linear });
    const id = setTimeout(onSelesai, DURASI_OVERLAY);
    return () => clearTimeout(id);
  }, [kurangiGerak, onSelesai, p]);

  return (
    <View
      accessibilityViewIsModal
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      className="flex-1 items-center justify-center bg-bg p-7"
    >
      <View className="items-center gap-[14px]">
        <LinearGradient
          colors={[t.heroFrom, t.heroTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 78, height: 78, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}
        >
          <View
            style={{ width: 62, height: 62, borderRadius: 20, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}
          >
            <MarkArta ukuran={46} dekoratif />
          </View>
        </LinearGradient>
        <Text accessibilityRole="header" className="text-xl font-bold text-fg font-sans" style={{ letterSpacing: -0.5 }}>
          Akun siap
        </Text>
        <Text className="max-w-[240px] text-center text-[12.5px] leading-[19px] text-fg2 font-sans">
          Tinggal satu langkah: beri tahu uangmu ada di mana.
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Menyiapkan"
          style={{ width: LEBAR_BAR, height: 4, borderColor: t.line, backgroundColor: t.card2 }}
          className="mt-1 overflow-hidden rounded-full border"
        >
          <Animated.View style={[{ height: 4, borderRadius: 4, backgroundColor: t.accInk }, gayaBar]} />
        </View>
      </View>
    </View>
  );
}
