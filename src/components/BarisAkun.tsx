import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { useTheme } from '@/theme/ThemeProvider';

// Potongan tampilan layar Akun (mockup arta akun.html): judul seksi, kartu grup, baris menu, bar progres.

export type NadaProgres = 'aman' | 'waspada' | 'lewat';

/** Judul seksi kecil huruf kapital di luar kartu (mockup: .sec-head > .sec-title). */
export function JudulSeksiAkun({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      className="px-px pt-0.5 font-sans text-[13px] font-semibold uppercase tracking-[0.5px] text-mid"
    >
      {children}
    </Text>
  );
}

/** Kartu putih bergaris yang memuat baris-baris (mockup: .plan-card / .link-group / .wgroup). */
export function KartuGrupAkun({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return (
    <View testID={testID} className="overflow-hidden rounded-[20px] border border-line bg-card">
      {children}
    </View>
  );
}

/** Bar progres tipis 5px (mockup: .prog > .prog-fill). */
export function BarProgresAkun({ persen, nada = 'aman' }: { persen: number; nada?: NadaProgres }) {
  const { t } = useTheme();
  const warna = nada === 'lewat' ? t.dangerInk : nada === 'waspada' ? t.warnInk : t.accInk;
  return (
    <View className="mt-[5px] h-[5px] w-full overflow-hidden rounded-full bg-card2">
      <View style={{ width: `${Math.max(0, Math.min(100, persen))}%`, height: '100%', backgroundColor: warna }} className="rounded-full" />
    </View>
  );
}

type PropsBaris = {
  ikon: NamaIkon;
  judul: string;
  sub?: string | null;
  /** Sub bernada waspada (mis. budget lewat). */
  subWaspada?: boolean;
  progres?: { persen: number; nada?: NadaProgres } | null;
  /** Nilai ringkas di kanan (mis. "78%", "Rp18jt"). */
  nilai?: string | null;
  /** Slot kanan tambahan sebelum chevron (badge Pro, saklar, gembok). */
  kanan?: React.ReactNode;
  /** Baris pertama di kartu: tanpa garis atas. */
  pertama?: boolean;
  bahaya?: boolean;
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityState?: { expanded?: boolean };
};

/** Baris menu berikon: petak ikon + judul/sub + nilai + chevron (mockup: .plan-row / .link-row / .wrow). */
export function BarisMenuAkun({
  ikon,
  judul,
  sub,
  subWaspada,
  progres,
  nilai,
  kanan,
  pertama,
  bahaya,
  chevron = true,
  onPress,
  accessibilityLabel,
  accessibilityState,
}: PropsBaris) {
  const { t } = useTheme();
  const isi = (
    <>
      <View
        style={{ width: 36, height: 36 }}
        className={`items-center justify-center rounded-xl ${bahaya ? 'bg-dangersoft' : 'bg-card2'}`}
      >
        <Ikon nama={ikon} ukuran={19} warna={bahaya ? t.dangerInk : t.fg2} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          style={bahaya ? { color: t.dangerInk } : undefined}
          className={`font-sans text-[14.5px] font-semibold ${bahaya ? '' : 'text-fg'}`}
          numberOfLines={1}
        >
          {judul}
        </Text>
        {sub ? (
          <Text
            style={subWaspada ? { color: t.warnInk } : undefined}
            className={`font-sans text-[11.5px] ${subWaspada ? 'font-semibold' : 'text-mid'}`}
            numberOfLines={1}
          >
            {sub}
          </Text>
        ) : null}
        {progres ? <BarProgresAkun persen={progres.persen} nada={progres.nada} /> : null}
      </View>
      {nilai ? (
        <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[13.5px] font-semibold text-fg">
          {nilai}
        </Text>
      ) : null}
      {kanan}
      {chevron ? <Ikon nama="ui-chev" ukuran={16} warna={t.mid} /> : null}
    </>
  );
  const kelas = `flex-row items-center gap-[11px] px-3.5 py-3 ${pertama ? '' : 'border-t border-line'}`;
  if (!onPress) {
    return (
      <View className={kelas} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {isi}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? judul}
      accessibilityState={accessibilityState}
      onPress={onPress}
      className={kelas}
    >
      {isi}
    </Pressable>
  );
}
