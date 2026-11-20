import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeTier } from '@/components/BadgeTier';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

type Rincian = { harian: number; darurat: number; investasi: number; hutang: number };

type Props = {
  nama: string;
  email?: string | null;
  pro: boolean;
  /** null selama saldo memuat. */
  kekayaan: number | null;
  keterangan?: string | null;
  rincian?: Rincian | null;
};

/** Inisial maksimal dua huruf dari nama (mockup: .avatar). */
export function inisial(nama: string): string {
  const huruf = nama
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k.charAt(0).toUpperCase())
    .join('');
  return huruf || 'A';
}

function ItemRincian({ ikon, label, nilai, hutang }: { ikon: NamaIkon; label: string; nilai: string; hutang?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={{ width: '50%' }} className="min-w-0 gap-px pr-3">
      <View className="flex-row items-center gap-[5px]">
        <Ikon nama={ikon} ukuran={13} warna={t.amSub} />
        <Text style={{ color: t.amSub }} className="font-sans text-[11px] font-semibold" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        style={{ color: hutang ? t.plDownFg : t.heroFg, fontVariant: ['tabular-nums'] }}
        className="font-sans text-sm font-semibold"
        numberOfLines={1}
      >
        {nilai}
      </Text>
    </View>
  );
}

// Kartu profil bergradien (mockup akun: .prof): avatar, nama, email, badge tier, kekayaan bersih, rincian.
export function KartuProfilAkun({ nama, email, pro, kekayaan, keterangan, rincian }: Props) {
  const { t } = useTheme();
  return (
    <LinearGradient
      testID="kartu-profil"
      colors={[t.heroFrom, t.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, paddingTop: 16, paddingBottom: 15, paddingHorizontal: 17, overflow: 'hidden' }}
    >
      {/* Lingkaran hiasan di pojok kanan atas. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -38,
          top: -50,
          width: 156,
          height: 156,
          borderRadius: 78,
          borderWidth: 1,
          borderColor: t.amLine,
          opacity: 0.5,
        }}
      />
      <View className="flex-row items-center gap-[11px]">
        <View
          style={{ width: 46, height: 46, borderRadius: 16, borderWidth: 1, borderColor: t.amLine, overflow: 'hidden' }}
          className="items-center justify-center"
        >
          <View
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: t.amLine, opacity: 0.55 }}
          />
          <Text style={{ color: t.heroFg }} className="font-sans text-base font-bold">
            {inisial(nama)}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-px">
          <Text style={{ color: t.heroFg }} className="font-sans text-[16.5px] font-semibold" numberOfLines={1}>
            {nama}
          </Text>
          {email ? (
            <Text style={{ color: t.amSub }} className="font-sans text-xs" numberOfLines={1}>
              {email}
            </Text>
          ) : null}
        </View>
        <View style={{ borderRadius: 999, borderWidth: 1, borderColor: t.amLine }}>
          <BadgeTier tier={pro ? 'pro' : 'free'} tinggi={24} />
        </View>
      </View>

      <View className="mt-[15px]">
        <Text style={{ color: t.amSub }} className="font-sans text-[11px] font-semibold uppercase tracking-[1.5px]">
          Kekayaan bersih
        </Text>
        <Text
          style={{ color: t.heroFg, fontVariant: ['tabular-nums'] }}
          className="mt-[3px] font-sans text-[29px] font-semibold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {kekayaan === null ? '…' : formatRupiah(kekayaan)}
        </Text>
        {keterangan ? (
          <Text style={{ color: t.amSub }} className="mt-[3px] font-sans text-[11.5px]">
            {keterangan}
          </Text>
        ) : null}
      </View>

      {rincian ? (
        <View style={{ borderTopWidth: 1, borderTopColor: t.amLine }} className="mt-[13px] flex-row flex-wrap gap-y-2 pt-3">
          <ItemRincian ikon="wallet-harian" label="Dompet harian" nilai={formatRupiah(rincian.harian)} />
          <ItemRincian ikon="ui-shield" label="Dana darurat" nilai={formatRupiah(rincian.darurat)} />
          <ItemRincian ikon="wallet-investasi" label="Investasi" nilai={formatRupiah(rincian.investasi)} />
          <ItemRincian
            ikon="nav-hutang"
            label="Sisa hutang"
            nilai={rincian.hutang > 0 ? `−${formatRupiah(rincian.hutang)}` : formatRupiah(0)}
            hutang
          />
        </View>
      ) : null}
    </LinearGradient>
  );
}
