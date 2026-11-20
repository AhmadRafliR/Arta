import { Pressable, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { useRouter, Tabs } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { MicButton } from './MicButton';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const LABEL: Record<string, string> = { index: 'Beranda', riwayat: 'Riwayat', hutang: 'Hutang', akun: 'Akun' };

// Tab bar kustom: Beranda · Riwayat · [mic] · Hutang · Akun. Mic bukan rute: membuka /catat.
export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const router = useRouter();
  const { t } = useTheme();
  const items = state.routes.map((r, i) => {
    const aktif = state.index === i;
    return (
      <Pressable
        key={r.key}
        accessibilityRole="tab"
        accessibilityLabel={LABEL[r.name] ?? r.name}
        accessibilityState={{ selected: aktif }}
        className="flex-1 items-center py-3"
        onPress={() => {
          const e = emitter.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
          if (!aktif && !e.defaultPrevented) navigateToTab(r.key);
        }}
      >
        <Text style={{ color: aktif ? t.fg : t.mid, fontWeight: aktif ? '700' : '400' }} className="text-[11px] font-sans">
          {LABEL[r.name] ?? r.name}
        </Text>
      </Pressable>
    );
  });
  const tengah = Math.ceil(items.length / 2);
  return (
    <View
      style={{ paddingBottom: insets.bottom, borderTopColor: t.line, backgroundColor: t.card }}
      className="flex-row items-center border-t"
    >
      {items.slice(0, tengah)}
      <View className="w-20 items-center">
        <MicButton onPress={() => router.push('/catat')} />
      </View>
      {items.slice(tengah)}
    </View>
  );
}
