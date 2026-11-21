import { Pressable, Text, View } from 'react-native';
import { AmountInput } from '@/components/AmountInput';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';
import { PetakIkon } from './BarisPilihDompet';
import { LABEL_TIPE, PINTASAN, type ItemDompet } from './data';

type Props = {
  item: ItemDompet;
  saldo: number | null;
  target: number | null;
  /** Naik tiap pintasan ditekan: memasang ulang isian agar teksnya ikut berubah. */
  revisi: number;
  terkunci: boolean;
  onSaldo: (n: number | null) => void;
  onTarget: (n: number | null) => void;
  onPintasan: (n: number) => void;
};

/** Kartu isian saldo satu dompet terpilih (akun.html: .amt-row + .chip-row); Dana darurat punya target opsional. */
export function KartuSaldoDompet({ item, saldo, target, revisi, terkunci, onSaldo, onTarget, onPintasan }: Props) {
  const { t } = useTheme();
  const darurat = item.tipe === 'darurat';
  return (
    <View
      style={{ borderColor: t.line }}
      className="overflow-hidden rounded-[20px] border bg-card"
    >
      <View className="min-h-[64px] flex-row items-center gap-3 px-4 py-[11px]">
        <PetakIkon ikon={item.ikon} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text numberOfLines={1} className="text-[11.5px] font-semibold leading-[14px] text-mid font-sans">
            {item.nama}
          </Text>
          <Text numberOfLines={1} className="text-[11.5px] leading-[16px] text-mid font-sans">
            {LABEL_TIPE[item.tipe]}
            {darurat && target ? ` target ${formatRupiah(target)}` : ''}
          </Text>
        </View>
        <View style={{ width: 136 }}>
          <AmountInput
            key={`s-${revisi}`}
            value={saldo}
            allowZero
            editable={!terkunci}
            placeholder="0"
            onChange={onSaldo}
          />
        </View>
      </View>

      <View className="flex-row flex-wrap gap-1.5 px-4 pb-[10px]">
        {PINTASAN[item.tipe].map((v) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityLabel={`Isi ${item.nama} ${v ? formatRupiah(v) : 'kosong'}`}
            accessibilityState={{ disabled: terkunci }}
            disabled={terkunci}
            hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
            onPress={() => onPintasan(v)}
            style={{ borderColor: t.line }}
            className={`rounded-full border bg-card px-2.5 py-[5px] ${terkunci ? 'opacity-50' : ''}`}
          >
            <Text className="text-[11.5px] font-semibold leading-[14px] text-fg2 font-sans">
              {v ? formatRupiah(v) : 'Kosong'}
            </Text>
          </Pressable>
        ))}
      </View>

      {darurat ? (
        <View style={{ borderTopColor: t.line }} className="gap-1.5 border-t px-4 pb-3 pt-[10px]">
          <Text className="text-[11.5px] font-semibold text-mid font-sans">Target dana darurat (opsional)</Text>
          <AmountInput value={target} allowZero editable={!terkunci} placeholder="0" onChange={onTarget} />
        </View>
      ) : null}
    </View>
  );
}
