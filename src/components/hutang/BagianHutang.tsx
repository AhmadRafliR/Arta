import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { useTheme } from '@/theme/ThemeProvider';

// Potongan tampilan khusus layar Hutang (mockup arta hutang.html). Komponen bersama dibekukan,
// jadi variasi yang tidak tersedia di sana (tombol berikon, segmen ber-testID, kotak hitung) ada di sini.

/** Kelas isian polos di dalam BarisField (mockup: .field-input). */
export const KELAS_ISIAN = 'p-0 text-[14.5px] font-semibold text-fg';

type VarianTombol = 'utama' | 'bahaya' | 'biasa';

/** Tombol lembar (mockup: .btn-sheet): tinggi 46, sudut 14, ikon opsional. Mengisi lebar kolomnya. */
export function TombolAksi({
  label,
  onPress,
  ikon,
  varian = 'biasa',
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  ikon?: NamaIkon;
  varian?: VarianTombol;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { t } = useTheme();
  const warna = varian === 'utama' ? t.accFg : varian === 'bahaya' ? t.dangerInk : t.fg;
  const kelas =
    varian === 'utama' ? 'border-acc bg-acc' : varian === 'bahaya' ? 'border-dangersoft bg-card' : 'border-line bg-card';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 46 }}
      className={`flex-1 flex-row items-center justify-center gap-[7px] rounded-[14px] border px-3.5 py-2.5 ${kelas} ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      {busy ? (
        <ActivityIndicator color={warna} />
      ) : (
        <>
          {ikon ? <Ikon nama={ikon} ukuran={18} warna={warna} /> : null}
          <Text style={{ color: warna }} className="font-sans text-sm font-semibold" numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Dua tombol berdampingan (mockup: .sheet-actions). */
export function BarisAksi({ children }: { children: React.ReactNode }) {
  return <View className="flex-row gap-2">{children}</View>;
}

/** Tombol bulat 38 dengan ikon tutup (mockup: .btn-icon-round). */
export function TombolTutup({ onPress }: { onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tutup"
      onPress={onPress}
      hitSlop={6}
      style={{ width: 38, height: 38 }}
      className="items-center justify-center rounded-full border border-line bg-card"
    >
      <Ikon nama="ui-close" ukuran={18} warna={t.fg} />
    </Pressable>
  );
}

/** Kepala layar modal hutang (mockup: .sheet-head): petak ikon, judul + sub, nominal opsional, tombol tutup. */
export function KepalaHutang({
  ikon,
  judul,
  sub,
  nominal,
  onTutup,
}: {
  ikon: NamaIkon;
  judul: string;
  sub?: string;
  nominal?: string;
  onTutup: () => void;
}) {
  const { t } = useTheme();
  return (
    <View className="flex-row items-center gap-3">
      <View style={{ width: 42, height: 42 }} className="items-center justify-center rounded-[14px] bg-accsoft">
        <Ikon nama={ikon} ukuran={21} warna={t.accInk} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text accessibilityRole="header" className="font-sans text-base font-semibold text-fg" numberOfLines={1}>
          {judul}
        </Text>
        {sub ? (
          <Text className="font-sans text-xs text-fg2" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {nominal ? (
        <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-base font-semibold text-fg" numberOfLines={1}>
          {nominal}
        </Text>
      ) : null}
      <TombolTutup onPress={onTutup} />
    </View>
  );
}

/** Wadah baris isian bergaris (mockup: .fields). */
export function KotakIsian({ children }: { children: React.ReactNode }) {
  return <View className="rounded-[14px] border border-line bg-card px-3 pb-0.5 pt-[11px]">{children}</View>;
}

/** Kotak hitung dua kolom (mockup: .calc-box). `masuk` = nilai berwarna aksen. */
export function KotakHitung({
  item,
}: {
  item: { label: string; nilai: string; masuk?: boolean; testID?: string }[];
}) {
  return (
    <View className="flex-row flex-wrap rounded-[14px] border border-line bg-card px-3 py-2.5" style={{ rowGap: 8 }}>
      {item.map((x) => (
        <View key={x.label} className="min-w-0 gap-px pr-2" style={{ width: '50%' }}>
          <Text className="font-sans text-[10.5px] font-semibold tracking-[0.4px] text-mid" numberOfLines={1}>
            {x.label}
          </Text>
          <Text
            testID={x.testID}
            style={{ fontVariant: ['tabular-nums'] }}
            className={`font-sans text-[12.5px] font-semibold ${x.masuk ? 'text-accink' : 'text-fg'}`}
            numberOfLines={1}
          >
            {x.nilai}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Teks petunjuk/galat kecil (mockup: .hint). `ok` = nada aksen, selain itu nada bahaya. */
export function Petunjuk({ children, ok }: { children: string; ok?: boolean }) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      className={`font-sans text-[11.5px] leading-4 ${ok ? 'font-semibold text-accink' : 'text-dangerink'}`}
    >
      {children}
    </Text>
  );
}

/** Catatan kecil di lembar (mockup: .sheet-note). */
export function CatatanKecil({ children }: { children: string }) {
  return <Text className="font-sans text-[11.5px] leading-[17px] text-fg2">{children}</Text>;
}

/** Lencana kecil (mockup: .badge / .badge.is-teal). */
export function Lencana({ label, teal, ikon }: { label: string; teal?: boolean; ikon?: NamaIkon }) {
  const { t } = useTheme();
  return (
    <View
      className={`flex-row items-center gap-1 rounded-full border px-2 py-0.5 ${
        teal ? 'border-transparent bg-accsoft' : 'border-line bg-card2'
      }`}
    >
      {ikon ? <Ikon nama={ikon} ukuran={11} warna={teal ? t.accInk : t.fg2} /> : null}
      <Text className={`font-sans text-[10.5px] font-bold tracking-[0.2px] ${teal ? 'text-accink' : 'text-fg2'}`}>{label}</Text>
    </View>
  );
}

/** Judul subseksi huruf kapital + lencana opsional (mockup: .sub-head / .sec-head). */
export function JudulSubHutang({ judul, lencana, kanan }: { judul: string; lencana?: string; kanan?: React.ReactNode }) {
  return (
    <View className="mt-0.5 flex-row items-center gap-2 px-px">
      <Text accessibilityRole="header" className="font-sans text-[13px] font-semibold uppercase tracking-[0.5px] text-mid">
        {judul}
      </Text>
      {lencana ? <Lencana label={lencana} /> : null}
      {kanan ? <View className="ml-auto">{kanan}</View> : null}
    </View>
  );
}

/** Segmen dua pilihan dengan testID per pilihan (mockup: .segmented; gaya sama dengan Segmented bersama). */
export function SegmenHutang<T extends string>({
  pilihan,
  nilai,
  onChange,
}: {
  pilihan: { nilai: T; label: string; testID?: string }[];
  nilai: T;
  onChange: (v: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" className="flex-row gap-[3px] rounded-xl bg-card2 p-[3px]">
      {pilihan.map((p) => {
        const aktif = p.nilai === nilai;
        return (
          <Pressable
            key={p.nilai}
            testID={p.testID}
            accessibilityRole="button"
            accessibilityLabel={p.label}
            accessibilityState={{ selected: aktif }}
            onPress={() => onChange(p.nilai)}
            style={{ minHeight: 38 }}
            className={`flex-1 items-center justify-center rounded-[9px] px-2 ${aktif ? 'bg-segactive' : ''}`}
          >
            <Text className={`font-sans text-[13px] font-semibold ${aktif ? 'text-fg' : 'text-fg2'}`}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
