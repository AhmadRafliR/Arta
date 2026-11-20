import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeTier } from '@/components/BadgeTier';
import { Chip } from '@/components/Chip';
import { PengaturanPengingat } from '@/components/PengaturanPengingat';
import { Tombol } from '@/components/Tombol';
import { useAuth } from '@/auth/AuthProvider';
import { walletBalances } from '@/domain/balances';
import { formatRupiah } from '@/domain/money';
import type { TipeDompet, Wallet } from '@/domain/types';
import { useAllTransactions } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { useStatusLangganan } from '@/data/langganan';
import { teksStatusLangganan } from '@/langganan/teks';
import { URL_KEBIJAKAN_PRIVASI } from '@/config';
import { useTheme } from '@/theme/ThemeProvider';
import type { Pref } from '@/theme/tokens';
import { useGulirPulau } from '@/nav/useGulirPulau';
import { spacerNav } from '@/nav/pulau';

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

function BarisMenu({ label, onPress, bahaya }: { label: string; onPress: () => void; bahaya?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center justify-between border-b border-line py-3"
    >
      <Text style={bahaya ? { color: t.dangerInk } : undefined} className={`font-sans ${bahaya ? '' : 'text-fg'}`}>
        {label}
      </Text>
      <Text className="text-mid font-sans">›</Text>
    </Pressable>
  );
}

export default function Akun() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gulir = useGulirPulau('akun');
  const { signOut } = useAuth();
  const { pref, setPref } = useTheme();
  const wallets = useWallets().data ?? [];
  const txs = useAllTransactions();
  const [arsipBuka, setArsipBuka] = useState(false);
  const langganan = useStatusLangganan();
  const pro = langganan.data?.pro === true;
  // Dompet arsip tetap dihitung dalam saldo (aturan domain).
  const saldo = txs.data ? walletBalances(wallets, txs.data) : null;
  const buka = (id: string) => router.push(`/dompet/${id}`);
  const aktif = wallets.filter((w) => !w.diarsip);
  const arsip = wallets.filter((w) => w.diarsip);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-4 px-5 pt-12"
      contentContainerStyle={{ paddingBottom: spacerNav(insets.bottom) }}
      {...gulir}
    >
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
        <View className="flex-row gap-1 self-start rounded-full border border-line bg-card p-1">
          {TEMA.map((x) => (
            <Chip key={x.v} label={x.label} selected={pref === x.v} onPress={() => setPref(x.v)} />
          ))}
        </View>
      </View>

      <View>
        <Text className="mb-2 text-xs font-semibold uppercase text-mid font-sans">Langganan</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pro ? 'Kelola langganan Pro' : 'Lihat Pro'}
          onPress={() => router.push('/premium')}
          className="flex-row items-center gap-3 rounded-2xl border border-line bg-card p-4"
        >
          <BadgeTier tier={pro ? 'pro' : 'free'} tinggi={28} />
          <View className="flex-1">
            <Text className="text-fg font-sans font-semibold">{teksStatusLangganan(langganan.data)}</Text>
            <Text className="text-mid font-sans text-xs">{pro ? 'Kelola langganan' : 'Coba Pro gratis 14 hari'}</Text>
          </View>
          <Text className="text-mid font-sans">›</Text>
        </Pressable>
      </View>

      <View>
        <Text className="mb-2 text-xs font-semibold uppercase text-mid font-sans">Pengingat</Text>
        <PengaturanPengingat pro={pro} onBukaPremium={() => router.push('/premium?dari=pengingat')} />
      </View>

      <View>
        <Text className="mb-1 text-xs font-semibold uppercase text-mid font-sans">Data & privasi</Text>
        <BarisMenu label={pro ? 'Ekspor data' : 'Ekspor data · Pro'} onPress={() => router.push('/ekspor')} />
        <BarisMenu label="Kebijakan privasi" onPress={() => void WebBrowser.openBrowserAsync(URL_KEBIJAKAN_PRIVASI)} />
        <BarisMenu label="Hapus akun" bahaya onPress={() => router.push('/hapus-akun')} />
      </View>

      <Tombol label="Keluar" onPress={() => void signOut()} />
    </ScrollView>
  );
}
