import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { aksesBerlaku, MENIT_AKSES_IKLAN, useAksesIklan, useKlaimAksesIklan, type FiturIklan } from '@/data/aksesIklan';
import { usePro } from '@/data/langganan';
import { tontonIklanReward, type HasilReward } from '@/iklan/reward';
import { useTheme } from '@/theme/ThemeProvider';
import { Ikon } from './ikon/Ikon';
import { Tombol } from './Tombol';

type Props = {
  fitur: FiturIklan;
  /** Nama fitur untuk kalimat ajakan, mis. "ekspor data". */
  nama: string;
  /** Alasan Pro untuk halaman premium (`?dari=`). */
  dari: string;
  children: ReactNode;
};

const PESAN_HASIL: Record<Exclude<HasilReward, 'selesai'>, string> = {
  dibatalkan: 'Iklan ditutup sebelum selesai. Tonton sampai habis untuk membuka fitur.',
  gagal: 'Iklan belum tersedia saat ini. Coba lagi sebentar.',
  'tidak-tersedia': 'Iklan tidak tersedia di perangkat ini. Kamu bisa berlangganan Pro untuk memakai fitur ini.',
};

function jamMenit(d: Date, zona: string | undefined): string {
  try {
    return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona }).format(d);
  } catch {
    return d.toTimeString().slice(0, 5);
  }
}

/**
 * Gerbang fitur untuk pengguna gratis: Pro → langsung terbuka. Non-Pro → tonton iklan reward sampai selesai
 * untuk membuka fitur selama 30 menit. Hadiah hanya dicatat bila iklan ditonton penuh.
 */
export function GerbangIklan({ fitur, nama, dari, children }: Props) {
  const router = useRouter();
  const { t } = useTheme();
  const { profile } = useAuth();
  const { pro, memuat } = usePro();
  const akses = useAksesIklan(fitur, !memuat && !pro);
  const klaim = useKlaimAksesIklan(fitur);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [, setDetak] = useState(0);

  const sampai = akses.data ?? null;
  const terbuka = aksesBerlaku(sampai);

  // Saat akses habis, render ulang tepat waktunya agar gerbang muncul lagi.
  useEffect(() => {
    if (!sampai || !terbuka) return;
    const sisa = sampai.getTime() - Date.now();
    const id = setTimeout(() => setDetak((n) => n + 1), Math.min(Math.max(sisa, 0) + 250, 2 ** 31 - 1));
    return () => clearTimeout(id);
  }, [sampai, terbuka]);

  if (memuat || (!pro && akses.isPending)) return <ActivityIndicator color={t.mid} accessibilityLabel="Memuat" />;
  if (pro) return <>{children}</>;

  async function tonton() {
    if (sibuk) return;
    setSibuk(true);
    setPesan(null);
    try {
      const hasil = await tontonIklanReward();
      if (hasil === 'selesai') {
        await klaim.mutateAsync();
      } else {
        setPesan(PESAN_HASIL[hasil]);
      }
    } catch (e) {
      const p = e && typeof e === 'object' && 'pesan' in e ? (e as { pesan?: unknown }).pesan : null;
      setPesan(typeof p === 'string' ? p : 'Akses belum bisa dibuka. Coba lagi.');
    } finally {
      setSibuk(false);
    }
  }

  if (terbuka && sampai) {
    return (
      <View className="gap-4">
        <View
          accessibilityLiveRegion="polite"
          className="flex-row items-center gap-2 rounded-2xl border border-line bg-card2 px-3.5 py-2.5"
        >
          <Ikon nama="ui-check" ukuran={16} warna={t.accInk} />
          <Text className="flex-1 font-sans text-[12.5px] text-fg2">
            {`Akses terbuka sampai ${jamMenit(sampai, profile?.zona_waktu ?? undefined)}. Berlangganan Pro untuk akses tanpa batas.`}
          </Text>
        </View>
        {children}
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="items-center gap-3 rounded-2xl border border-line bg-card2 px-6 py-8">
        <View className="h-16 w-16 items-center justify-center rounded-full border border-line bg-card">
          <Ikon nama="ui-lock" ukuran={30} warna={t.mid} />
        </View>
        <Text className="text-center font-sans font-bold text-fg" style={{ fontSize: 15 }}>
          {`Buka ${nama} gratis`}
        </Text>
        <Text className="text-center font-sans text-fg2" style={{ fontSize: 13.5, lineHeight: 20 }}>
          {`Tonton satu iklan singkat sampai selesai untuk memakai ${nama} selama ${MENIT_AKSES_IKLAN} menit. Atau berlangganan Pro tanpa iklan.`}
        </Text>
      </View>
      <Tombol primary label="Tonton iklan untuk membuka" busy={sibuk} disabled={sibuk} onPress={() => void tonton()} />
      <Tombol label="Lihat Pro" onPress={() => router.push(`/premium?dari=${dari}`)} />
      {pesan ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-[12.5px] text-fg2">
          {pesan}
        </Text>
      ) : null}
    </View>
  );
}
