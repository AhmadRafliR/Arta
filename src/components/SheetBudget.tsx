import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { IsiBudget } from '@/components/IsiBudget';
import { SheetBawah } from '@/components/SheetBawah';
import { Tombol } from '@/components/Tombol';

/**
 * Sheet "Budget bulanan" di layar Akun (mockup akun: #budgetView). Ketuk baris untuk mengubah,
 * "Tambah budget" untuk menambah; sheet ditutup dulu supaya modal tidak menumpuk.
 */
export function SheetBudget({ terbuka, onTutup }: { terbuka: boolean; onTutup: () => void }) {
  const router = useRouter();
  const ke = (href: string) => {
    onTutup();
    router.push(href as never);
  };
  return (
    <SheetBawah terbuka={terbuka} onTutup={onTutup} testID="sheet-budget">
      <IsiBudget onTutup={onTutup} onUbah={(id) => ke(`/budget/ubah?id=${id}`)} />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Tombol label="Tutup" onPress={onTutup} />
        </View>
        <View className="flex-1">
          <Tombol primary label="Tambah budget" onPress={() => ke('/budget/ubah')} />
        </View>
      </View>
    </SheetBawah>
  );
}
