import { Text, View } from 'react-native';
import { MarkArta } from '@/components/MarkArta';

/** Topbar: chip merek "arta" (titik berisi logo) di kiri, "Langkah n / 2" di kanan. */
export function TopbarOnboarding({ langkah }: { langkah: 1 | 2 }) {
  return (
    <View className="flex-row items-center gap-3 px-5 pb-[14px] pt-1.5">
      <View className="flex-row items-center gap-2">
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="h-[26px] w-[26px] items-center justify-center rounded-[9px] border border-line bg-card"
        >
          <MarkArta ukuran={19} dekoratif />
        </View>
        <Text className="text-[15px] font-bold text-fg font-sans" style={{ letterSpacing: -0.15 }}>
          arta
        </Text>
      </View>
      <View
        accessible
        accessibilityLabel={`Langkah ${langkah} dari 2`}
        className="ml-auto flex-row items-center rounded-full border border-line bg-card px-[11px] py-[5px]"
      >
        <Text className="text-[11.5px] font-semibold text-fg2 font-sans">
          {'Langkah '}
          <Text className="font-bold text-fg font-sans">{langkah}</Text>
          {' / 2'}
        </Text>
      </View>
    </View>
  );
}
