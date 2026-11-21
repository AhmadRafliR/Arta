import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';
import { MarkArta } from '@/components/MarkArta';

/** Grup rute tanpa logo global: login (masuk/kode) dan onboarding (sudah punya chip merek sendiri). */
const GRUP_TANPA_LOGO = ['(auth)', '(onboarding)'];

export const TINGGI_BAR_LOGO = 44;

export function adaLogoDi(segmen: readonly string[]): boolean {
  return !GRUP_TANPA_LOGO.includes(segmen[0] ?? '');
}

/**
 * Bingkai seluruh layar app: logo arta di pojok kiri atas semua halaman kecuali login.
 * Bar logo memakai inset atas status bar, lalu isi di bawahnya melihat inset atas = 0 agar
 * layar yang sudah menambah padding safe-area sendiri tidak memberi jarak ganda.
 * Struktur pohon sengaja tetap sama saat bar disembunyikan, supaya navigasi tidak ter-mount ulang.
 */
export function KerangkaLogo({ children }: { children: ReactNode }) {
  const segmen = useSegments();
  const insets = useSafeAreaInsets();
  const tampil = adaLogoDi(segmen);
  const insetsAnak = tampil ? { ...insets, top: 0 } : insets;

  return (
    <View className="flex-1 bg-bg">
      {tampil ? (
        <View
          testID="bar-logo"
          style={{ paddingTop: insets.top, paddingHorizontal: 18 }}
          className="bg-bg"
        >
          <View style={{ height: TINGGI_BAR_LOGO }} className="flex-row items-center gap-2">
            <MarkArta ukuran={28} dekoratif />
            <Text accessibilityRole="header" className="font-sans text-[17px] font-bold tracking-wide text-fg">
              arta
            </Text>
          </View>
        </View>
      ) : null}
      <SafeAreaInsetsContext.Provider value={insetsAnak}>
        <View className="flex-1">{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
