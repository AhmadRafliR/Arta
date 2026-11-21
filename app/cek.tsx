import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMomen } from '@/animasi/useMomen';
import { BarisDraf } from '@/components/BarisDraf';
import { EditorDraf, type PatchDraf } from '@/components/EditorDraf';
import { Ikon } from '@/components/ikon/Ikon';
import { ikonDompet } from '@/components/ikon/peta';
import { Tombol } from '@/components/Tombol';
import { beritahuSimpan, hapusDraf, hapusKoreksi, kosongkan, ubahDraf, useDraf } from '@/ai/drafStore';
import type { DrafKoreksi } from '@/ai/tipe';
import { useAuth } from '@/auth/AuthProvider';
import { toAppError, type AppError } from '@/data/errors';
import { useAllTransactions, useSaveTransactions, type NewTx } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { adjustmentFor } from '@/domain/adjust';
import { walletBalances } from '@/domain/balances';
import { formatRupiah } from '@/domain/money';
import { hariIni } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

const ALASAN_DOMPET = 'Pilih dompet untuk semua transaksi dulu.';

function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}

type InfoKoreksi = DrafKoreksi & {
  nama: string;
  tipe: 'harian' | 'darurat' | 'investasi';
  /** null = saldo belum termuat atau dompet tidak ditemukan. */
  sebelum: number | null;
  /** null = sudah sama (atau belum bisa dihitung). */
  selisih: number | null;
};

// Modal "Cek dulu": draf hasil AI bisa diubah/dihapus, lalu disimpan sekaligus. Tidak ada yang tersimpan
// sebelum Simpan. Id draf/koreksi dari server dipakai ulang di setiap percobaan (RPC on conflict do nothing).
export default function Cek() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const { profile } = useAuth();
  const h = useDraf();
  const wallets = useWallets();
  const semua = useAllTransactions();
  const save = useSaveTransactions();
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const sibuk = useRef(false); // penjaga sinkron untuk tekan dua kali
  const ditutup = useRef(false); // layar menutup sendiri; jangan replace('/') saat store dikosongkan

  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const momen = useMomen();

  useEffect(() => {
    if (!h && !ditutup.current) router.replace('/');
  }, [h, router]);

  // Patokan koreksi = saldo tersimpan + efek draf di hasil yang sama: "rokok 25rb gopay, saldo gopay
  // sekarang 150rb" berarti saldo akhir 150rb (setelah rokok), bukan 125rb.
  const drafDiHasil = h?.draf;
  const saldo = useMemo(() => {
    if (!wallets.data || !semua.data) return null;
    const efekDraf = (drafDiHasil ?? []).map((d) => ({
      jenis: d.jenis,
      nominal: d.nominal,
      wallet_id: d.wallet_id,
      wallet_tujuan_id: d.jenis === 'transfer' ? d.wallet_tujuan_id : null,
    }));
    return walletBalances(wallets.data, [...semua.data, ...efekDraf]);
  }, [wallets.data, semua.data, drafDiHasil]);

  if (!h) return null;

  const hari = hariIni(profile?.zona_waktu || undefined);
  const daftarDompet = wallets.data ?? [];
  const aktif = daftarDompet.filter((w) => !w.diarsip);
  const namaDompet = (id: string | null) => daftarDompet.find((w) => w.id === id)?.nama ?? null;

  const koreksi: InfoKoreksi[] = h.koreksi.map((k) => {
    const w = daftarDompet.find((x) => x.id === k.wallet_id);
    const sebelum = saldo && w && k.wallet_id in saldo ? saldo[k.wallet_id] : null;
    return {
      ...k,
      nama: w?.nama ?? 'dompet',
      tipe: w?.tipe ?? 'harian',
      sebelum,
      selisih: sebelum === null ? null : adjustmentFor(sebelum, k.saldo_baru),
    };
  });
  const koreksiBernilai = koreksi.filter((k) => k.selisih !== null);
  const n = h.draf.length + koreksiBernilai.length;
  // Dompet harus milik pengguna dan tidak diarsip; transfer wajib tujuan lain.
  const dompetOk = (id: string | null) => !!id && aktif.some((w) => w.id === id);
  const kurangDompet =
    !!wallets.data &&
    h.draf.some(
      (d) =>
        !dompetOk(d.wallet_id) ||
        (d.jenis === 'transfer' && (!dompetOk(d.wallet_tujuan_id) || d.wallet_tujuan_id === d.wallet_id)),
    );
  const memuatSaldo = (h.koreksi.length > 0 && saldo === null) || !wallets.data;
  const nonaktif = busy || n === 0 || kurangDompet || memuatSaldo;
  const alasan = kurangDompet ? ALASAN_DOMPET : memuatSaldo ? 'Memuat saldo dompet…' : null;
  const sedangDiubah = editId ? h.draf.find((d) => d.id === editId) : undefined;

  async function simpan() {
    if (!h || sibuk.current || nonaktif) return;
    sibuk.current = true;
    setBusy(true);
    setGalat(null);
    const items: NewTx[] = [
      ...h.draf.map(
        (d): NewTx => ({
          id: d.id,
          tanggal: d.tanggal,
          jenis: d.jenis,
          kategori: d.jenis === 'transfer' ? 'transfer' : d.kategori,
          nominal: d.nominal,
          wallet_id: d.wallet_id,
          wallet_tujuan_id: d.jenis === 'transfer' ? d.wallet_tujuan_id : null,
          catatan: d.catatan,
          transkrip: h.transkrip,
          sumber: 'ai',
        }),
      ),
      ...koreksiBernilai.map(
        (k): NewTx => ({
          id: k.id,
          tanggal: hari,
          jenis: 'penyesuaian',
          kategori: 'penyesuaian',
          nominal: k.selisih as number,
          wallet_id: k.wallet_id,
          wallet_tujuan_id: null,
          catatan: 'Koreksi saldo lewat suara',
          transkrip: h.transkrip,
          sumber: 'ai',
        }),
      ),
    ];
    try {
      await save.mutateAsync(items);
      ditutup.current = true;
      beritahuSimpan();
      kosongkan();
      momen('Transaksi tersimpan');
      tutup();
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      sibuk.current = false;
      setBusy(false);
    }
  }

  function batal() {
    Alert.alert('Buang hasil catat ini?', undefined, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Buang',
        style: 'destructive',
        onPress: () => {
          ditutup.current = true;
          kosongkan();
          tutup();
        },
      },
    ]);
  }

  function terapkan(patch: PatchDraf) {
    if (editId) ubahDraf(editId, patch);
    setEditId(null);
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pb-1 pt-4">
        <Text className="text-lg font-bold text-fg font-sans">Cek dulu</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Batal" onPress={batal} className="px-2 py-1">
          <Text className="text-mid font-sans">Batal</Text>
        </Pressable>
      </View>
      {h.transkrip ? (
        <Text className="px-5 text-[13px] italic text-mid font-sans" numberOfLines={2}>
          {`“${h.transkrip}”`}
        </Text>
      ) : null}

      <ScrollView className="flex-1" contentContainerClassName="px-5 py-3">
        {h.draf.map((d) => (
          <BarisDraf
            key={d.id}
            draf={d}
            namaDompet={namaDompet}
            hariIni={hari}
            onPress={() => setEditId(d.id)}
            onHapus={() => hapusDraf(d.id)}
          />
        ))}

        {koreksi.map((k) => (
          <View key={k.id} className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center gap-3 py-2.5">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-card2">
                <Ikon nama={ikonDompet(k.tipe)} ukuran={22} warna={t.fg2} />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-fg font-sans" numberOfLines={1}>
                  {`Saldo ${k.nama}`}
                </Text>
                <Text className="text-[12.5px] text-fg2 font-sans" numberOfLines={1}>
                  {k.sebelum === null
                    ? saldo === null
                      ? 'Memuat saldo…'
                      : 'Dompet tidak ditemukan'
                    : `${formatRupiah(k.sebelum)} → ${formatRupiah(k.saldo_baru)}`}
                </Text>
              </View>
              {k.sebelum === null ? null : k.selisih === null ? (
                <Text className="text-[13px] text-mid font-sans">Sudah sama</Text>
              ) : (
                <Text className={`font-sans text-[15px] font-semibold ${k.selisih > 0 ? 'text-accink' : 'text-fg'}`}>
                  {`${k.selisih > 0 ? '+' : ''}${formatRupiah(k.selisih)}`}
                </Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Hapus koreksi saldo ${k.nama}`}
              testID={`hapus-${k.id}`}
              onPress={() => hapusKoreksi(k.id)}
              hitSlop={8}
              className="p-2"
            >
              <Ikon nama="act-hapus" ukuran={20} warna={t.mid} />
            </Pressable>
          </View>
        ))}

        {h.tidakDidukung.length > 0 ? (
          <View className="mt-3 gap-1.5 rounded-xl bg-card2 px-3 py-2.5">
            {h.tidakDidukung.map((s, i) => (
              <View key={`${i}-${s}`} className="flex-row items-start gap-2">
                <Ikon nama="status-budget-waspada" ukuran={16} warna={t.mid} />
                <Text className="flex-1 text-[13px] text-mid font-sans">{s}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View className="gap-2 px-5 pt-2" style={{ paddingBottom: insets.bottom + 16 }}>
        {galat ? <Text className="text-fg font-sans">{galat}</Text> : null}
        <Tombol primary label={`Simpan ${n} transaksi`} onPress={simpan} disabled={nonaktif} busy={busy} />
        {alasan ? <Text className="text-center text-xs text-mid font-sans">{alasan}</Text> : null}
      </View>

      {sedangDiubah ? (
        <EditorDraf key={sedangDiubah.id} draf={sedangDiubah} dompet={aktif} onSimpan={terapkan} onTutup={() => setEditId(null)} />
      ) : null}
    </View>
  );
}
