import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { useTheme } from '@/theme/ThemeProvider';

/** Kepala seksi (.sec-head): judul tebal di kiri, catatan kecil di kanan. */
export function KepalaSeksi({ judul, catatan }: { judul: string; catatan: string }) {
  return (
    <View className="flex-row items-baseline gap-2 px-0.5">
      <Text accessibilityRole="header" className="text-[13.5px] font-bold text-fg font-sans" style={{ letterSpacing: -0.13 }}>
        {judul}
      </Text>
      <Text className="ml-auto text-[11.5px] font-semibold text-mid font-sans">{catatan}</Text>
    </View>
  );
}

/** Kolom galat (.err): latar danger-soft, ikon peringatan. Tidak dirender bila kosong. */
export function KolomGalat({ pesan }: { pesan: string | null }) {
  const { t } = useTheme();
  if (!pesan) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-[7px] rounded-xl bg-dangersoft px-3 py-[9px]"
    >
      <Ikon nama="ui-alert" ukuran={15} warna={t.dangerInk} />
      <Text className="flex-1 text-xs font-semibold leading-[16px] text-dangerink font-sans">{pesan}</Text>
    </View>
  );
}

/** Catatan kaki berikon info (.note-line). */
export function CatatanInfo({ children }: { children: ReactNode }) {
  const { t } = useTheme();
  return (
    <View className="flex-row items-start gap-[7px] px-0.5">
      <View style={{ marginTop: 1 }}>
        <Ikon nama="ui-info" ukuran={14} warna={t.mid} />
      </View>
      <Text className="flex-1 text-[11.5px] leading-[17px] text-mid font-sans">{children}</Text>
    </View>
  );
}
