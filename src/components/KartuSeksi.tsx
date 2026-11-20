import { Pressable, Text, View } from 'react-native';

type Props = {
  judul: string;
  /** Pil kecil di kanan judul. Dengan onTag menjadi tombol (mis. "Hari ini"). */
  tag?: string;
  onTag?: () => void;
  children?: React.ReactNode;
  testID?: string;
};

// Kartu seksi putih bergaris (mockup arta: .card + .card-head + .pill-tag).
export function KartuSeksi({ judul, tag, onTag, children, testID }: Props) {
  return (
    <View testID={testID} className="rounded-[20px] border border-line bg-card px-4 pb-4 pt-[15px]">
      <View className="flex-row items-center gap-2.5">
        <Text accessibilityRole="header" className="flex-1 font-sans text-[15.5px] font-semibold text-fg">
          {judul}
        </Text>
        {tag ? (
          onTag ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tag}
              onPress={onTag}
              hitSlop={6}
              className="rounded-full bg-accsoft px-3 py-1.5"
            >
              <Text className="font-sans text-[11.5px] font-bold text-accink">{tag}</Text>
            </Pressable>
          ) : (
            <View className="rounded-full bg-accsoft px-3 py-1.5">
              <Text className="font-sans text-[11.5px] font-bold text-accink">{tag}</Text>
            </View>
          )
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Label kecil huruf kapital di dalam kartu (mockup: .sub-label). */
export function LabelSub({ children }: { children: string }) {
  return <Text className="mb-2 mt-4 font-sans text-[11.5px] font-semibold uppercase tracking-[0.8px] text-mid">{children}</Text>;
}
