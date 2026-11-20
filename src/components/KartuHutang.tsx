import { Pressable, Text, View } from 'react-native';
import { Lencana } from '@/components/hutang/BagianHutang';
import { labelJenis, labelTanggal, porsiTerbayar } from '@/components/hutang/tampilan';
import { Ikon } from '@/components/ikon/Ikon';
import { hariMenuju, labelJatuhTempo } from '@/domain/hutang';
import { formatRupiah } from '@/domain/money';
import type { Hutang } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  hutang: Hutang;
  hariIni: string;
  onPress: () => void;
  /** Bila ada, tampil tombol "Bayar" di kaki kartu (hutang belum lunas dan tidak diarsip). */
  onBayar?: () => void;
};

// Lebar tombol Bayar; ruang yang sama dicadangkan di kaki kartu agar teks jatuh tempo tidak tertimpa.
const LEBAR_BAYAR = 96;

// Kartu hutang (mockup: .debt): ikon, pemberi + lencana jenis, sisa di kanan, bar terbayar, kaki jatuh tempo + Bayar.
export function KartuHutang({ hutang: h, hariIni, onPress, onBayar }: Props) {
  const { t } = useTheme();
  const lunas = h.sisa_pokok <= 0;
  const persen = Math.round(porsiTerbayar(h) * 100);
  const bisaBayar = !!onBayar && !lunas && !h.diarsip;
  const meta =
    h.tipe === 'cicilan_tetap'
      ? `${h.tagihan_lunas}/${h.jumlah_tagihan} lunas · ${formatRupiah(h.nominal_cicilan ?? 0)}/bln`
      : `Pokok ${formatRupiah(h.pokok_awal)} · ${h.metode ?? 'flat'}`;

  const jt = h.jatuh_tempo_berikutnya;
  const mendesak = !lunas && jt !== null && hariMenuju(jt, hariIni) <= 3;
  const sudahBayarBulanIni = h.bayar_terakhir?.slice(0, 7) === hariIni.slice(0, 7);
  const kaki = lunas
    ? { ikon: 'ui-check' as const, label: 'Status', nilai: 'Sudah lunas semua' }
    : jt
      ? { ikon: 'status-jatuh-tempo' as const, label: 'Jatuh tempo', nilai: `${labelTanggal(jt)} · ${labelJatuhTempo(jt, hariIni)}` }
      : {
          ikon: 'status-jatuh-tempo' as const,
          label: 'Jatuh tempo',
          nilai: sudahBayarBulanIni ? 'Bulan ini sudah dibayar' : 'Belum ada jadwal tagihan',
        };

  return (
    <View style={{ opacity: lunas ? 0.82 : 1 }} className="rounded-[20px] border border-line bg-card">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={h.pemberi}
        onPress={onPress}
        className="px-[15px] pb-[13px] pt-3.5"
      >
        <View className="flex-row items-center gap-[11px]">
          <View
            style={{ width: 40, height: 40 }}
            className={`items-center justify-center rounded-[13px] ${lunas ? 'bg-accsoft' : 'bg-card2'}`}
          >
            <Ikon nama="nav-hutang" ukuran={20} warna={lunas ? t.accInk : t.fg2} />
          </View>
          <View className="min-w-0 flex-1 gap-[3px]">
            <Text className="font-sans text-[15px] font-semibold text-fg" numberOfLines={1}>
              {h.pemberi}
            </Text>
            <View className="flex-row flex-wrap items-center gap-[5px]">
              <Lencana label={labelJenis(h)} />
              {lunas ? <Lencana label="Lunas" teal ikon="ui-check" /> : null}
              {h.diarsip ? <Lencana label="Diarsip" /> : null}
            </View>
          </View>
          <View className="items-end gap-0.5">
            <Text className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.6px] text-mid">
              {lunas ? 'Selesai' : 'Sisa'}
            </Text>
            <Text
              style={{ fontVariant: ['tabular-nums'] }}
              className="font-sans text-[15.5px] font-semibold text-fg"
              numberOfLines={1}
            >
              {formatRupiah(h.sisa_pokok)}
            </Text>
          </View>
        </View>

        <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
          <View className="h-1.5 rounded-full bg-acc" style={{ width: `${Math.max(2, persen)}%` }} />
        </View>
        <View className="mt-1.5 flex-row items-baseline gap-1.5">
          <Text className="font-sans text-[11px] text-fg2">
            <Text className="font-sans font-semibold text-fg">{`${persen}%`}</Text> terbayar
          </Text>
          <Text
            style={{ fontVariant: ['tabular-nums'] }}
            className="ml-auto flex-shrink font-sans text-[11px] text-fg2"
            numberOfLines={1}
          >
            {meta}
          </Text>
        </View>

        <View className="mt-[11px] flex-row items-center gap-2 border-t border-line pt-[11px]">
          <View className="min-w-0 flex-1 gap-0.5">
            <View className="flex-row items-center gap-[5px]">
              <Ikon nama={kaki.ikon} ukuran={12} warna={t.mid} />
              <Text className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.5px] text-mid">{kaki.label}</Text>
            </View>
            <Text
              className={`font-sans text-[12.5px] font-semibold ${mendesak ? 'text-dangerink' : 'text-fg'}`}
              numberOfLines={1}
            >
              {kaki.nilai}
            </Text>
          </View>
          {bisaBayar ? <View style={{ width: LEBAR_BAYAR, height: 38 }} /> : null}
        </View>
      </Pressable>

      {bisaBayar ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Bayar ${h.pemberi}`}
          onPress={onBayar}
          style={{ position: 'absolute', right: 15, bottom: 13, width: LEBAR_BAYAR, height: 38 }}
          className="flex-row items-center justify-center gap-1.5 rounded-full border border-accink"
        >
          <Ikon nama="ui-money" ukuran={15} warna={t.accInk} />
          <Text className="font-sans text-[13px] font-bold text-accink">Bayar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
