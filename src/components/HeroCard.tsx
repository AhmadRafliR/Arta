import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { formatRupiah } from '@/domain/money';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { sisa: number; kekayaan: number };

type Aksi = { label: string; a11y: string; ikon: NamaIkon; buka: () => void };

/**
 * Kartu saldo gaya e-wallet: label di atas, lalu dua kolom —
 * saldo + kekayaan bersih di kiri (mengecil bila panjang), tombol aksi berikon di kanan.
 */
export function HeroCard({ sisa, kekayaan }: Props) {
  const { t } = useTheme();
  const router = useRouter();

  const daftarAksi: Aksi[] = [
    { label: 'Catat', a11y: 'Catat transaksi', ikon: 'act-ketik', buka: () => router.push('/catat') },
    { label: 'Hutang', a11y: 'Buka hutang', ikon: 'nav-hutang', buka: () => router.navigate('/hutang') },
    { label: 'Riwayat', a11y: 'Buka riwayat', ikon: 'nav-riwayat', buka: () => router.navigate('/riwayat') },
  ];

  return (
    <LinearGradient
      colors={[t.kartuFrom, t.kartuTo]}
      locations={[0.35, 1]}
      start={{ x: 0, y: 0.3 }}
      end={{ x: 1, y: 0.7 }}
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: t.kartuLine,
        paddingTop: 14,
        paddingBottom: 14,
        paddingHorizontal: 16,
      }}
    >
      <Text
        style={{ color: t.kartuSub }}
        className="text-[11px] tracking-[0.12em] font-semibold font-sans"
        numberOfLines={1}
      >
        SISA UANG · SEMUA DOMPET
      </Text>

      <View className="mt-1.5 flex-row items-center gap-3">
        {/* minWidth 0 agar kolom saldo boleh menyempit dan tombol tidak terdorong keluar. */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ color: t.kartuFg, fontVariant: ['tabular-nums'] }}
            className="text-[28px] font-extrabold font-sans"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {formatRupiah(sisa)}
          </Text>
          <Text style={{ color: t.kartuSub }} className="mt-0.5 text-[12px] font-sans" numberOfLines={2}>
            {`Kekayaan bersih ${formatRupiah(kekayaan)}`}
          </Text>
        </View>

        <View className="flex-row" style={{ gap: 2 }}>
          {daftarAksi.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              accessibilityLabel={a.a11y}
              onPress={a.buka}
              hitSlop={4}
              style={({ pressed }) => ({
                minWidth: 48,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 2,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: t.aksiBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ikon nama={a.ikon} ukuran={20} warna={t.aksiFg} />
              </View>
              <Text style={{ color: t.kartuFg }} className="mt-1 text-[12px] font-semibold font-sans" numberOfLines={1}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
}
