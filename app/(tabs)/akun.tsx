import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip } from '@/components/Chip';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { walletBalances } from '@/domain/balances';
import { formatRupiah } from '@/domain/money';
import type { TipeDompet, Wallet } from '@/domain/types';
import { useAllTransactions } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { useTheme } from '@/theme/ThemeProvider';
import type { Pref } from '@/theme/tokens';

const TIPE: { v: TipeDompet; label: string }[] = [
  { v: 'harian', label: 'Harian' },
  { v: 'darurat', label: 'Darurat' },
  { v: 'investasi', label: 'Investasi' },
];
const TEMA: { v: Pref; label: string }[] = [
  { v: 'sistem', label: 'Sistem' },
  { v: 'terang', label: 'Terang' },
  { v: 'gelap', label: 'Gelap' },
];

function Baris({ w, saldo, onPress }: { w: Wallet; saldo: number | undefined; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Dompet ${w.nama}`}
      onPress={onPress}
      className="flex-row items-center justify-between border-b border-line py-3"
    >
      <Text className="text-fg font-sans">{w.nama}</Text>
      <Text className="text-fg font-sans">{saldo === undefined ? '…' : formatRupiah(saldo)}</Text>
    </Pressable>
  );
}

export default function Akun() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { pref, setPref } = useTheme();
  const wallets = useWallets().data ?? [];
  const txs = useAllTransactions();
  const [arsipBuka, setArsipBuka] = useState(false);
  // Dompet arsip tetap dihitung dalam saldo (aturan domain).
  const saldo = txs.data ? walletBalances(wallets, txs.data) : null;
  const buka = (id: string) => router.push(`/dompet/${id}`);
  const aktif = wallets.filter((w) => !w.diarsip);
  const arsip = wallets.filter((w) => w.diarsip);

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 px-5 pb-8 pt-12">
      <Text className="text-2xl font-bold text-fg font-sans">Akun</Text>

      {TIPE.map(({ v, label }) => {
        const daftar = aktif.filter((w) => w.tipe === v);
        if (daftar.length === 0) return null;
        return (
          <View key={v}>
            <Text className="mb-1 text-xs font-semibold uppercase text-mid font-sans">{label}</Text>
            {daftar.map((w) => (
              <Baris key={w.id} w={w} saldo={saldo?.[w.id]} onPress={() => buka(w.id)} />
            ))}
          </View>
        );
      })}

      <Tombol label="Tambah dompet" onPress={() => router.push('/dompet/baru')} />

      {arsip.length > 0 ? (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Diarsipkan"
            accessibilityState={{ expanded: arsipBuka }}
            onPress={() => setArsipBuka((b) => !b)}
            className="py-2"
          >
            <Text className="text-mid font-sans">{`Diarsipkan (${arsip.length}) ${arsipBuka ? '▾' : '▸'}`}</Text>
          </Pressable>
          {arsipBuka
            ? arsip.map((w) => <Baris key={w.id} w={w} saldo={saldo?.[w.id]} onPress={() => buka(w.id)} />)
            : null}
        </View>
      ) : null}

      <View>
        <Text className="mb-2 text-xs font-semibold uppercase text-mid font-sans">Tampilan</Text>
        <View className="flex-row gap-2">
          {TEMA.map((x) => (
            <Chip key={x.v} label={x.label} selected={pref === x.v} onPress={() => setPref(x.v)} />
          ))}
        </View>
      </View>

      <Tombol label="Keluar" onPress={() => void signOut()} />
    </ScrollView>
  );
}
