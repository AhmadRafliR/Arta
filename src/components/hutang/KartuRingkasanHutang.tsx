import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ikon } from '@/components/ikon/Ikon';
import { labelBulan, labelJatuhTempo, type RingkasanHutang } from '@/domain/hutang';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

// Kartu ringkasan bergradien tab Hutang (mockup: .hero): total sisa, bar terbayar, kisi bebas hutang + tagihan terdekat.
export function KartuRingkasanHutang({ ringkas, hariIni }: { ringkas: RingkasanHutang; hariIni: string }) {
  const { t, mode } = useTheme();
  const persen = Math.round(ringkas.progres * 100);
  const bebas = ringkas.bebasPada ? labelBulan(ringkas.bebasPada) : ringkas.totalSisa > 0 ? '—' : 'Bebas';
  const terdekat = ringkas.berikutnya ? labelJatuhTempo(ringkas.berikutnya.tanggal, hariIni) : '—';
  // Gelap: kartu putih, jadi isian bar memakai amIn (teal tua) agar terbaca; terang: aksen seperti mockup.
  const isiBar = mode === 'gelap' ? t.amIn : t.acc;

  return (
    <LinearGradient
      colors={[t.heroFrom, t.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, paddingTop: 16, paddingBottom: 15, paddingHorizontal: 18, overflow: 'hidden' }}
    >
      {/* Lingkaran dekoratif di pojok kanan atas (mockup: .hero::after). */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -34,
          top: -46,
          width: 148,
          height: 148,
          borderRadius: 74,
          borderWidth: 1,
          borderColor: t.amLine,
          opacity: 0.55,
        }}
      />
      <Text style={{ color: t.amSub }} className="font-sans text-[11px] font-semibold uppercase tracking-[1.5px]">
        Total sisa hutang
      </Text>
      <Text
        style={{ color: t.heroFg, fontVariant: ['tabular-nums'], letterSpacing: -0.6 }}
        className="mt-1 font-sans text-[30px] font-semibold"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {formatRupiah(ringkas.totalSisa)}
      </Text>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Terbayar ${persen} persen`}
        accessibilityValue={{ min: 0, max: 100, now: persen }}
        style={{ height: 7, marginTop: 13, borderRadius: 99, backgroundColor: t.amLine, overflow: 'hidden' }}
      >
        <View style={{ height: 7, borderRadius: 99, width: `${Math.max(2, persen)}%`, backgroundColor: isiBar }} />
      </View>
      <Text style={{ color: t.amSub }} className="mt-[7px] font-sans text-[11.5px]">
        Terbayar{' '}
        <Text style={{ color: t.heroFg, fontVariant: ['tabular-nums'] }} className="font-sans font-bold">
          {`${persen}%`}
        </Text>
      </Text>

      <View style={{ borderTopWidth: 1, borderTopColor: t.amLine }} className="mt-[13px] flex-row gap-2 pt-3">
        <ItemRingkas ikon="status-jatuh-tempo" label="Bebas hutang" nilai={bebas} warnaNilai={t.heroFg} warnaLabel={t.amSub} />
        <ItemRingkas ikon="ui-money" label="Tagihan terdekat" nilai={terdekat} warnaNilai={t.amIn} warnaLabel={t.amSub} />
      </View>
    </LinearGradient>
  );
}

function ItemRingkas({
  ikon,
  label,
  nilai,
  warnaNilai,
  warnaLabel,
}: {
  ikon: 'status-jatuh-tempo' | 'ui-money';
  label: string;
  nilai: string;
  warnaNilai: string;
  warnaLabel: string;
}) {
  return (
    <View className="min-w-0 flex-1 gap-0.5">
      <View className="flex-row items-center gap-[5px]">
        <Ikon nama={ikon} ukuran={13} warna={warnaLabel} />
        <Text style={{ color: warnaLabel }} className="font-sans text-[11px] font-semibold tracking-[0.3px]" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        style={{ color: warnaNilai, fontVariant: ['tabular-nums'] }}
        className="font-sans text-[15.5px] font-semibold"
        numberOfLines={1}
      >
        {nilai}
      </Text>
    </View>
  );
}

/**
 * Baris pengingat jatuh tempo (mockup: .pro-row). Bukan Pro: terkunci, membuka layar Premium.
 * Pro: membuka pengaturan pengingat yang sudah ada di tab Akun.
 */
export function BarisPengingatPro({ pro, onPress }: { pro: boolean; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pro ? 'Atur pengingat jatuh tempo' : 'Pengingat jatuh tempo, fitur Pro'}
      onPress={onPress}
      style={{ borderStyle: 'dashed' }}
      className="flex-row items-center gap-[11px] rounded-[20px] border border-line bg-card px-3.5 py-3"
    >
      <Ikon nama="ui-bell" ukuran={19} warna={t.fg2} />
      <View className="min-w-0 flex-1 gap-px">
        <Text className="font-sans text-[13.5px] font-semibold text-fg">Pengingat jatuh tempo</Text>
        <Text className="font-sans text-[11.5px] leading-4 text-fg2">
          {pro ? 'Atur hari dan jam notifikasi di Akun.' : 'Notifikasi push sebelum tagihan jatuh tempo.'}
        </Text>
      </View>
      {pro ? (
        <Ikon nama="ui-chev" ukuran={18} warna={t.mid} />
      ) : (
        <>
          <View className="rounded-full border border-line bg-card2 px-2 py-0.5">
            <Text className="font-sans text-[10.5px] font-bold text-fg2">Pro</Text>
          </View>
          <Ikon nama="ui-lock" ukuran={19} warna={t.fg2} />
        </>
      )}
    </Pressable>
  );
}
