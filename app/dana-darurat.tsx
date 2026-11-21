import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '@/components/Chip';
import Svg, { Path } from 'react-native-svg';
import { DaftarMutasi } from '@/components/darurat/DaftarMutasi';
import { HeroDarurat } from '@/components/darurat/HeroDarurat';
import { NAMA_DANA_DARURAT, SheetBuat } from '@/components/darurat/SheetBuat';
import { SheetTarget } from '@/components/darurat/SheetTarget';
import { Ikon } from '@/components/ikon/Ikon';
import { useMomen } from '@/animasi/useMomen';
import { useAuth } from '@/auth/AuthProvider';
import { walletBalances } from '@/domain/balances';
import { mutasiDarurat, rataPengeluaran, ringkasDarurat } from '@/domain/danaDarurat';
import { formatRupiah } from '@/domain/money';
import { hariIni } from '@/lib/tanggal';
import { pesanDompet } from '@/data/pesan';
import { useAllTransactions } from '@/data/transactions';
import { useCreateWallet, useUpdateWallet, useWallets } from '@/data/wallets';
import { useTheme } from '@/theme/ThemeProvider';

export default function DanaDarurat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const { profile } = useAuth();
  const momen = useMomen();
  const wallets = useWallets();
  const txs = useAllTransactions();
  const update = useUpdateWallet();
  const create = useCreateWallet();
  const [buatBuka, setBuatBuka] = useState(false);
  const [pilihId, setPilihId] = useState<string | null>(null);
  const [sheetBuka, setSheetBuka] = useState(false);
  const [busy, setBusy] = useState(false);
  const sibuk = useRef(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/akun'));
  const bulanIni = hariIni(profile?.zona_waktu).slice(0, 7);
  const r =
    wallets.data && txs.data
      ? ringkasDarurat(wallets.data, walletBalances(wallets.data, txs.data), txs.data, bulanIni)
      : null;
  const d = r ? (r.dompet.find((x) => x.id === pilihId) ?? r.dompet[0]) : undefined;
  const rata = txs.data ? rataPengeluaran(txs.data, bulanIni) : null;
  const bulanAman = d && rata ? Math.round((d.saldo / rata) * 10) / 10 : null;
  const mutasi =
    d && txs.data && wallets.data
      ? mutasiDarurat(txs.data, d.id, Object.fromEntries(wallets.data.map((w) => [w.id, w.nama])))
      : [];

  async function simpanTarget(id: string, target: number | null) {
    if (sibuk.current) return;
    sibuk.current = true;
    setBusy(true);
    setPesan(null);
    try {
      await update.mutateAsync({ id, patch: { target } });
      setSheetBuka(false);
      momen('Target diperbarui');
    } catch (e) {
      setPesan(pesanDompet(e));
    } finally {
      sibuk.current = false;
      setBusy(false);
    }
  }

  async function buatDarurat(v: { target: number; saldo: number }) {
    if (sibuk.current) return;
    sibuk.current = true;
    setBusy(true);
    setPesan(null);
    try {
      const w = await create.mutateAsync({
        nama: NAMA_DANA_DARURAT,
        tipe: 'darurat',
        saldo_awal: v.saldo,
        tanggal_saldo_awal: hariIni(profile?.zona_waktu),
        target: v.target,
      });
      setPilihId(w.id);
      setBuatBuka(false);
      momen('Dana darurat dibuat');
    } catch (e) {
      setPesan(pesanDompet(e, { namaUnik: true }));
    } finally {
      sibuk.current = false;
      setBusy(false);
    }
  }

  const aksi = (label: string, ikon: 'ui-arrow-down' | 'ui-arrow-up', href: string, utama: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href as never)}
      style={{ minHeight: 46 }}
      className={`flex-1 flex-row items-center justify-center gap-2 rounded-full border px-4 ${
        utama ? 'border-acc bg-acc' : 'border-line bg-card'
      }`}
    >
      <Ikon nama={ikon} ukuran={18} warna={utama ? t.accFg : t.fg} />
      <Text style={utama ? { color: t.accFg } : undefined} className={`font-sans text-[14px] font-bold ${utama ? '' : 'text-fg'}`}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-3.5 px-[18px] pb-8"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
    >
      <View className="flex-row items-center gap-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={tutup}
          hitSlop={4}
          style={{ width: 40, height: 40 }}
          className="items-center justify-center rounded-full border border-line bg-card"
        >
          <Ikon nama="ui-back" ukuran={20} warna={t.fg} />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-[10.5px] font-semibold tracking-[0.12em] text-mid">AKUN · RENCANA</Text>
          <Text accessibilityRole="header" className="font-sans text-[19px] font-semibold text-fg">
            Dana darurat
          </Text>
        </View>
      </View>

      {r === null ? (
        <Text className="text-mid font-sans">{wallets.error ? pesanDompet(wallets.error) : 'Memuat…'}</Text>
      ) : !d ? (
        <>
          <HeroDarurat saldo={0} target={null} persen={null} bulanAman={null} />
          {/* Keadaan kosong (mockup dana-darurat: .empty): perisai, judul, ajakan membuat. */}
          <View testID="kosong-darurat" className="items-center gap-2.5 rounded-[20px] border border-line bg-card px-5 py-6">
            <Svg width={140} height={88} viewBox="0 0 320 200" accessibilityLabel="Dana darurat belum dibuat">
              <Path
                d="M160 48 L216 68 V112 C216 142 191 163 160 174 C129 163 104 142 104 112 V68 Z"
                fill="none"
                stroke={t.fg2}
                strokeWidth={5}
                strokeLinejoin="round"
                opacity={0.28}
              />
              <Path d="M160 92 V138 M137 115.5 H183" fill="none" stroke={t.accInk} strokeWidth={6} strokeLinecap="round" />
              <Path d="M118 186 H202" fill="none" stroke={t.fg2} strokeWidth={5} strokeLinecap="round" opacity={0.3} />
            </Svg>
            <Text className="font-sans text-[16.5px] font-semibold text-fg">Belum ada dana darurat</Text>
            <Text className="max-w-[260px] text-center font-sans text-[13px] leading-[19px] text-fg2">
              Tentukan target dan mulai sisihkan sedikit tiap bulan supaya aman kalau ada kejadian mendadak.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Buat dana darurat"
              onPress={() => {
                setPesan(null);
                setBuatBuka(true);
              }}
              style={{ minHeight: 42 }}
              className="mt-1 justify-center rounded-full border border-accink px-5"
            >
              <Text className="font-sans text-[14px] font-bold text-accink">Buat dana darurat</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {r.dompet.length > 1 ? (
            <View className="flex-row flex-wrap gap-2">
              {r.dompet.map((x) => (
                <Chip key={x.id} label={x.nama} selected={x.id === d.id} onPress={() => setPilihId(x.id)} />
              ))}
            </View>
          ) : null}

          <HeroDarurat saldo={d.saldo} target={d.target} persen={d.persen} bulanAman={bulanAman} />

          <View className="flex-row gap-2.5">
            {aksi('Setor', 'ui-arrow-down', `/pindah-dana?ke=${d.id}&mode=setor`, true)}
            {aksi('Tarik', 'ui-arrow-up', `/pindah-dana?dari=${d.id}&mode=tarik`, false)}
          </View>

          <View className="gap-3 rounded-[20px] border border-line bg-card p-3.5">
            <View className="flex-row items-center gap-3">
              <View style={{ width: 38, height: 38 }} className="items-center justify-center rounded-[13px] bg-accsoft">
                <Ikon nama="ui-shield" ukuran={19} warna={t.accInk} />
              </View>
              <View className="min-w-0 flex-1">
                <Text accessibilityRole="header" className="font-sans text-[14.5px] font-semibold text-fg">
                  Target yang disarankan
                </Text>
                <Text className="font-sans text-[11.5px] text-mid" numberOfLines={1}>
                  {rata ? `Dari pengeluaran ${formatRupiah(Math.round(rata))}/bln` : 'Belum ada data pengeluaran'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ubah target"
                hitSlop={8}
                onPress={() => {
                  setPesan(null);
                  setSheetBuka(true);
                }}
              >
                <Text className="font-sans text-[13px] font-bold text-accink">Ubah</Text>
              </Pressable>
            </View>
            {rata ? (
              <>
                <View className="flex-row items-baseline gap-2">
                  <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[22px] font-extrabold text-fg">
                    {formatRupiah(Math.round(rata * 3))}
                  </Text>
                  <Text className="font-sans text-xs text-mid">{`s.d. ${formatRupiah(Math.round(rata * 6))}`}</Text>
                </View>
                <View className="flex-row justify-between gap-3">
                  <Text className="font-sans text-[12.5px] text-mid">Pengeluaran rata-rata 3 bulan</Text>
                  <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[12.5px] font-bold text-fg">
                    {formatRupiah(Math.round(rata))}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  {[3, 6].map((k) => {
                    const n = Math.round(rata * k);
                    return (
                      <Chip
                        key={k}
                        label={`Pakai ${k}×`}
                        selected={d.target === n}
                        onPress={() => void simpanTarget(d.id, n)}
                      />
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>

          <Text accessibilityRole="header" className="mt-1 font-sans text-[15px] font-semibold text-fg">
            Mutasi
          </Text>
          {mutasi.length > 0 ? (
            <DaftarMutasi mutasi={mutasi} onBuka={(id) => router.push(`/transaksi/${id}` as never)} />
          ) : (
            <Text className="rounded-[20px] border border-line bg-card p-4 font-sans text-[13px] text-mid">
              Belum ada setoran atau penarikan. Ketuk Setor untuk mulai menyisihkan.
            </Text>
          )}
          {!sheetBuka && pesan ? <Text className="text-fg font-sans">{pesan}</Text> : null}
        </>
      )}

      {buatBuka ? (
        <SheetBuat
          terbuka
          onTutup={() => setBuatBuka(false)}
          targetAwal={rata ? Math.round(rata * 3) : 0}
          busy={busy}
          pesan={pesan}
          onBuat={(v) => void buatDarurat(v)}
        />
      ) : null}
      {sheetBuka && d ? (
        <SheetTarget
          terbuka
          onTutup={() => setSheetBuka(false)}
          saldo={d.saldo}
          target={d.target}
          rata={rata}
          busy={busy}
          pesan={pesan}
          onSimpan={(target) => void simpanTarget(d.id, target)}
        />
      ) : null}
    </ScrollView>
  );
}
