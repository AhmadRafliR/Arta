import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { PetakIkon } from './BarisPilihDompet';

type Props = {
  nama: string;
  terkunci: boolean;
  fokus: boolean;
  onNama: (v: string) => void;
  onHapus: () => void;
};

/** Baris "Dompet lain" (dompet tambahan bertipe harian): nama bebas + Hapus. Terkunci bila sudah dibuat. */
export function BarisDompetLain({ nama, terkunci, fokus, onNama, onHapus }: Props) {
  const { t } = useTheme();
  return (
    <View style={{ borderColor: t.line }} className="min-h-[62px] flex-row items-center gap-3 rounded-[20px] border bg-card px-4 py-[11px]">
      <PetakIkon ikon="ui-pocket" aktif />
      <TextInput
        value={nama}
        editable={!terkunci}
        autoFocus={fokus}
        onChangeText={onNama}
        placeholder="Nama dompet"
        placeholderTextColor={t.mid}
        accessibilityLabel="Nama dompet"
        style={{ borderColor: t.line }}
        className="min-h-[44px] min-w-0 flex-1 rounded-xl border px-3 py-2 text-[14.5px] font-semibold text-fg font-sans"
      />
      {terkunci ? (
        <Text className="text-[11.5px] text-mid font-sans">sudah dibuat</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hapus dompet"
          onPress={onHapus}
          style={{ minHeight: 44, minWidth: 44 }}
          className="items-center justify-center"
        >
          <Text className="text-[11.5px] font-semibold text-mid font-sans">Hapus</Text>
        </Pressable>
      )}
    </View>
  );
}
