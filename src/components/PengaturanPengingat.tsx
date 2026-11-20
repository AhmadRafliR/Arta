import { useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Chip } from './Chip';
import { daftarkanPush } from '@/notifikasi/push';
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
  const [alasan, setAlasan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const p: Pengaturan = data ?? PENGINGAT_DEFAULT;

  if (!pro) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pengingat jatuh tempo, fitur Pro"
        onPress={onBukaPremium}
        className="flex-row items-center justify-between rounded-2xl border border-line bg-card px-4 py-4"
      >
        <Text className="font-sans text-base font-semibold text-fg">Pengingat jatuh tempo · Pro</Text>
        <Text className="font-sans text-sm text-mid">Buka</Text>
      </Pressable>
    );
  }

  const ubahAktif = async (nilai: boolean) => {
    setDitolak(false);
    setAlasan(null);
    if (!nilai) {
      simpan.mutate({ ...p, aktif: false });
      return;
    }
    setSibuk(true);
    try {
      const h = await daftarkanPush();
      if (h.status === 'aktif') {
        simpan.mutate({ ...p, aktif: true });
      } else if (h.status === 'ditolak') {
        setDitolak(true);
      } else {
        setAlasan(h.alasan);
      }
    } finally {
      setSibuk(false);
    }
  };

  return (
    <View className="rounded-2xl border border-line bg-card px-4 py-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-base font-semibold text-fg">Pengingat jatuh tempo</Text>
        <Switch
          accessibilityLabel="Pengingat jatuh tempo"
          value={p.aktif}
          disabled={sibuk}
          onValueChange={ubahAktif}
          trackColor={{ false: t.line, true: t.acc }}
        />
      </View>

      {ditolak ? (
        <View className="mt-3">
          <Text className="font-sans text-sm text-mid">{PESAN_IZIN_DITOLAK}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka Pengaturan"
            onPress={() => Linking.openSettings().catch(() => {})}
            className="mt-2 self-start rounded-full border border-line px-4 py-2"
          >
            <Text className="font-sans text-sm font-semibold text-fg">Buka Pengaturan</Text>
          </Pressable>
        </View>
      ) : null}
      {alasan ? <Text className="mt-3 font-sans text-sm text-mid">{alasan}</Text> : null}

      {p.aktif ? (
        <View>
          <Text className="mt-4 font-sans text-sm text-mid">Ingatkan saya</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {HARI.map((h) => (
              <Chip
                key={h.nilai}
                label={h.label}
                selected={p.hari_sebelum === h.nilai}
                onPress={() => simpan.mutate({ ...p, hari_sebelum: h.nilai })}
              />
            ))}
          </View>
          <Text className="mt-4 font-sans text-sm text-mid">Jam kirim</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {JAM.map((j) => (
              <Chip
                key={j}
                label={`${dua(j)}.00`}
                selected={p.jam === j}
                onPress={() => simpan.mutate({ ...p, jam: j })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
