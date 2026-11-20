import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Chip } from '@/components/Chip';
import { MarkPremium } from '@/components/MarkPremium';
import { Tombol } from '@/components/Tombol';
import { useStatusLangganan } from '@/data/langganan';
import { useLangganan } from '@/langganan/LanggananProvider';
import { URL_LANGGANAN_PLAY, type Paket } from '@/langganan/tipe';
import { useBeli } from '@/langganan/useBeli';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function tanggalPendek(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

const BARIS: { fitur: string; gratis: string; pro: string }[] = [
  { fitur: 'Catat pakai AI', gratis: '30x / bulan', pro: 'Tanpa batas' },
  { fitur: 'Catat manual', gratis: 'Tanpa batas', pro: 'Tanpa batas' },
  { fitur: 'Dompet, budget, dana darurat', gratis: 'Ya', pro: 'Ya' },
  { fitur: 'Laporan email bulanan', gratis: '-', pro: '3 penerima' },
  { fitur: 'Pengingat jatuh tempo', gratis: '-', pro: 'Ya' },
  { fitur: 'Ekspor CSV / XLSX', gratis: '-', pro: 'Ya' },
];

const namaPaket = (p: Paket) => (p.jenis === 'tahunan' ? 'Tahunan' : p.jenis === 'bulanan' ? 'Bulanan' : 'Paket');

export default function Premium() {
  const router = useRouter();
  const { dari } = useLocalSearchParams<{ dari?: string }>();
  const penyedia = useLangganan();
  const status = useStatusLangganan();
  const { beli, pulihkan, sibuk, pesan } = useBeli();
  const [daftar, setDaftar] = useState<Paket[] | null>(null);
  const [pilihId, setPilihId] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));

  useEffect(() => {
    let batal = false;
    penyedia
      .paket()
      .then((p) => {
        if (batal) return;
        setDaftar(p);
        setPilihId((lama) => lama ?? p.find((x) => x.jenis === 'bulanan')?.id ?? p[0]?.id ?? null);
      })
      .catch(() => {
        if (!batal) setDaftar([]);
      });
    return () => {
      batal = true;
    };
  }, [penyedia]);

  const pro = status.data?.pro === true;
  const paket = daftar?.find((p) => p.id === pilihId) ?? null;
  const labelUtama = paket
    ? paket.ujiCobaHari
      ? `Mulai uji coba ${paket.ujiCobaHari} hari`
      : `Langganan ${paket.harga}`
    : 'Langganan';

  async function kelola() {
    const url = (await penyedia.urlKelola().catch(() => null)) ?? URL_LANGGANAN_PLAY;
    Linking.openURL(url).catch(() => {});
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-5 px-5 py-6">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-widest text-mid font-sans">arta premium</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Tutup</Text>
        </Pressable>
      </View>

      <View className="items-center gap-2">
        <MarkPremium ukuran={64} />
        <Text className="text-lg font-bold text-fg font-sans">Coba Premium</Text>
        <Text className="text-5xl font-bold text-fg font-sans">14 hari</Text>
        <Text className="text-center text-mid font-sans">
          {dari === 'kuota'
            ? 'Kuota catat AI bulan ini habis. Buka tanpa batas dengan Pro.'
            : 'Semua fitur Pro terbuka selama 14 hari. Bandingkan dulu, baru putuskan.'}
        </Text>
      </View>

      {pro ? (
        <View className="gap-1 rounded-2xl border border-line bg-card p-4">
          <Text className="text-base font-bold text-fg font-sans">Pro aktif</Text>
          {status.data?.periode === 'trial' && tanggalPendek(status.data.berlakuSampai) ? (
            <Text className="text-mid font-sans">Uji coba sampai {tanggalPendek(status.data.berlakuSampai)}</Text>
          ) : tanggalPendek(status.data?.berlakuSampai ?? null) ? (
            <Text className="text-mid font-sans">Berlaku sampai {tanggalPendek(status.data?.berlakuSampai ?? null)}</Text>
          ) : null}
        </View>
      ) : null}

      <View className="overflow-hidden rounded-2xl border border-line bg-card">
        <View className="flex-row border-b border-line px-4 py-3">
          <Text className="flex-1 text-xs font-bold text-mid font-sans">Fitur</Text>
          <Text className="w-24 text-xs font-bold text-mid font-sans">Tanpa Pro</Text>
          <Text className="w-24 text-xs font-bold text-fg font-sans">Pro</Text>
        </View>
        {BARIS.map((b) => (
          <View key={b.fitur} className="flex-row items-center border-b border-line px-4 py-3">
            <Text className="flex-1 pr-2 text-sm text-fg font-sans">{b.fitur}</Text>
            <Text className="w-24 text-sm text-mid font-sans">{b.gratis}</Text>
            <Text className="w-24 text-sm font-semibold text-fg font-sans">{b.pro}</Text>
          </View>
        ))}
      </View>

      {pro ? (
        <Tombol label="Kelola langganan" onPress={kelola} />
      ) : daftar === null ? (
        <Text className="text-center text-mid font-sans">Memuat paket...</Text>
      ) : daftar.length === 0 ? (
        <View className="rounded-2xl border border-line bg-card2 px-4 py-5">
          <Text className="text-center text-fg2 font-sans">
            Langganan belum tersedia saat ini. Coba lagi nanti.
          </Text>
        </View>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            {daftar.map((p) => (
              <Chip
                key={p.id}
                label={`${namaPaket(p)} · ${p.harga}`}
                selected={p.id === pilihId}
                onPress={() => setPilihId(p.id)}
              />
            ))}
          </View>
          <Tombol
            primary
            label={labelUtama}
            busy={sibuk}
            disabled={sibuk || !paket}
            onPress={() => paket && beli(paket.id)}
          />
          <Text className="text-center text-xs text-mid font-sans">
            Saat uji coba berakhir, langganan Pro berlanjut sebagai langganan berbayar lewat Google Play. Harga dan
            ketentuan tampil sebelum kamu mengonfirmasi.
          </Text>
          <Text className="text-center text-sm text-mid font-sans">Batalkan kapan saja, tanpa biaya.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pulihkan pembelian"
            disabled={sibuk}
            onPress={pulihkan}
            className="items-center py-2"
          >
            <Text className="text-sm font-semibold text-fg font-sans">Pulihkan pembelian</Text>
          </Pressable>
        </>
      )}

      {pesan ? (
        <Text accessibilityRole="alert" className="text-center text-sm text-fg2 font-sans">
          {pesan}
        </Text>
      ) : null}
      {penyedia.nama === 'mock' ? (
        <Text className="text-center text-xs text-mid font-sans">Mode uji: pembayaran tidak sungguhan</Text>
      ) : null}
    </ScrollView>
  );
}
