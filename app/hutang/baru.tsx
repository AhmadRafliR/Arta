import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMomen } from '@/animasi/useMomen';
import { FormHutang } from '@/components/FormHutang';
import { KepalaHutang, Petunjuk } from '@/components/hutang/BagianHutang';
import { Ikon } from '@/components/ikon/Ikon';
import { toAppError, type AppError } from '@/data/errors';
import {
  BATAS_BYTE_GAMBAR,
  PESAN_GAMBAR_BESAR,
  byteDariBase64,
  tentukanMime,
  useBacaScreenshotHutang,
  type DrafHutang,
} from '@/data/hutangGambar';
import { newTxId } from '@/data/transactions';
import { useTheme } from '@/theme/ThemeProvider';

// Modal tambah hutang. Id transaksi dan id hutang dibuat sekali, dipakai ulang di setiap percobaan simpan.
export default function HutangBaru() {
  const router = useRouter();
  const { t } = useTheme();
  const [txId] = useState(() => newTxId());
  const [debtId] = useState(() => newTxId());
  const [draf, setDraf] = useState<DrafHutang | undefined>(undefined);
  const [versiForm, setVersiForm] = useState(0);
  const [pesan, setPesan] = useState<string | null>(null);
  const [kuotaHabis, setKuotaHabis] = useState(false);
  const baca = useBacaScreenshotHutang();
  const sibuk = useRef(false);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const momen = useMomen();

  async function pilihScreenshot() {
    if (sibuk.current) return;
    sibuk.current = true;
    try {
      setPesan(null);
      setKuotaHabis(false);
      let hasil;
      try {
        hasil = await launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7, allowsEditing: false });
      } catch (e) {
        setPesan(toAppError(e).pesan);
        return;
      }
      if (hasil.canceled || !hasil.assets?.[0]) return;
      const aset = hasil.assets[0];
      if (!aset.base64) {
        setPesan('Gambar tidak bisa dibaca. Coba pilih gambar lain.');
        return;
      }
      if ((aset.fileSize ?? 0) > BATAS_BYTE_GAMBAR || byteDariBase64(aset.base64) > BATAS_BYTE_GAMBAR) {
        setPesan(PESAN_GAMBAR_BESAR);
        return;
      }
      try {
        const h = await baca.mutateAsync({ base64: aset.base64, mime: tentukanMime(aset.mimeType, aset.uri) });
        if (h.draf) {
          setDraf(h.draf);
          setVersiForm((v) => v + 1);
        } else {
          setPesan(h.pesan || 'Screenshot tidak terbaca sebagai tagihan. Coba screenshot lain atau isi manual.');
        }
      } catch (e) {
        const g = (e && typeof e === 'object' ? e : {}) as Partial<AppError>;
        if (g.kind === 'kuota') setKuotaHabis(true);
        setPesan(g.pesan || toAppError(e).pesan);
      }
    } finally {
      sibuk.current = false;
    }
  }

  const membaca = baca.isPending;
  return (
    <View className="flex-1 bg-bg">
      <View className="px-[18px] pb-3 pt-5">
        <KepalaHutang ikon="nav-hutang" judul="Tambah hutang" sub="Paylater, cicilan, atau pinjaman" onTutup={tutup} />
      </View>
      <View className="gap-2 px-[18px] pb-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Isi dari screenshot"
          accessibilityHint="Pilih screenshot tagihan dari galeri"
          accessibilityState={{ disabled: membaca, busy: membaca }}
          disabled={membaca}
          onPress={() => void pilihScreenshot()}
          className={`flex-row items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-3 ${membaca ? 'opacity-60' : ''}`}
        >
          {membaca ? <ActivityIndicator color={t.acc} /> : <Ikon nama="ui-spark" ukuran={22} warna={t.acc} />}
          <View className="flex-1">
            <Text className="font-sans text-[14.5px] font-bold text-fg">{membaca ? 'Membaca screenshot…' : 'Isi dari screenshot'}</Text>
            <Text className="font-sans text-xs text-mid">Gemini membaca tagihan, kamu cek dulu sebelum simpan</Text>
          </View>
        </Pressable>
        <View accessibilityLiveRegion="polite" className="gap-2">
          {pesan ? <Petunjuk>{pesan}</Petunjuk> : null}
          {kuotaHabis ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Lihat Pro"
              onPress={() => router.push('/premium?dari=kuota')}
            >
              <Text className="font-sans text-[13px] font-bold text-accink">Lihat Pro untuk kuota lebih besar</Text>
            </Pressable>
          ) : null}
          {draf && !pesan ? (
            <Petunjuk ok>Terisi dari screenshot. Cek lagi angkanya sebelum menyimpan.</Petunjuk>
          ) : null}
        </View>
      </View>
      <FormHutang
        key={versiForm}
        awal={draf}
        txId={txId}
        debtId={debtId}
        onSaved={(id) => {
          momen('Hutang tersimpan');
          router.replace({ pathname: '/hutang/[id]', params: { id } });
        }}
        onBatal={tutup}
      />
    </View>
  );
}
