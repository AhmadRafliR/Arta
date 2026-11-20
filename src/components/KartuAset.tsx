import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { formatRupiah } from '@/domain/money';
import type { RingkasAset } from '@/domain/investasi';
import { useTheme } from '@/theme/ThemeProvider';

/** `+Rp30.000 (+11,5%)`; persen dilewati bila null. Rugi memakai tanda minus dari formatRupiah. */
export function untungTeks(untung: number, persen: number | null): string {
  const uang = untung > 0 ? `+${formatRupiah(untung)}` : formatRupiah(untung);
  if (persen === null) return uang;
  const p = `${persen > 0 ? '+' : ''}${String(persen).replace('.', ',')}%`;
  return `${uang} (${p})`;
}

/** Gaya lencana mockup (.pl / .hero-pl): `+Rp30.000 · +11,5%`; persen dilewati bila null. */
export function plTeks(untung: number, persen: number | null): string {
  const uang = untung > 0 ? `+${formatRupiah(untung)}` : formatRupiah(untung);
  if (persen === null) return uang;
  return `${uang} · ${persen > 0 ? '+' : ''}${String(persen).replace('.', ',')}%`;
}

type TipeAset = { ikon: NamaIkon; label: string | null };

/**
 * Data dompet investasi tidak menyimpan jenis aset; ikon/label jenis ditebak dari nama
 * (hanya tampilan). Tidak cocok → ikon investasi umum tanpa label.
 */
export function tipeAset(nama: string): TipeAset {
  const n = nama.toLowerCase();
  if (/emas|antam|gold|logam mulia/.test(n)) return { ikon: 'tipe-emas', label: 'Emas' };
  if (/kripto|crypto|bitcoin|btc|ethereum|\beth\b|usdt|koin/.test(n)) return { ikon: 'tipe-kripto', label: 'Kripto' };
  if (/reksa|\brd\b|fund/.test(n)) return { ikon: 'tipe-reksa', label: 'Reksa dana' };
  if (/saham|stock|\bidx\b|\bbei\b/.test(n)) return { ikon: 'tipe-saham', label: 'Saham' };
  return { ikon: 'wallet-investasi', label: null };
}

export function TombolKecil({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`rounded-full border border-line bg-card px-4 py-2 ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className="text-[13px] font-semibold text-fg font-sans">{label}</Text>
    </Pressable>
  );
}

/** Lencana untung/rugi pada kartu terang (mockup: .pl.is-up / .pl.is-down). Untung 0 dianggap naik. */
export function LencanaPL({ untung, persen }: { untung: number; persen: number | null }) {
  const { t } = useTheme();
  const naik = untung >= 0;
  return (
    <View
      className={`flex-row items-center gap-1 self-start rounded-full px-[9px] py-[3px] ${naik ? 'bg-accsoft' : 'bg-dangersoft'}`}
    >
      <Ikon nama={naik ? 'ui-trend-up' : 'ui-trend-down'} ukuran={12} warna={naik ? t.accInk : t.dangerInk} />
      <Text
        style={{ color: naik ? t.accInk : t.dangerInk, fontVariant: ['tabular-nums'] }}
        className="font-sans text-[11.5px] font-bold"
        numberOfLines={1}
      >
        {plTeks(untung, persen)}
      </Text>
    </View>
  );
}

/** Tombol aksi sheet berikon (mockup: .btn-sheet / .is-primary / .is-danger). */
export function TombolAksiAset({
  label,
  ikon,
  onPress,
  primary,
  bahaya,
}: {
  label: string;
  ikon: NamaIkon;
  onPress: () => void;
  primary?: boolean;
  bahaya?: boolean;
}) {
  const { t } = useTheme();
  const warna = primary ? t.accFg : bahaya ? t.dangerInk : t.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 46, borderRadius: 14, opacity: pressed ? 0.7 : 1 })}
      className={`flex-1 flex-row items-center justify-center gap-[7px] px-3.5 py-[11px] ${
        primary ? 'bg-acc' : bahaya ? 'border border-dangersoft bg-card' : 'border border-line bg-card'
      }`}
    >
      <Ikon nama={ikon} ukuran={18} warna={warna} />
      <Text style={{ color: warna }} className="font-sans text-[14px] font-semibold" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

type Props = {
  a: RingkasAset;
  onBeli: () => void;
  onJual: () => void;
  onNilai: () => void;
  /** Bila ada, seluruh kartu bisa ditekan (buka rincian) dan tombol aksi pindah ke sheet. */
  onBuka?: () => void;
  /** Tanggal update nilai terakhir yang sudah diformat (mis. "18 Nov"). */
  update?: string | null;
};

// Kartu aset (mockup arta: .asset): petak ikon jenis, nama, nilai di kanan, kaki berisi lencana untung/rugi.
export function KartuAset({ a, onBeli, onJual, onNilai, onBuka, update }: Props) {
  const { t } = useTheme();
  const tipe = tipeAset(a.nama);
  const isi = (
    <>
      <View className="flex-row items-center gap-[11px]">
        <View style={{ width: 40, height: 40 }} className="items-center justify-center rounded-[13px] bg-card2">
          <Ikon nama={tipe.ikon} ukuran={20} warna={t.fg2} />
        </View>
        <View className="min-w-0 flex-1 gap-[3px]">
          <Text className="font-sans text-[15px] font-semibold text-fg" numberOfLines={1}>
            {a.nama}
          </Text>
          <View className="min-w-0 flex-row items-center gap-1.5">
            {tipe.label ? (
              <View className="rounded-full border border-line bg-card2 px-2 py-0.5">
                <Text className="font-sans text-[10.5px] font-bold text-fg2">{tipe.label}</Text>
              </View>
            ) : null}
            <Text
              style={{ fontVariant: ['tabular-nums'] }}
              className="flex-shrink font-sans text-[11px] font-medium text-mid"
              numberOfLines={1}
            >
              {`Modal ${formatRupiah(a.modal)}`}
            </Text>
          </View>
        </View>
        <View className="items-end gap-0.5">
          <Text className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.6px] text-mid">Nilai</Text>
          <Text
            style={{ fontVariant: ['tabular-nums'] }}
            className="font-sans text-[15.5px] font-semibold text-fg"
            numberOfLines={1}
          >
            {formatRupiah(a.nilai)}
          </Text>
        </View>
      </View>
      <View className="mt-[11px] flex-row items-center gap-2.5 border-t border-line pt-2.5">
        <LencanaPL untung={a.untung} persen={a.persen} />
        <Text className="ml-auto font-sans text-[11px] text-mid" numberOfLines={1}>
          {update ?? '—'}
        </Text>
      </View>
      {onBuka ? null : (
        <View className="mt-3 flex-row flex-wrap gap-2">
          <TombolKecil label="Beli" onPress={onBeli} />
          <TombolKecil label="Jual" onPress={onJual} />
          <TombolKecil label="Update nilai" onPress={onNilai} />
        </View>
      )}
    </>
  );
  const kelas = 'rounded-[20px] border border-line bg-card px-3.5 pb-3 pt-[13px]';
  if (!onBuka) return <View className={kelas}>{isi}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rincian ${a.nama}`}
      accessibilityHint="Buka rincian dan aksi aset"
      onPress={onBuka}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      className={kelas}
    >
      {isi}
    </Pressable>
  );
}
