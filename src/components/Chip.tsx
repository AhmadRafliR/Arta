import { Pressable, Text } from 'react-native';

type Props = { label: string; selected: boolean; onPress: () => void; testID?: string };

// Pilihan bergaya chip. Terpilih = warna terbalik (fg/bg), bukan aksen.
export function Chip({ label, selected, onPress, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      className={`rounded-full border px-4 py-2 ${selected ? 'border-fg bg-fg' : 'border-line bg-card'}`}
    >
      <Text className={`font-sans text-sm font-semibold ${selected ? 'text-bg' : 'text-fg'}`}>{label}</Text>
    </Pressable>
  );
}
