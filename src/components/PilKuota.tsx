import { Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { Tombol } from '@/components/Tombol';
import { useTheme } from '@/theme/ThemeProvider';

// Pil sisa kuota catat AI (kit: .quota-pill).
export function PilKuota({ sisa }: { sisa: number }) {
  const { t } = useTheme();
  return (
    <View className="flex-row items-center self-center rounded-full border border-line bg-card px-3.5 py-2" style={{ gap: 8 }}>
      <Ikon nama="status-kuota" ukuran={18} warna={t.accInk} />
      <Text className="text-[13px] text-fg2 font-sans">{`Sisa ${sisa} catat AI bulan ini`}</Text>
    </View>
  );
}

// Kartu saat kuota habis: catat manual tetap tanpa batas.
export function KartuKuotaHabis({ onCatatManual }: { onCatatManual: () => void }) {
  const { t } = useTheme();
  return (
    <View className="rounded-2xl border border-line bg-card p-4" style={{ gap: 12 }}>
      <View className="flex-row items-start" style={{ gap: 10 }}>
        <Ikon nama="status-kuota" ukuran={22} warna={t.mid} />
        <Text className="flex-1 text-[15px] font-semibold text-fg font-sans">
          Kuota catat AI bulan ini sudah habis. Kamu masih bisa catat manual tanpa batas.
        </Text>
      </View>
      <Tombol label="Catat manual" primary onPress={onCatatManual} />
      <Text className="text-center text-[13px] text-mid font-sans">Pro dengan catat AI tanpa batas segera hadir.</Text>
    </View>
  );
}
