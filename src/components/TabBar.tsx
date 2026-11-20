import { useEffect, useRef, type ComponentProps } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useRouter, Tabs } from 'expo-router';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { TINGGI_NAV } from '@/nav/pulau';
import { useStatusNav } from '@/nav/NavPulauProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { MicButton } from './MicButton';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const LABEL: Record<string, string> = { index: 'Beranda', riwayat: 'Riwayat', hutang: 'Hutang', akun: 'Akun' };
const IKON: Record<string, NamaIkon> = {
  index: 'nav-beranda',
  riwayat: 'nav-riwayat',
  hutang: 'nav-hutang',
  akun: 'nav-akun',
};

const KURVA = Easing.bezier(0.32, 0.72, 0, 1);
const DURASI = 340;
// Label pudar lebih dulu saat masuk pulau; saat kembali, masuk setelah jeda dan selesai bersama bentuk.
const DURASI_LABEL = 120;
const TINGGI_PULAU = 64;
const TINGGI_LABEL = 14;
// Skala font sistem dibatasi (maxFontSizeMultiplier); slot label mengikuti skala itu plus sedikit ruang untuk metrik Nunito.
const SKALA_MAKS = 1.3;
const RUANG_LABEL = 2;
const MIC_PENUH = 56;
const MIC_PULAU = 48;
// Radius yang tampak untuk kapsul setinggi 64 + garis 2px; di ujung animasi dipasang 999.
const RADIUS_TAMPAK = (TINGGI_PULAU + 2) / 2;
const RADIUS_PULAU = 999;

function ItemTab({
  label,
  ikon,
  aktif,
  p,
  opasitasLabel,
  onPress,
}: {
  label: string;
  ikon: NamaIkon | undefined;
  aktif: boolean;
  p: SharedValue<number>;
  opasitasLabel: SharedValue<number>;
  onPress: () => void;
}) {
  const { t } = useTheme();
  const { fontScale } = useWindowDimensions();
  const tinggiLabel = Math.ceil(TINGGI_LABEL * Math.min(fontScale, SKALA_MAKS)) + RUANG_LABEL;
  const gayaLabel = useAnimatedStyle(() => ({
    opacity: opasitasLabel.value,
    height: interpolate(p.value, [0, 1], [tinggiLabel, 0]),
    marginTop: interpolate(p.value, [0, 1], [4, 0]),
  }));
  const warna = aktif ? t.fg : t.mid;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: aktif }}
      className="flex-1 items-center justify-center self-stretch"
      onPress={onPress}
    >
      {ikon ? <Ikon nama={ikon} ukuran={24} warna={warna} /> : null}
      <Animated.View style={[{ overflow: 'hidden' }, gayaLabel]}>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={SKALA_MAKS}
          className="text-[11px] font-sans"
          style={{ color: warna, fontWeight: aktif ? '700' : '400', lineHeight: TINGGI_LABEL, includeFontPadding: false }}
        >
          {label}
        </Text>
      </Animated.View>
      <View
        style={{ width: 5, height: 5, borderRadius: 3, marginTop: 4, backgroundColor: aktif ? t.accInk : 'transparent' }}
      />
    </Pressable>
  );
}

// Tab bar "pulau dinamis": penuh selebar layar di atas gulir, kapsul melayang saat konten digulir.
// Beranda · Riwayat · [mic] · Hutang · Akun. Mic bukan rute: membuka modal /rekam (catat pakai suara).
export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const router = useRouter();
  const { t, mode } = useTheme();
  const status = useStatusNav();
  const kurangiGerak = useReducedMotion();

  // Saat mount nilai awal langsung sesuai status (layar bisa dipulihkan di tengah gulir).
  const p = useSharedValue(status === 'pulau' ? 1 : 0); // 0 = penuh, 1 = pulau
  const opasitasLabel = useSharedValue(status === 'pulau' ? 0 : 1);
  const statusLalu = useRef(status);

  useEffect(() => {
    if (statusLalu.current === status) return;
    statusLalu.current = status;
    const kePulau = status === 'pulau';
    if (kurangiGerak) {
      p.value = kePulau ? 1 : 0;
      opasitasLabel.value = kePulau ? 0 : 1;
      return;
    }
    const bentuk = { duration: DURASI, easing: KURVA };
    if (kePulau) {
      opasitasLabel.value = withTiming(0, { duration: DURASI_LABEL });
      p.value = withDelay(DURASI_LABEL, withTiming(1, bentuk));
    } else {
      p.value = withTiming(0, bentuk);
      opasitasLabel.value = withDelay(DURASI_LABEL, withTiming(1, { duration: DURASI - DURASI_LABEL }));
    }
  }, [status, kurangiGerak, p, opasitasLabel]);

  const terang = mode === 'terang';
  const jarakBawah = Math.max(12, insets.bottom);
  const amanBawah = insets.bottom;
  const gayaPulau = useAnimatedStyle(() => {
    const v = p.value;
    const radiusAtas = v >= 1 ? RADIUS_PULAU : interpolate(v, [0, 1], [22, RADIUS_TAMPAK]);
    const radiusBawah = v >= 1 ? RADIUS_PULAU : interpolate(v, [0, 1], [0, RADIUS_TAMPAK]);
    const garisSisi = interpolate(v, [0, 1], [0, 1]);
    return {
      marginHorizontal: interpolate(v, [0, 1], [0, 12]),
      marginBottom: interpolate(v, [0, 1], [0, jarakBawah]),
      paddingBottom: interpolate(v, [0, 1], [amanBawah, 0]),
      borderTopLeftRadius: radiusAtas,
      borderTopRightRadius: radiusAtas,
      borderBottomLeftRadius: radiusBawah,
      borderBottomRightRadius: radiusBawah,
      borderLeftWidth: garisSisi,
      borderRightWidth: garisSisi,
      borderBottomWidth: garisSisi,
      // Gelap: tanpa bayangan (kit: --shadow: none).
      shadowOpacity: terang ? interpolate(v, [0, 1], [0, 0.12]) : 0,
      elevation: terang ? interpolate(v, [0, 1], [0, 10]) : 0,
    };
  }, [jarakBawah, amanBawah, terang]);
  const gayaBaris = useAnimatedStyle(() => ({
    height: interpolate(p.value, [0, 1], [TINGGI_NAV - 1, TINGGI_PULAU]),
  }));
  // Penuh: mic menonjol 30px di atas bar. Pulau: mic 48px di tengah kapsul.
  const gayaSlotMic = useAnimatedStyle(() => ({
    paddingTop: interpolate(p.value, [0, 1], [0, (TINGGI_PULAU - MIC_PULAU) / 2]),
  }));
  const gayaMic = useAnimatedStyle(() => {
    const ukuran = interpolate(p.value, [0, 1], [MIC_PENUH, MIC_PULAU]);
    return { width: ukuran, height: ukuran, marginTop: interpolate(p.value, [0, 1], [-30, 0]) };
  });

  const items = state.routes.map((r, i) => {
    const aktif = state.index === i;
    return (
      <ItemTab
        key={r.key}
        label={LABEL[r.name] ?? r.name}
        ikon={IKON[r.name]}
        aktif={aktif}
        p={p}
        opasitasLabel={opasitasLabel}
        onPress={() => {
          const e = emitter.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
          if (!aktif && !e.defaultPrevented) navigateToTab(r.key);
        }}
      />
    );
  });
  const tengah = Math.ceil(items.length / 2);
  return (
    // Melayang di atas konten pada kedua status; area kosong meneruskan sentuhan ke layar.
    <View
      testID={`tab-bar-${status}`}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
    >
      <Animated.View
        style={[
          {
            backgroundColor: t.card,
            borderColor: t.line,
            borderTopWidth: 1,
            shadowColor: t.heroFrom,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
          },
          gayaPulau,
        ]}
      >
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, gayaBaris]}>
          {items.slice(0, tengah)}
          <Animated.View style={[{ width: 80, alignItems: 'center', alignSelf: 'stretch' }, gayaSlotMic]}>
            <MicButton onPress={() => router.push('/rekam')} style={gayaMic} />
          </Animated.View>
          {items.slice(tengah)}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
