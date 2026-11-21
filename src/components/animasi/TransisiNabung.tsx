import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AnimasiNabung } from '@/components/animasi/AnimasiNabung';

export const DURASI_KELUAR = 250;
const KURVA = Easing.bezier(0.32, 0.72, 0, 1);
// Timer "minimal" dipasang sedikit lebih awal dari minimalMs supaya tidak balapan dengan akhir
// siklus animasi yang jatuh persis di minimalMs (siklus 1800 ms).
const MARGIN_MINIMAL = 50;

type Props = {
  judul: string;
  sub?: string;
  minimalMs?: number;
  /** false = animasi mengulang sampai siap, lalu siklus terakhir diselesaikan sebelum keluar. */
  siap?: boolean;
  onSelesai: () => void;
};

/**
 * Overlay layar penuh transisi momen penting (menutupi semuanya, menangkap sentuhan):
 * AnimasiNabung + judul/sub, lalu memudar keluar 250 ms dan memanggil onSelesai.
 */
export function TransisiNabung({ judul, sub, minimalMs = 1800, siap = true, onSelesai }: Props) {
  const kurangiGerak = useReducedMotion();
  const minimalLewat = useRef(minimalMs <= MARGIN_MINIMAL);
  const siapRef = useRef(siap);
  const opasitas = useSharedValue(1);
  const teks = useSharedValue(kurangiGerak ? 1 : 0);
  const selesaiRef = useRef(onSelesai);
  const timerKeluar = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    selesaiRef.current = onSelesai;
    siapRef.current = siap;
  }, [onSelesai, siap]);

  useEffect(() => {
    if (minimalMs <= MARGIN_MINIMAL) return;
    const id = setTimeout(() => {
      minimalLewat.current = true;
    }, minimalMs - MARGIN_MINIMAL);
    return () => clearTimeout(id);
  }, [minimalMs]);

  useEffect(() => {
    if (!kurangiGerak) teks.set(withDelay(300, withTiming(1, { duration: 350, easing: KURVA })));
    else teks.set(1);
    return () => {
      cancelAnimation(teks);
      cancelAnimation(opasitas);
      if (timerKeluar.current) clearTimeout(timerKeluar.current);
    };
  }, [kurangiGerak, teks, opasitas]);

  function keluar() {
    if (timerKeluar.current) return;
    opasitas.set(withTiming(0, { duration: DURASI_KELUAR, easing: KURVA }));
    timerKeluar.current = setTimeout(() => selesaiRef.current(), DURASI_KELUAR);
  }

  const gayaRoot = useAnimatedStyle(() => ({ opacity: opasitas.get() }));
  const gayaTeks = useAnimatedStyle(() => ({
    opacity: teks.get(),
    transform: [{ translateY: (1 - teks.get()) * 8 }],
  }));

  return (
    <Animated.View
      testID="transisi-nabung"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Memuat"
      accessibilityViewIsModal
      // Menangkap sentuhan: layar di bawah tidak bisa disentuh selama transisi.
      onStartShouldSetResponder={() => true}
      style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }, gayaRoot]}
      className="items-center justify-center bg-bg p-7"
    >
      <AnimasiNabung ulang={() => !siapRef.current || !minimalLewat.current} onSelesai={keluar} />
      <Animated.View style={[{ marginTop: 18, alignItems: 'center', gap: 6 }, gayaTeks]}>
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          className="text-xl font-bold text-fg font-sans"
          style={{ letterSpacing: -0.5 }}
        >
          {judul}
        </Text>
        {sub ? <Text className="max-w-[260px] text-center text-[12.5px] leading-[19px] text-fg2 font-sans">{sub}</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}
