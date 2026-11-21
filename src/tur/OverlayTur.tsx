import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Ikon } from '@/components/ikon/Ikon';
import { useTheme } from '@/theme/ThemeProvider';
import type { LangkahTur } from './langkah';
import { ambilTarget, ukur, type Kotak, type NodeView } from './registry';

export type JedaTur = { mulai: number; navigasi: number; gulir: number; tungguTarget: number };
export const JEDA_BAWAAN: JedaTur = { mulai: 900, navigasi: 450, gulir: 380, tungguTarget: 100 };

const tunggu = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const PADDING_SOROT = 6;
const JARAK_KARTU = 14;
const TINGGI_KARTU = 260;

/** Jalur SVG kotak bersudut bulat (searah jarum jam) untuk lubang sorotan. */
export function jalurKotak({ x, y, w, h }: Kotak, radius: number): string {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  return (
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}` +
    `A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}

/** Kartu di bawah sorotan bila muat, di atasnya bila tidak; tanpa sorotan kartu di tengah. */
export function posisiKartu(
  kotak: Kotak | null,
  tinggiLayar: number,
  aman: { top: number; bottom: number },
): { top?: number; bottom?: number } | null {
  if (!kotak) return null;
  const ruangBawah = tinggiLayar - (kotak.y + kotak.h) - aman.bottom;
  const ruangAtas = kotak.y - aman.top;
  if (ruangBawah >= TINGGI_KARTU + JARAK_KARTU) return { top: kotak.y + kotak.h + JARAK_KARTU };
  if (ruangAtas >= TINGGI_KARTU + JARAK_KARTU) return { bottom: tinggiLayar - kotak.y + JARAK_KARTU };
  return { bottom: aman.bottom + 16 };
}

type Props = {
  langkah: LangkahTur;
  indeks: number;
  jumlah: number;
  jeda: JedaTur;
  onLanjut: () => void;
  onKembali: () => void;
  onLewati: () => void;
};

/**
 * Lapisan tur: tirai gelap dengan lubang di elemen yang dibahas, cincin aksen, dan kartu penjelasan
 * bergaya arta. Menangkap semua sentuhan; navigasi lewat tombol kartu atau tombol kembali Android.
 */
export function OverlayTur({ langkah, indeks, jumlah, jeda, onLanjut, onKembali, onLewati }: Props) {
  const { t, mode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const akarRef = useRef<NodeView>(null);
  const pathRef = useRef(pathname);
  // Router lewat ref: objek router boleh berganti tiap render tanpa mengulang persiapan langkah.
  const routerRef = useRef(router);
  useEffect(() => {
    pathRef.current = pathname;
    routerRef.current = router;
  }, [pathname, router]);
  // Hasil persiapan per langkah: kartu baru tampil setelah tab dibuka, layar digulir, dan target diukur.
  const [hasil, setHasil] = useState<{ id: string; kotak: Kotak | null } | null>(null);

  useEffect(() => {
    let batal = false;
    void (async () => {
      if (langkah.rute && pathRef.current !== langkah.rute) {
        routerRef.current.navigate(langkah.rute as Href);
        await tunggu(jeda.navigasi);
      }
      let kotak: Kotak | null = null;
      if (langkah.target) {
        let target = ambilTarget(langkah.target);
        for (let i = 0; !target && i < 10 && !batal; i++) {
          await tunggu(jeda.tungguTarget);
          target = ambilTarget(langkah.target);
        }
        if (target?.gulir) {
          target.gulir();
          await tunggu(jeda.gulir);
        }
        const k = target ? await ukur(target.ref) : null;
        const asal = k ? await ukur(akarRef) : null;
        if (k) {
          const ox = asal?.x ?? 0;
          const oy = asal?.y ?? 0;
          const g = { x: k.x - ox - PADDING_SOROT, y: k.y - oy - PADDING_SOROT, w: k.w + PADDING_SOROT * 2, h: k.h + PADDING_SOROT * 2 };
          // Di luar layar (gagal digulir): kartu di tengah tanpa sorotan.
          kotak = g.y + g.h > 0 && g.y < H ? g : null;
        }
      }
      if (!batal) setHasil({ id: langkah.id, kotak });
    })();
    return () => {
      batal = true;
    };
  }, [langkah, jeda, H]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (indeks > 0) onKembali();
      else onLewati();
      return true;
    });
    return () => sub.remove();
  }, [indeks, onKembali, onLewati]);

  const siap = hasil?.id === langkah.id;
  const kotak = siap ? hasil.kotak : null;
  const posisi = posisiKartu(kotak, H, { top: insets.top, bottom: insets.bottom });
  const pertama = indeks === 0;
  const terakhir = indeks === jumlah - 1;
  const tirai = mode === 'gelap' ? 'rgba(0,0,0,0.74)' : 'rgba(6,20,24,0.66)';
  const lubang = kotak ? ` ${jalurKotak(kotak, langkah.radius ?? 18)}` : '';

  return (
    <View
      ref={akarRef}
      collapsable={false}
      testID="tur-overlay"
      accessibilityViewIsModal
      onStartShouldSetResponder={() => true}
      style={[StyleSheet.absoluteFill, { zIndex: 2000, elevation: 2000 }]}
    >
      <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Path d={`M0 0H${W}V${H}H0Z${lubang}`} fill={tirai} fillRule="evenodd" />
          {kotak ? (
            <>
              <Path d={jalurKotak(kotak, langkah.radius ?? 18)} fill="none" stroke={t.acc} strokeOpacity={0.35} strokeWidth={7} />
              <Path d={jalurKotak(kotak, langkah.radius ?? 18)} fill="none" stroke={t.acc} strokeWidth={2} />
            </>
          ) : null}
        </Svg>
      </Animated.View>

      {siap ? (
        <View
          pointerEvents="box-none"
          style={
            posisi
              ? { position: 'absolute', left: 16, right: 16, ...posisi }
              : [StyleSheet.absoluteFill, { justifyContent: 'center', paddingHorizontal: 16 }]
          }
        >
          <Animated.View
            key={langkah.id}
            entering={FadeInDown.duration(260)}
            testID={`tur-kartu-${langkah.id}`}
            style={{ width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 24, padding: 16, gap: 10 }}
            className="border border-line bg-card"
          >
            <View className="flex-row items-center gap-3">
              <View style={{ width: 40, height: 40 }} className="items-center justify-center rounded-[14px] bg-accsoft">
                <Ikon nama={langkah.ikon} ukuran={20} warna={t.accInk} />
              </View>
              <Text className="flex-1 font-sans text-[10.5px] font-bold tracking-[0.12em] text-mid">
                {`LANGKAH ${indeks + 1} DARI ${jumlah}`}
              </Text>
              {!terakhir ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Lewati tur"
                  onPress={onLewati}
                  hitSlop={8}
                  style={{ width: 32, height: 32 }}
                  className="items-center justify-center rounded-full border border-line bg-card"
                >
                  <Ikon nama="ui-close" ukuran={16} warna={t.fg} />
                </Pressable>
              ) : null}
            </View>
            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              className="font-sans text-[17px] font-bold text-fg"
              maxFontSizeMultiplier={1.3}
            >
              {langkah.judul}
            </Text>
            <Text className="font-sans text-[13.5px] leading-[20px] text-fg2" maxFontSizeMultiplier={1.3}>
              {langkah.isi}
            </Text>
            <View className="flex-row items-center gap-1" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {Array.from({ length: jumlah }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === indeks ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === indeks ? t.accInk : t.line,
                  }}
                />
              ))}
            </View>
            <View className="mt-1 flex-row items-center gap-2">
              {pertama ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Lewati" onPress={onLewati} style={{ minHeight: 44 }} className="justify-center px-2">
                  <Text className="font-sans text-[14px] font-semibold text-mid">Lewati</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="Kembali" onPress={onKembali} style={{ minHeight: 44 }} className="justify-center px-2">
                  <Text className="font-sans text-[14px] font-semibold text-mid">Kembali</Text>
                </Pressable>
              )}
              <View className="flex-1" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={pertama ? 'Mulai tur' : terakhir ? 'Mulai pakai arta' : 'Lanjut'}
                onPress={onLanjut}
                style={{ minHeight: 44 }}
                className="flex-row items-center justify-center gap-1.5 rounded-full bg-acc px-5"
              >
                <Text style={{ color: t.accFg }} className="font-sans text-[14px] font-bold" maxFontSizeMultiplier={1.3}>
                  {pertama ? 'Mulai tur' : terakhir ? 'Mulai pakai arta' : 'Lanjut'}
                </Text>
                {!terakhir ? <Ikon nama="ui-arrow-right" ukuran={16} warna={t.accFg} /> : null}
              </Pressable>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}
