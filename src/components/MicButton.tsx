import { Pressable, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

// Tombol mic bulat 52px, warna aksen, menonjol di tengah tab bar.
export function MicButton({ onPress }: { onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Catat transaksi"
      onPress={onPress}
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: t.acc,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -30,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <Text style={{ color: t.accFg, fontSize: 22 }}>🎙</Text>
    </Pressable>
  );
}
