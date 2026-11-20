import { Pressable, Text, View } from 'react-native';

type Props<T extends string> = {
  pilihan: { nilai: T; label: string }[];
  nilai: T;
  onChange: (v: T) => void;
  testID?: string;
};

// Kontrol segmen (mockup arta: .segmented): latar card2, segmen terpilih memakai segActive.
export function Segmented<T extends string>({ pilihan, nilai, onChange, testID }: Props<T>) {
  return (
    <View testID={testID} className="flex-row gap-[3px] rounded-xl bg-card2 p-[3px]">
      {pilihan.map((p) => {
        const aktif = p.nilai === nilai;
        return (
          <Pressable
            key={p.nilai}
            accessibilityRole="button"
            accessibilityLabel={p.label}
            accessibilityState={{ selected: aktif }}
            onPress={() => onChange(p.nilai)}
            style={{ minHeight: 38 }}
            className={`flex-1 items-center justify-center rounded-[9px] px-2 ${aktif ? 'bg-segactive' : ''}`}
          >
            <Text className={`font-sans text-[13px] font-semibold ${aktif ? 'text-fg' : 'text-fg2'}`}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
