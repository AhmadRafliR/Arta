import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { label: string; onPress: () => void; disabled?: boolean; primary?: boolean; busy?: boolean };

// Tombol penuh lebar. Aksen hanya untuk tombol utama (primary).
export function Tombol({ label, onPress, disabled, primary, busy }: Props) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={`items-center rounded-xl py-3 ${primary ? 'bg-acc' : 'border border-line'} ${disabled ? 'opacity-50' : ''}`}
    >
      {busy ? (
        <ActivityIndicator color={primary ? t.accFg : t.fg} />
      ) : (
        <Text style={primary ? { color: t.accFg } : undefined} className={`font-sans font-semibold ${primary ? '' : 'text-fg'}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
