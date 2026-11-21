import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

/** Durasi satu siklus (ms): masuk 0-300, koin 300-1100, percikan 1100-1500, sisa jeda sebelum selesai. */
export const DURASI_NABUNG = 1800;
/** Siklus pendek saat "kurangi gerak": hanya pudar masuk. */
export const DURASI_NABUNG_DIAM = 400;

const KURVA = Easing.bezier(0.32, 0.72, 0, 1); // sama dengan TabBar
const GRAVITASI = Easing.bezier(0.45, 0, 0.85, 0.55); // koin jatuh: makin cepat
const JEDA_KOIN = 180;
const MULAI_KOIN = 300;
const DURASI_KOIN = 440;
const MULAI_PERCIK = 1100;
const JARAK_JATUH = 130; // satuan viewBox di atas lubang
const KOIN_R = 26;
const LUBANG = { cx: 267, cy: 158, x: 225, y: 148, w: 84, h: 20 };
// Percikan di kanan atas celengan: pusat (x, y) dan sisi dalam satuan viewBox 512.
const PERCIK = [
  { x: 436, y: 112, sisi: 46 },
  { x: 472, y: 180, sisi: 30 },
  { x: 398, y: 66, sisi: 32 },
  { x: 462, y: 244, sisi: 24 },
] as const;
const JALUR_PERCIK = 'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z';

type Props = {
  ukuran?: number;
  /**
   * Ulangi terus selama true; siklus yang sedang jalan diselesaikan dulu, baru onSelesai dipanggil saat false.
   * Boleh fungsi: dievaluasi tepat di akhir tiap siklus (menghindari balapan dengan render).
   */
  ulang?: boolean | (() => boolean);
  onSelesai?: () => void;
};

function Koin({ p, ukuran, nomor }: { p: SharedValue<number>; ukuran: number; nomor: number }) {
  const { t } = useTheme();
  const s = ukuran / 512;
  const gaya = useAnimatedStyle(() => {
    const v = p.get();
    const masuk = v > 0.82 ? (v - 0.82) / 0.18 : 0; // memipih & memudar tepat di lubang
    const putar = Math.max(0.18, Math.abs(Math.cos(v * Math.PI * 3))); // scaleX menyempit = berputar
    return {
      opacity: v <= 0 ? 0 : 1 - masuk,
      transform: [
        { translateY: (v - 1) * JARAK_JATUH * s },
        { scaleX: putar * (1 - 0.3 * masuk) },
        { scaleY: 1 - 0.75 * masuk },
      ],
    };
  });
  return (
    <Animated.View
      testID={`nabung-koin-${nomor}`}
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: (LUBANG.cx - KOIN_R) * s,
          top: (LUBANG.cy - KOIN_R) * s,
          width: KOIN_R * 2 * s,
          height: KOIN_R * 2 * s,
        },
        gaya,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 52 52">
        <Circle cx="26" cy="26" r="24" fill={t.acc} stroke={t.accInk} strokeWidth="3" />
        <Rect x="22" y="12" width="8" height="28" rx="4" fill={t.accInk} />
      </Svg>
    </Animated.View>
  );
}

function Percik({ p, ukuran, nomor }: { p: SharedValue<number>; ukuran: number; nomor: number }) {
  const { t } = useTheme();
  const s = ukuran / 512;
  const { x, y, sisi } = PERCIK[nomor];
  const gaya = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: interpolate(v, [0, 0.3, 1], [0, 1, 0]),
      transform: [{ scale: interpolate(v, [0, 1], [0.3, 1.15]) }, { rotate: `${v * 60}deg` }],
    };
  });
  return (
    <Animated.View
      testID={`nabung-percik-${nomor}`}
      pointerEvents="none"
      style={[{ position: 'absolute', left: (x - sisi / 2) * s, top: (y - sisi / 2) * s, width: sisi * s, height: sisi * s }, gaya]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 24 24">
        <Path d={JALUR_PERCIK} fill={t.acc} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Motion graphic "orang menabung": mark arta sebagai celengan, tiga koin jatuh ke lubang koin,
 * celengan memantul, percikan muncul, garis progres terisi. Hanya transform/opacity/width pada
 * Animated.View di atas Svg statis, semuanya di UI thread (tanpa setState per frame).
 * Yang JS hanyalah timer akhir siklus (satu kali per siklus) untuk onSelesai / mengulang.
 */
export function AnimasiNabung({ ukuran = 140, ulang = false, onSelesai }: Props) {
  const { mode, t } = useTheme();
  const gelap = mode === 'gelap';
  const badan = gelap ? '#F2F7F8' : 'url(#nabungGrad)';
  const aksen = gelap ? '#0B424F' : '#52C3BF';
  const s = ukuran / 512;
  const lebarBar = Math.round(ukuran * 0.5);
  const kurangiGerak = useReducedMotion();

  const opMasuk = useSharedValue(0);
  const skalaMasuk = useSharedValue(kurangiGerak ? 1 : 0.6);
  const pantul = useSharedValue(0);
  const isi = useSharedValue(0);
  const k0 = useSharedValue(0);
  const k1 = useSharedValue(0);
  const k2 = useSharedValue(0);
  const c0 = useSharedValue(0);
  const c1 = useSharedValue(0);
  const c2 = useSharedValue(0);
  const c3 = useSharedValue(0);

  const ulangRef = useRef(ulang);
  const selesaiRef = useRef(onSelesai);
  useEffect(() => {
    ulangRef.current = ulang;
    selesaiRef.current = onSelesai;
  }, [ulang, onSelesai]);

  useEffect(() => {
    let mati = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const koin = [k0, k1, k2];
    const percik = [c0, c1, c2, c3];

    const akhiriSiklus = () => {
      if (mati) return;
      const lagi = typeof ulangRef.current === 'function' ? ulangRef.current() : ulangRef.current;
      if (lagi) siklus(false);
      else selesaiRef.current?.();
    };

    const siklus = (awal: boolean) => {
      if (kurangiGerak) {
        // Tanpa gerak: celengan statis, hanya pudar masuk; koin & percikan tidak ditampilkan.
        skalaMasuk.set(1);
        if (awal) opMasuk.set(withTiming(1, { duration: 200 }));
        else opMasuk.set(1);
        isi.set(1);
        timer = setTimeout(akhiriSiklus, DURASI_NABUNG_DIAM);
        return;
      }
      if (awal) {
        skalaMasuk.set(0.6);
        opMasuk.set(0);
        skalaMasuk.set(withSpring(1, { damping: 11, stiffness: 170, mass: 0.8 }));
        opMasuk.set(withTiming(1, { duration: 240, easing: KURVA }));
      } else {
        skalaMasuk.set(1);
        opMasuk.set(1);
      }
      koin.forEach((k, i) => {
        k.set(0);
        k.set(withDelay(MULAI_KOIN + JEDA_KOIN * i, withTiming(1, { duration: DURASI_KOIN, easing: GRAVITASI })));
      });
      // Tiap koin masuk (740, 920, 1100 ms): remas lalu lepas; yang terakhir melenting dengan pegas lembut.
      const naik = () => withTiming(1, { duration: 70, easing: KURVA });
      const turun = () => withTiming(0, { duration: 110, easing: KURVA });
      pantul.set(0);
      pantul.set(
        withDelay(
          MULAI_KOIN + DURASI_KOIN,
          withSequence(naik(), turun(), naik(), turun(), naik(), withSpring(0, { damping: 9, stiffness: 240 })),
        ),
      );
      percik.forEach((c, i) => {
        c.set(0);
        c.set(withDelay(MULAI_PERCIK + 50 * i, withTiming(1, { duration: 330, easing: KURVA })));
      });
      isi.set(0);
      isi.set(withDelay(MULAI_KOIN, withTiming(1, { duration: 1200, easing: Easing.linear })));
      timer = setTimeout(akhiriSiklus, DURASI_NABUNG);
    };

    siklus(true);
    return () => {
      mati = true;
      if (timer) clearTimeout(timer);
      for (const v of [opMasuk, skalaMasuk, pantul, isi, k0, k1, k2, c0, c1, c2, c3]) cancelAnimation(v);
    };
  }, [kurangiGerak, opMasuk, skalaMasuk, pantul, isi, k0, k1, k2, c0, c1, c2, c3]);

  const gayaBadan = useAnimatedStyle(() => {
    const b = pantul.get();
    return {
      opacity: opMasuk.get(),
      transform: [{ scale: skalaMasuk.get() }, { scaleX: 1 + 0.03 * b }, { scaleY: 1 - 0.04 * b }],
    };
  });
  const gayaKilau = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, pantul.get())) * 0.75 }));
  const gayaBar = useAnimatedStyle(() => ({ width: isi.get() * lebarBar }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Celengan arta sedang menabung"
      style={{ width: ukuran, alignItems: 'center' }}
    >
      <View style={{ width: ukuran, height: ukuran }}>
        <Animated.View testID="nabung-badan" style={[StyleSheet.absoluteFill, { transformOrigin: '50% 75%' }, gayaBadan]}>
          <Svg testID="nabung-svg" width={ukuran} height={ukuran} viewBox="0 0 512 512">
            <Defs>
              <LinearGradient id="nabungGrad" x1="95" y1="106" x2="417" y2="406" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#0B424F" />
                <Stop offset="1" stopColor="#1F6A76" />
              </LinearGradient>
            </Defs>
            <G fill={badan}>
              <Circle cx="267" cy="256" r="150" />
              <Rect x="95" y="226" width="96" height="96" rx="48" />
            </G>
            <G fill={aksen}>
              <Rect x={LUBANG.x} y={LUBANG.y} width={LUBANG.w} height={LUBANG.h} rx="10" />
              <Circle cx="130" cy="262" r="8" />
              <Circle cx="130" cy="286" r="8" />
            </G>
          </Svg>
          <Animated.View
            testID="nabung-kilau"
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: (LUBANG.x - 14) * s,
                top: (LUBANG.y - 12) * s,
                width: (LUBANG.w + 28) * s,
                height: (LUBANG.h + 24) * s,
                borderRadius: 22 * s,
                backgroundColor: t.acc,
              },
              gayaKilau,
            ]}
          />
        </Animated.View>
        <Koin p={k0} ukuran={ukuran} nomor={0} />
        <Koin p={k1} ukuran={ukuran} nomor={1} />
        <Koin p={k2} ukuran={ukuran} nomor={2} />
        <Percik p={c0} ukuran={ukuran} nomor={0} />
        <Percik p={c1} ukuran={ukuran} nomor={1} />
        <Percik p={c2} ukuran={ukuran} nomor={2} />
        <Percik p={c3} ukuran={ukuran} nomor={3} />
      </View>
      <View style={{ width: lebarBar, height: 3, marginTop: 6, borderRadius: 2, backgroundColor: t.line, overflow: 'hidden' }}>
        <Animated.View testID="nabung-progres" style={[{ height: 3, borderRadius: 2, backgroundColor: t.accInk }, gayaBar]} />
      </View>
    </View>
  );
}
