import { useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { BadgeTier } from './BadgeTier';
import { BarisMenuAkun, KartuGrupAkun } from './BarisAkun';
import { Ikon } from './ikon/Ikon';
import { LabelSub } from './KartuSeksi';
import { Segmented } from './Segmented';
import { kirimNotifikasiUji, mintaIzinNotifikasi } from '@/notifikasi/lokal';
import {
  PENGINGAT_DEFAULT,
  usePengaturanPengingat,
  useSimpanPengingat,
  type HariSebelum,
  type PengaturanPengingat as Pengaturan,
} from '@/data/pengingat';

type Props = { pro: boolean; onBukaPremium: () => void };

const HARI: { nilai: HariSebelum; label: string }[] = [
  { nilai: 0, label: 'Hari H' },
  { nilai: 1, label: 'H-1' },
  { nilai: 3, label: 'H-3' },
];
const JAM = [7, 8, 12, 19];
const dua = (n: number) => String(n).padStart(2, '0');

export const PESAN_IZIN_DITOLAK = 'Izin notifikasi ditolak. Buka Pengaturan untuk mengizinkan.';

export function PengaturanPengingat({ pro, onBukaPremium }: Props) {
  const { t } = useTheme();
  const { data } = usePengaturanPengingat();
  const simpan = useSimpanPengingat();
  const [ditolak, setDitolak] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [infoUji, setInfoUji] = useState<string | null>(null);
  const p: Pengaturan = data ?? PENGINGAT_DEFAULT;

  if (!pro) {
    // Terkunci (mockup: .plan-row + badge Pro + gembok) -> buka layar premium.
    return (
      <KartuGrupAkun>
        <BarisMenuAkun
          pertama
          ikon="ui-alert"
          judul="Pengingat jatuh tempo"
          sub="Notifikasi untuk tagihan hutang."
          accessibilityLabel="Pengingat jatuh tempo, fitur Pro"
          onPress={onBukaPremium}
          chevron={false}
          kanan={
            <>
              <BadgeTier tier="pro" tinggi={20} />
              <Ikon nama="ui-lock" ukuran={15} warna={t.mid} />
            </>
          }
        />
      </KartuGrupAkun>
    );
  }

  const kirimUji = async () => {
    const ok = await kirimNotifikasiUji();
    setInfoUji(ok ? 'Notifikasi uji dikirim. Cek bilah notifikasi.' : 'Notifikasi uji gagal dikirim.');
  };

  const ubahAktif = async (nilai: boolean) => {
    setDitolak(false);
    setInfoUji(null);
    if (!nilai) {
      simpan.mutate({ ...p, aktif: false });
      return;
    }
    setSibuk(true);
    try {
      const h = await mintaIzinNotifikasi();
      if (h === 'diberikan') {
        simpan.mutate({ ...p, aktif: true });
      } else {
        setDitolak(true);
      }
    } finally {
      setSibuk(false);
    }
  };

  return (
    <KartuGrupAkun>
      <BarisMenuAkun
        pertama
        ikon="ui-bell"
        judul="Pengingat jatuh tempo"
        sub="Notifikasi untuk tagihan hutang."
        chevron={false}
        kanan={
          <Switch
            accessibilityLabel="Pengingat jatuh tempo"
            value={p.aktif}
            disabled={sibuk}
            onValueChange={ubahAktif}
            trackColor={{ false: t.line, true: t.acc }}
          />
        }
      />

      {ditolak ? (
        <View className="border-t border-line px-3.5 py-3">
          <Text className="font-sans text-[12.5px] text-fg2">{PESAN_IZIN_DITOLAK}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka Pengaturan"
            onPress={() => Linking.openSettings().catch(() => {})}
            className="mt-2 flex-row items-center gap-1.5 self-start rounded-full border border-line px-4 py-2"
          >
            <Ikon nama="ui-gear" ukuran={16} warna={t.fg} />
            <Text className="font-sans text-sm font-semibold text-fg">Buka Pengaturan</Text>
          </Pressable>
        </View>
      ) : null}

      {p.aktif ? (
        <View className="border-t border-line px-3.5 pb-3.5">
          <LabelSub>Ingatkan saya</LabelSub>
          <Segmented
            pilihan={HARI.map((h) => ({ nilai: String(h.nilai), label: h.label }))}
            nilai={String(p.hari_sebelum)}
            onChange={(v) => simpan.mutate({ ...p, hari_sebelum: Number(v) as HariSebelum })}
          />
          <LabelSub>Jam kirim</LabelSub>
          <Segmented
            pilihan={JAM.map((j) => ({ nilai: String(j), label: `${dua(j)}.00` }))}
            nilai={String(p.jam)}
            onChange={(v) => simpan.mutate({ ...p, jam: Number(v) })}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kirim notifikasi uji"
            onPress={kirimUji}
            className="mt-3 flex-row items-center gap-1.5 self-start rounded-full border border-line px-4 py-2"
          >
            <Ikon nama="ui-bell" ukuran={16} warna={t.fg} />
            <Text className="font-sans text-sm font-semibold text-fg">Kirim notifikasi uji</Text>
          </Pressable>
          {infoUji ? <Text className="mt-2 font-sans text-[12.5px] text-fg2">{infoUji}</Text> : null}
        </View>
      ) : null}
    </KartuGrupAkun>
  );
}
