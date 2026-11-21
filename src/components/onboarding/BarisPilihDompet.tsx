import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { useTheme } from '@/theme/ThemeProvider';

/** Petak ikon 40px (.row-tile); `aktif` memakai warna aksen lembut. */
export function PetakIkon({ ikon, aktif = false, ukuran = 20 }: { ikon: NamaIkon; aktif?: boolean; ukuran?: number }) {
  const { t } = useTheme();
  return (
    <View
      style={{ borderColor: aktif ? 'transparent' : t.line, backgroundColor: aktif ? t.accSoft : t.card2 }}
      className="h-10 w-10 items-center justify-center rounded-[13px] border"
    >
      <Ikon nama={ikon} ukuran={ukuran} warna={aktif ? t.accInk : t.fg2} />
    </View>
  );
}

type Props = {
  nama: string;
  hint: string;
  ikon: NamaIkon;
  dipilih: boolean;
  terkunci: boolean;
  pertama: boolean;
  onToggle: () => void;
};

/** Baris dompet yang bisa dicentang (.row + .switch). `terkunci` = sudah dibuat di percobaan sebelumnya. */
export function BarisPilihDompet({ nama, hint, ikon, dipilih, terkunci, pertama, onToggle }: Props) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={nama}
      accessibilityState={{ checked: dipilih, disabled: terkunci }}
      disabled={terkunci}
      onPress={onToggle}
      style={{
        minHeight: 62,
        borderTopWidth: pertama ? 0 : 1,
        borderTopColor: t.line,
        backgroundColor: dipilih ? t.card2 : 'transparent',
      }}
      className="flex-row items-center gap-3 px-4 py-[11px]"
    >
      <PetakIkon ikon={ikon} aktif={dipilih} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className="text-[14.5px] font-semibold leading-[19px] text-fg font-sans">
          {nama}
        </Text>
        <Text numberOfLines={1} className="text-[11.5px] leading-[16px] text-mid font-sans">
          {hint}
        </Text>
      </View>
      <View
        style={{
          width: 42,
          height: 25,
          borderRadius: 13,
          borderWidth: 1,
          borderColor: dipilih ? t.acc : t.line,
          backgroundColor: dipilih ? t.acc : t.card2,
          opacity: terkunci ? 0.6 : 1,
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: 19,
            height: 19,
            borderRadius: 10,
            backgroundColor: t.card,
            transform: [{ translateX: dipilih ? 17 : 0 }],
          }}
        />
      </View>
    </Pressable>
  );
}
