import { Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { useBudgets } from '@/data/budgets';
import { useTransactions } from '@/data/transactions';
import { peringatanBudget } from '@/domain/budget';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { kategori: string | null; nominal: number; tanggal: string; abaikanTxId?: string };

// Peringatan non-blokir di form catat. Kosong (atau data belum ada) -> tidak tampil.
export function PeringatanBudget({ kategori, nominal, tanggal, abaikanTxId }: Props) {
  const { t } = useTheme();
  const budgets = useBudgets();
  const txs = useTransactions(tanggal.slice(0, 7));
  if (!kategori || !budgets.data || budgets.data.length === 0 || !txs.data) return null;
  const hasil = peringatanBudget(budgets.data, txs.data, [{ kategori, nominal, tanggal }], abaikanTxId);
  if (hasil.length === 0) return null;
  return (
    <View className="gap-2" accessibilityLiveRegion="polite">
      {hasil.map((h) => {
        const warna = h.status === 'lewat' ? t.dangerInk : t.warnInk;
        return (
          // Gaya mockup arta: pil lembut bernada status (dangerSoft untuk lewat, warnBg untuk waspada).
          <View
            key={`${h.kategori}-${h.status}`}
            className={`flex-row items-center gap-2.5 rounded-[14px] px-3.5 py-2.5 ${h.status === 'lewat' ? 'bg-dangersoft' : 'bg-warnbg'}`}
          >
            <Ikon nama={`status-budget-${h.status}`} ukuran={18} warna={warna} />
            <Text className="flex-1 text-[12.5px] font-semibold font-sans" style={{ color: warna }}>
              {h.pesan}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
