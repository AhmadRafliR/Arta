import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimasiNabung } from '@/components/animasi/AnimasiNabung';

/** Overlay singkat "Akun siap": animasi menabung sekali main (~1,8 dtk), lalu menutup; kurangi gerak -> ~0,4 dtk. */
export function OverlayAkunSiap({ onSelesai }: { onSelesai: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityViewIsModal
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      className="flex-1 items-center justify-center bg-bg p-7"
    >
      <View className="items-center gap-[14px]">
        <AnimasiNabung ukuran={140} onSelesai={onSelesai} />
        <Text accessibilityRole="header" className="text-xl font-bold text-fg font-sans" style={{ letterSpacing: -0.5 }}>
          Akun siap
        </Text>
        <Text className="max-w-[240px] text-center text-[12.5px] leading-[19px] text-fg2 font-sans">
          Tinggal satu langkah: beri tahu uangmu ada di mana.
        </Text>
      </View>
    </View>
  );
}
