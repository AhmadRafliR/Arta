import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { label: string; onPress: () => void; disabled?: boolean; primary?: boolean; busy?: boolean };

// Tombol penuh lebar (gaya .btn-primary). Aksen hanya untuk tombol utama (primary).
export function Tombol({ label, onPress, disabled, primary, busy }: Props) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 54 }}
      className={`items-center justify-center rounded-2xl px-6 ${primary ? 'bg-acc' : 'border border-line'} ${disabled ? 'opacity-50' : ''}`}
    >
      {busy ? (
        <ActivityIndicator color={primary ? t.accFg : t.fg} />
      ) : (
        <Text
          style={primary ? { color: t.accFg, fontSize: 16 } : { fontSize: 16 }}
          className={`font-sans ${primary ? 'font-bold' : 'font-semibold text-fg'}`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
