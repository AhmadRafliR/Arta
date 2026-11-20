import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  /** Tombol sekunder bernada bahaya (hapus, keluar): garis dan teks danger. */
  bahaya?: boolean;
  busy?: boolean;
};

// Tombol penuh lebar (mockup arta: .btn-primary / .btn-sheet). Aksen hanya untuk tombol utama (primary).
export function Tombol({ label, onPress, disabled, primary, bahaya, busy }: Props) {
  const { t } = useTheme();
  const warnaTeks = primary ? t.accFg : bahaya ? t.dangerInk : t.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 52, borderRadius: 14 }}
      className={`items-center justify-center px-6 ${
        primary ? 'bg-acc' : bahaya ? 'border border-dangersoft bg-card' : 'border border-line bg-card'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {busy ? (
        <ActivityIndicator color={warnaTeks} />
      ) : (
        <Text style={{ color: warnaTeks, fontSize: 16 }} className={`font-sans ${primary ? 'font-bold' : 'font-semibold'}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
