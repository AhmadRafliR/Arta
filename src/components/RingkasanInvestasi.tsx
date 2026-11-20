import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { plTeks } from '@/components/KartuAset';
import { formatRupiah } from '@/domain/money';
import { NAMA_BULAN } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

/** 'YYYY-MM-DD' → "18 Nov 2026" (pendek: "18 Nov"). */
export function tanggalInvestasi(iso: string, pendek = false): string {
  const [y, m, d] = iso.split('-');
  const teks = `${Number(d)} ${NAMA_BULAN[Number(m) - 1] ?? ''}`;
  return pendek ? teks : `${teks} ${y}`;
}

/** Tanggal penyesuaian (update nilai) terakhir per dompet investasi; dompet tanpa update tidak ada di peta. */
export function updateTerakhirPerAset(
  txs: { tanggal: string; jenis: string; wallet_id: string | null }[],
): Record<string, string> {
  const peta: Record<string, string> = {};
  for (const x of txs) {
    if (x.jenis !== 'penyesuaian' || !x.wallet_id) continue;
    const lama = peta[x.wallet_id];
    if (!lama || x.tanggal > lama) peta[x.wallet_id] = x.tanggal;
  }
  return peta;
}

type Props = {
  totalNilai: number;
  totalModal: number;
  totalUntung: number;
  persen: number | null;
  /** 'YYYY-MM-DD' atau null bila belum pernah update nilai. */
  update: string | null;
  /** Sembunyikan lencana untung/rugi (mis. belum ada aset). */
  tanpaLencana?: boolean;
};

function ItemGrid({ ikon, label, nilai }: { ikon: NamaIkon; label: string; nilai: string }) {
  const { t } = useTheme();
  return (
    <View className="min-w-0 flex-1 gap-0.5">
      <View className="flex-row items-center gap-[5px]">
        <Ikon nama={ikon} ukuran={13} warna={t.amSub} />
        <Text style={{ color: t.amSub }} className="font-sans text-[11px] font-semibold tracking-[0.3px]">
          {label}
        </Text>
      </View>
      <Text
        style={{ color: t.heroFg, fontVariant: ['tabular-nums'] }}
        className="font-sans text-[15.5px] font-semibold"
        numberOfLines={1}
      >
        {nilai}
      </Text>
    </View>
  );
}

// Kartu ringkasan bergradien (mockup arta investasi: .hero): total nilai, lencana untung/rugi, modal + update terakhir.
export function RingkasanInvestasi({ totalNilai, totalModal, totalUntung, persen, update, tanpaLencana }: Props) {
  const { t } = useTheme();
  const naik = totalUntung >= 0;
  return (
    <LinearGradient
      colors={[t.heroFrom, t.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, paddingTop: 16, paddingBottom: 15, paddingHorizontal: 18, overflow: 'hidden' }}
    >
      {/* Lingkaran garis dekoratif di pojok kanan atas (mockup: .hero::after). */}
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
        Total nilai investasi
      </Text>
      <Text
        style={{ color: t.heroFg, fontVariant: ['tabular-nums'] }}
        className="mt-1 font-sans text-[32px] font-semibold"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {formatRupiah(totalNilai)}
      </Text>
      {tanpaLencana ? null : (
        <View
          style={{ backgroundColor: naik ? t.plUpBg : t.plDownBg }}
          className="mt-[9px] flex-row items-center gap-1.5 self-start rounded-full px-[11px] py-[5px]"
        >
          <Ikon nama={naik ? 'ui-trend-up' : 'ui-trend-down'} ukuran={14} warna={naik ? t.plUpFg : t.plDownFg} />
          <Text
            style={{ color: naik ? t.plUpFg : t.plDownFg, fontVariant: ['tabular-nums'] }}
            className="font-sans text-[12px] font-bold"
            numberOfLines={1}
          >
            {plTeks(totalUntung, persen)}
          </Text>
        </View>
      )}
      <View style={{ borderTopColor: t.amLine }} className="mt-[13px] flex-row gap-2 border-t pt-3">
        <ItemGrid ikon="wallet-harian" label="Modal awal" nilai={formatRupiah(totalModal)} />
        <ItemGrid ikon="status-jatuh-tempo" label="Update terakhir" nilai={update ? tanggalInvestasi(update) : '—'} />
      </View>
    </LinearGradient>
  );
}
