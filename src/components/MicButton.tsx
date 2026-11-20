import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { Ikon } from '@/components/ikon/Ikon';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  onPress: () => void;
  /** Ukuran/posisi dikendalikan TabBar (gaya animasi); bawaan 56px menonjol ke atas. */
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
};

// Tombol mic bulat warna aksen di tengah tab bar.
export function MicButton({ onPress, style }: Props) {
  const { t } = useTheme();
  return (
    <Animated.View
      style={[
        {
          width: 56,
          height: 56,
          marginTop: -30,
          borderRadius: 999,
          backgroundColor: t.acc,
          elevation: 8,
          shadowColor: t.acc,
          shadowOpacity: 0.4,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
        },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Catat transaksi"
        onPress={onPress}
        style={{ flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ikon nama="nav-mic" ukuran={26} warna={t.accFg} />
      </Pressable>
    </Animated.View>
  );
}
