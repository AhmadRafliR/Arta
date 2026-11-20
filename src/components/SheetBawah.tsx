import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  terbuka: boolean;
  onTutup: () => void;
  children: React.ReactNode;
  testID?: string;
};

// Lembar bawah (mockup arta: .sheet + .scrim + .grabber): scrim gelap, sudut atas 26, pegangan kecil.
export function SheetBawah({ terbuka, onTutup, children, testID }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={terbuka} transparent animationType="slide" onRequestClose={onTutup} statusBarTranslucent>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tutup"
          onPress={onTutup}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(6,20,24,0.42)' }}
        />
        <View
          testID={testID}
          style={{ maxHeight: '88%', paddingBottom: 14 + insets.bottom, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}
          className="border-t border-line bg-card px-[18px] pt-2"
        >
          <View className="mb-3 h-1 w-[38px] self-center rounded-full bg-line" />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-3">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Kepala sheet: petak ikon aksen lembut, judul + subjudul, nominal di kanan. */
export function KepalaSheet({
  ikon,
  judul,
  sub,
  kanan,
  kananMasuk,
}: {
  ikon: NamaIkon;
  judul: string;
  sub?: string;
  kanan?: string;
  kananMasuk?: boolean;
}) {
  const { t } = useTheme();
  return (
    <View className="flex-row items-center gap-3">
      <View style={{ width: 42, height: 42 }} className="items-center justify-center rounded-[14px] bg-accsoft">
        <Ikon nama={ikon} ukuran={21} warna={t.accInk} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans text-base font-semibold text-fg" numberOfLines={1}>
          {judul}
        </Text>
        {sub ? (
          <Text className="font-sans text-xs text-fg2" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {kanan ? (
        <Text
          style={{ fontVariant: ['tabular-nums'] }}
          className={`font-sans text-base font-semibold ${kananMasuk ? 'text-accink' : 'text-fg'}`}
        >
          {kanan}
        </Text>
      ) : null}
    </View>
  );
}

/** Daftar rincian bergaris (mockup: .detail-list > .detail-line). */
export function DaftarDetail({ baris }: { baris: { label: string; nilai: string }[] }) {
  return (
    <View className="overflow-hidden rounded-[14px] border border-line">
      {baris.map((b, i) => (
        <View key={b.label} className={`flex-row items-baseline gap-3 px-3 py-[9px] ${i > 0 ? 'border-t border-line' : ''}`}>
          <Text className="font-sans text-[12.5px] text-mid">{b.label}</Text>
          <Text className="ml-auto flex-1 text-right font-sans text-[12.5px] font-semibold text-fg" numberOfLines={1}>
            {b.nilai}
          </Text>
        </View>
      ))}
    </View>
  );
}
