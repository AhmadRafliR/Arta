import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeTier } from '@/components/BadgeTier';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { useTheme } from '@/theme/ThemeProvider';

const MENU: { label: string; ikon: NamaIkon; rute: string; pro?: boolean }[] = [
  { label: 'Budget', ikon: 'status-budget-aman', rute: '/budget' },
  { label: 'Dana darurat', ikon: 'wallet-darurat', rute: '/dana-darurat' },
  { label: 'Investasi', ikon: 'wallet-investasi', rute: '/investasi' },
  { label: 'Laporan email', ikon: 'act-ekspor', rute: '/laporan', pro: true },
];

/** Bagian "Rencana keuangan" di layar Akun: pintu masuk ke budget, dana darurat, investasi, dan laporan. */
export function MenuRencana() {
  const router = useRouter();
  const { t } = useTheme();
  return (
    <View>
      <Text className="mb-1 text-xs font-semibold uppercase text-mid font-sans">Rencana keuangan</Text>
      {MENU.map((m) => (
        <Pressable
          key={m.rute}
          accessibilityRole="button"
          accessibilityLabel={m.label}
          onPress={() => router.push(m.rute as never)}
          className="flex-row items-center gap-3 border-b border-line py-3"
        >
          <Ikon nama={m.ikon} ukuran={22} warna={t.fg2} />
          <Text className="flex-1 text-fg font-sans">{m.label}</Text>
          {m.pro ? <BadgeTier tier="pro" tinggi={20} /> : null}
          <Text className="text-mid font-sans">›</Text>
        </Pressable>
      ))}
    </View>
  );
}
