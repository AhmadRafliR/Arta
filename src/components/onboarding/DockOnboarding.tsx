import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  langkah: 1 | 2;
  /** Tombol utama tidak bisa ditekan (belum ada dompet / data tak valid / sedang menyimpan). */
  utamaNonaktif: boolean;
  lewatiNonaktif: boolean;
  busy: boolean;
  bawah: number;
  onUtama: () => void;
  onLewati: () => void;
  onKembali: () => void;
};

/** Dock bawah: tombol utama aksen, tautan "Lewati, mulai dari Rp0" (dan "Kembali" di langkah 2). */
export function DockOnboarding({ langkah, utamaNonaktif, lewatiNonaktif, busy, bawah, onUtama, onLewati, onKembali }: Props) {
  const { t } = useTheme();
  const label = langkah === 1 ? 'Lanjut isi saldo' : 'Simpan saldo awal';
  return (
    <View style={{ paddingBottom: Math.max(bawah, 18) }} className="bg-bg px-5 pt-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: utamaNonaktif, busy }}
        disabled={utamaNonaktif}
        onPress={onUtama}
        style={({ pressed }) => ({ minHeight: 52, borderRadius: 16, transform: [{ translateY: pressed ? 1 : 0 }] })}
        className={`flex-row items-center justify-center gap-[9px] border border-acc bg-acc px-[18px] py-[14px] ${utamaNonaktif ? 'opacity-50' : ''}`}
      >
        <Text style={{ color: t.accFg, letterSpacing: -0.08 }} className="text-[15px] font-bold font-sans">
          {label}
        </Text>
        {busy ? <ActivityIndicator size="small" color={t.accFg} /> : <Ikon nama="ui-arrow-right" ukuran={18} warna={t.accFg} />}
      </Pressable>
      <View className="mt-1.5 flex-row">
        {langkah === 2 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onKembali}
            style={{ minHeight: 44 }}
            className="flex-1 items-center justify-center p-2"
          >
            <Text className="text-[12.5px] font-semibold text-fg2 font-sans">Kembali</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lewati, mulai dari Rp0"
          accessibilityState={{ disabled: lewatiNonaktif }}
          disabled={lewatiNonaktif}
          onPress={onLewati}
          style={{ minHeight: 44 }}
          className={`flex-[2] items-center justify-center p-2 ${lewatiNonaktif ? 'opacity-50' : ''}`}
        >
          <Text className="text-[12.5px] font-semibold text-fg2 font-sans">Lewati, mulai dari Rp0</Text>
        </Pressable>
      </View>
    </View>
  );
}
