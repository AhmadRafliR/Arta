import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeTier } from '@/components/BadgeTier';
import { BarisMenuAkun, JudulSeksiAkun, KartuGrupAkun } from '@/components/BarisAkun';
import { KartuProfilAkun } from '@/components/KartuProfilAkun';
import { SheetBudget } from '@/components/SheetBudget';
import { MenuRencana, type RingkasanRencana } from '@/components/MenuRencana';
import { PengaturanPengingat } from '@/components/PengaturanPengingat';
import { Segmented } from '@/components/Segmented';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { useAuth } from '@/auth/AuthProvider';
import { kekayaanBersih, walletBalances } from '@/domain/balances';
import { pemakaianBudget } from '@/domain/budget';
import { ringkasDarurat } from '@/domain/danaDarurat';
import { ringkasHutang } from '@/domain/hutang';
import { formatRingkas, formatRupiah } from '@/domain/money';
import type { TipeDompet, Wallet } from '@/domain/types';
import { sisaKuota, useKuotaAi } from '@/data/ai';
import { useBudgets } from '@/data/budgets';
import { useDebts } from '@/data/debts';
import { useAllTransactions, useTransactions } from '@/data/transactions';
import { useWallets } from '@/data/wallets';
import { useStatusLangganan } from '@/data/langganan';
import { teksStatusLangganan } from '@/langganan/teks';
import { URL_KEBIJAKAN_PRIVASI } from '@/config';
import { geserBulan, hariIni, NAMA_BULAN } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';
import type { Pref } from '@/theme/tokens';
import { useGulirPulau } from '@/nav/useGulirPulau';
import { spacerNav } from '@/nav/pulau';

const TIPE: { v: TipeDompet; label: string; grup: string; ikon: NamaIkon }[] = [
  { v: 'harian', label: 'Harian', grup: 'Dompet harian', ikon: 'wallet-harian' },
  { v: 'darurat', label: 'Dana darurat', grup: 'Dana darurat', ikon: 'ui-shield' },
  { v: 'investasi', label: 'Investasi', grup: 'Investasi', ikon: 'wallet-investasi' },
];
const IKON_TIPE: Record<TipeDompet, NamaIkon> = { harian: 'wallet-harian', darurat: 'ui-shield', investasi: 'wallet-investasi' };
const TEMA: { nilai: Pref; label: string }[] = [
  { nilai: 'sistem', label: 'Sistem' },
  { nilai: 'terang', label: 'Terang' },
  { nilai: 'gelap', label: 'Gelap' },
];

const rp = (n: number) => `Rp${formatRingkas(n)}`;
const jumlah = (wallets: Wallet[], saldo: Record<string, number>) => wallets.reduce((s, w) => s + (saldo[w.id] ?? 0), 0);

/** "Jan 2026" dari timestamp ISO; null bila tidak valid. */
function bulanGabung(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

// Baris dompet (mockup: .wrow): petak ikon tipe, nama + keterangan, saldo, chevron.
function Baris({ w, saldo, onPress }: { w: Wallet; saldo: number | undefined; onPress: () => void }) {
  const { t } = useTheme();
  let sub = TIPE.find((x) => x.v === w.tipe)?.label ?? '';
  if (w.diarsip) sub = 'Diarsipkan';
  else if (w.tipe === 'darurat' && w.target && saldo !== undefined)
    sub = `${Math.floor((saldo * 100) / w.target)}% dari target ${rp(w.target)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Dompet ${w.nama}`}
      onPress={onPress}
      className="flex-row items-center gap-[11px] border-t border-line px-3.5 py-[11px]"
    >
      <View style={{ width: 34, height: 34 }} className="items-center justify-center rounded-[11px] bg-card2">
        <Ikon nama={IKON_TIPE[w.tipe]} ukuran={18} warna={t.fg2} />
      </View>
      <View className="min-w-0 flex-1 gap-px">
        <Text className="font-sans text-[14.5px] font-semibold text-fg" numberOfLines={1}>
          {w.nama}
        </Text>
        <Text className="font-sans text-[11.5px] text-mid" numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[14.5px] font-semibold text-fg">
        {saldo === undefined ? '…' : formatRupiah(saldo)}
      </Text>
      <Ikon nama="ui-chev" ukuran={16} warna={t.mid} />
    </Pressable>
  );
}

// Kepala grup dompet (mockup: .wgroup-head).
function KepalaGrup({ ikon, label, jumlahDompet, total }: { ikon: NamaIkon; label: string; jumlahDompet: number; total: string }) {
  const { t } = useTheme();
  return (
    <View className="flex-row items-center gap-[9px] px-3.5 pb-2.5 pt-3">
      <View style={{ width: 30, height: 30 }} className="items-center justify-center rounded-[10px] bg-accsoft">
        <Ikon nama={ikon} ukuran={17} warna={t.accInk} />
      </View>
      <View className="flex-1">
        <Text className="font-sans text-[11.5px] font-bold uppercase tracking-[0.7px] text-fg2">{label}</Text>
        <Text className="font-sans text-[11px] text-mid">{`${jumlahDompet} dompet`}</Text>
      </View>
      <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[14.5px] font-semibold text-fg">
        {total}
      </Text>
    </View>
  );
}

export default function Akun() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gulir = useGulirPulau('akun');
  const gulirRef = useRef<ScrollViewInstance>(null);
  const [temaY, setTemaY] = useState(0);
  const { signOut, profile, session } = useAuth();
  const { pref, setPref, mode, t } = useTheme();
  const walletsQ = useWallets();
  const wallets = walletsQ.data ?? [];
  const txs = useAllTransactions();
  const [arsipBuka, setArsipBuka] = useState(false);
  const [budgetBuka, setBudgetBuka] = useState(false);
  const langganan = useStatusLangganan();
  const pro = langganan.data?.pro === true;
  const kuota = useKuotaAi().data;
  const hariIniStr = hariIni(profile?.zona_waktu || undefined);
  const bulan = hariIniStr.slice(0, 7);
  // Hutang dan budget tidak boleh memblokir Akun: selama memuat atau galat, dianggap kosong.
  const hutang = useDebts({ arsip: false });
  const budgets = useBudgets();
  const txBulan = useTransactions(bulan);
  // Dompet arsip tetap dihitung dalam saldo (aturan domain).
  const saldo = txs.data ? walletBalances(wallets, txs.data) : null;
  const buka = (id: string) => router.push(`/dompet/${id}`);
  const aktif = wallets.filter((w) => !w.diarsip);
  const arsip = wallets.filter((w) => w.diarsip);
  const kosong = walletsQ.data !== undefined && aktif.length === 0;

  const totalHutang = ringkasHutang(hutang.data ?? [], hariIniStr).totalSisa;
  const email = session?.user?.email ?? null;
  const nama = profile?.nama?.trim() || (email ? email.split('@')[0] : 'Pengguna');
  const gabung = bulanGabung(session?.user?.created_at);
  const keterangan = [gabung ? `Bergabung ${gabung}` : null, `${aktif.length} dompet`].filter(Boolean).join(' · ');

  // Ringkasan baris rencana (budget, dana darurat, investasi).
  const ringkasan: RingkasanRencana = {};
  if (budgets.data && txBulan.data && budgets.data.length > 0) {
    const daftar = pemakaianBudget(budgets.data, txBulan.data, bulan);
    const batas = daftar.reduce((s, p) => s + p.batas, 0);
    const terpakai = daftar.reduce((s, p) => s + p.terpakai, 0);
    const terburuk = daftar.reduce<(typeof daftar)[number] | null>((a, p) => (!a || p.persen > a.persen ? p : a), null);
    if (terburuk) {
      const nama0 = terburuk.kategori.charAt(0).toUpperCase() + terburuk.kategori.slice(1);
      ringkasan.budget = {
        persen: batas > 0 ? Math.round((terpakai * 100) / batas) : 0,
        nada: terburuk.status,
        sub:
          terburuk.status === 'lewat'
            ? `${nama0} lewat ${terburuk.persen - 100}%`
            : terburuk.status === 'waspada'
              ? `${nama0} hampir habis`
              : `Kategori terbesar: ${nama0}`,
      };
    }
  }
  if (saldo && txs.data) {
    const d = ringkasDarurat(wallets, saldo, txs.data, bulan);
    if (d.dompet.length > 0) ringkasan.darurat = { total: d.total, target: d.totalTarget, persen: d.persen };
    const inv = aktif.filter((w) => w.tipe === 'investasi');
    if (inv.length > 0) ringkasan.investasi = { jumlah: inv.length, total: jumlah(inv, saldo) };
  }

  const persenKuota = kuota && kuota.batas > 0 ? Math.min(100, Math.round((kuota.terpakai * 100) / kuota.batas)) : 0;
  const reset = kuota ? geserBulan(kuota.bulan, 1).split('-').map(Number) : null;
  const catatanTema =
    pref === 'sistem'
      ? `Mengikuti pengaturan HP (${mode === 'gelap' ? 'gelap' : 'terang'}).`
      : `Selalu ${pref === 'gelap' ? 'gelap' : 'terang'}, apa pun pengaturan HP.`;
  const versi = Constants.expoConfig?.version;

  return (
    <ScrollView
      ref={gulirRef}
      className="flex-1 bg-bg"
      contentContainerClassName="gap-3 px-[18px]"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: spacerNav(insets.bottom) }}
      {...gulir}
    >
      {/* Bar atas (mockup: .topbar): judul, pil tier, tombol ke pengaturan tampilan. */}
      <View className="flex-row items-center gap-2.5 pb-1">
        <Text accessibilityRole="header" className="font-sans text-[22px] font-semibold text-fg">
          Akun
        </Text>
        <View className="rounded-full border border-line bg-card px-[9px] py-[3px]">
          <Text className="font-sans text-[11.5px] font-bold text-fg2">{pro ? 'Pro' : 'Free'}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ke pengaturan tampilan"
          onPress={() => gulirRef.current?.scrollTo({ y: Math.max(0, temaY - 80), animated: true })}
          style={{ width: 38, height: 38 }}
          className="ml-auto items-center justify-center rounded-full border border-line bg-card"
        >
          <Ikon nama="ui-gear" ukuran={19} warna={t.fg2} />
        </Pressable>
      </View>

      <KartuProfilAkun
        nama={nama}
        email={email}
        pro={pro}
        kekayaan={saldo ? kekayaanBersih(saldo, totalHutang) : null}
        keterangan={keterangan}
        rincian={
          saldo
            ? {
                harian: jumlah(aktif.filter((w) => w.tipe === 'harian'), saldo),
                darurat: jumlah(aktif.filter((w) => w.tipe === 'darurat'), saldo),
                investasi: jumlah(aktif.filter((w) => w.tipe === 'investasi'), saldo),
                hutang: totalHutang,
              }
            : null
        }
      />

      <JudulSeksiAkun>Dompet</JudulSeksiAkun>

      {TIPE.map(({ v, grup, ikon }) => {
        const daftar = aktif.filter((w) => w.tipe === v);
        if (daftar.length === 0) return null;
        return (
          <KartuGrupAkun key={v}>
            <KepalaGrup
              ikon={ikon}
              label={grup}
              jumlahDompet={daftar.length}
              total={saldo ? formatRupiah(jumlah(daftar, saldo)) : '…'}
            />
            {daftar.map((w) => (
              <Baris key={w.id} w={w} saldo={saldo?.[w.id]} onPress={() => buka(w.id)} />
            ))}
          </KartuGrupAkun>
        );
      })}

      {kosong ? (
        // Keadaan kosong (mockup: .empty) dengan tombol tambah.
        <View className="items-center gap-2.5 rounded-[20px] border border-line bg-card px-[18px] pb-5 pt-6">
          <View style={{ width: 64, height: 64 }} className="items-center justify-center rounded-full bg-accsoft">
            <Ikon nama="wallet-harian" ukuran={30} warna={t.accInk} />
          </View>
          <Text className="font-sans text-base font-semibold text-fg">Belum ada dompet</Text>
          <Text className="text-center font-sans text-[13px] leading-5 text-fg2">
            Tambahkan dompet pertama supaya saldo dan transaksi bisa dicatat.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tambah dompet"
            onPress={() => router.push('/dompet/baru')}
            style={{ minHeight: 40 }}
            className="mt-1 items-center justify-center rounded-full border border-accink px-4"
          >
            <Text className="font-sans text-[13px] font-bold text-accink">Tambah dompet</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tambah dompet"
          onPress={() => router.push('/dompet/baru')}
          style={{ minHeight: 48, borderStyle: 'dashed' }}
          className="flex-row items-center justify-center gap-2 rounded-[20px] border border-line px-4 py-3"
        >
          <Ikon nama="ui-plus" ukuran={18} warna={t.fg2} />
          <Text numberOfLines={1} className="font-sans text-sm font-semibold text-fg2">
            Tambah dompet
          </Text>
        </Pressable>
      )}

      {arsip.length > 0 ? (
        <KartuGrupAkun>
          <BarisMenuAkun
            pertama
            ikon="ui-archive"
            judul={`Diarsipkan (${arsip.length})`}
            sub={arsipBuka ? 'Ketuk untuk menyembunyikan' : 'Ketuk untuk melihat'}
            accessibilityLabel="Diarsipkan"
            accessibilityState={{ expanded: arsipBuka }}
            onPress={() => setArsipBuka((b) => !b)}
            chevron={false}
            kanan={
              <View style={{ transform: [{ rotate: arsipBuka ? '-90deg' : '90deg' }] }}>
                <Ikon nama="ui-chev" ukuran={16} warna={t.mid} />
              </View>
            }
          />
          {arsipBuka
            ? arsip.map((w) => <Baris key={w.id} w={w} saldo={saldo?.[w.id]} onPress={() => buka(w.id)} />)
            : null}
        </KartuGrupAkun>
      ) : null}

      <MenuRencana ringkasan={ringkasan} onBukaBudget={() => setBudgetBuka(true)} />
      {budgetBuka ? <SheetBudget terbuka onTutup={() => setBudgetBuka(false)} /> : null}

      <View className="gap-3" onLayout={(e) => setTemaY(e.nativeEvent.layout.y)}>
        <JudulSeksiAkun>Tampilan</JudulSeksiAkun>
        <View accessibilityLabel="Mode tampilan" className="rounded-[20px] border border-line bg-card px-3.5 pb-3.5 pt-[13px]">
          <Segmented pilihan={TEMA} nilai={pref} onChange={setPref} />
          <Text className="mt-2 font-sans text-[11.5px] leading-4 text-mid">{catatanTema}</Text>
        </View>
      </View>

      <JudulSeksiAkun>Langganan</JudulSeksiAkun>
      <View className="rounded-[20px] border border-line bg-card px-[15px] pb-[15px] pt-3.5">
        <View className="flex-row items-center gap-2">
          <BadgeTier tier={pro ? 'pro' : 'free'} tinggi={24} />
          {kuota ? (
            <Text style={{ fontVariant: ['tabular-nums'] }} className="ml-auto font-sans text-[13.5px] font-semibold text-fg">
              {`${kuota.terpakai} / ${kuota.batas}`}
            </Text>
          ) : null}
        </View>
        <Text className="mt-2.5 font-sans text-[15px] font-semibold text-fg">{pro ? teksStatusLangganan(langganan.data) : 'Catat AI bulan ini'}</Text>
        {kuota && reset ? (
          <>
            <Text className="mt-[3px] font-sans text-xs leading-[17px] text-fg2">
              {`${pro ? 'Catat AI bulan ini: sisa' : 'Sisa'} ${sisaKuota(kuota)} kuota · reset 1 ${NAMA_BULAN[reset[1] - 1]} ${reset[0]}`}
            </Text>
            <View
              accessible
              accessibilityLabel={`Kuota AI terpakai ${persenKuota} persen`}
              className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-card2"
            >
              <View style={{ width: `${persenKuota}%`, height: '100%', backgroundColor: t.accInk }} className="rounded-full" />
            </View>
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pro ? 'Kelola langganan Pro' : 'Lihat Pro'}
          onPress={() => router.push('/premium')}
          style={{ minHeight: 46 }}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-full bg-acc px-4"
        >
          <Ikon nama="ui-check" ukuran={17} warna={t.accFg} />
          <Text style={{ color: t.accFg }} className="font-sans text-[14.5px] font-bold">
            {pro ? 'Kelola langganan' : 'Coba Pro 14 hari'}
          </Text>
        </Pressable>
      </View>

      <JudulSeksiAkun>Pengingat</JudulSeksiAkun>
      <PengaturanPengingat pro={pro} onBukaPremium={() => router.push('/premium?dari=pengingat')} />

      <JudulSeksiAkun>Data & privasi</JudulSeksiAkun>
      <KartuGrupAkun>
        <BarisMenuAkun
          pertama
          ikon="ui-bell"
          judul="Catat otomatis dari notifikasi"
          sub="GoPay dan ShopeePay, Android"
          onPress={() => router.push('/notifikasi-dompet')}
        />
        <BarisMenuAkun
          ikon="ui-ekspor"
          judul="Ekspor data"
          sub={pro ? undefined : 'Gratis dengan iklan, atau Pro'}
          accessibilityLabel={pro ? 'Ekspor data' : 'Ekspor data · Pro'}
          kanan={pro ? null : <BadgeTier tier="pro" tinggi={20} />}
          onPress={() => router.push('/ekspor')}
        />
        <BarisMenuAkun
          ikon="ui-privacy"
          judul="Kebijakan privasi"
          onPress={() => void WebBrowser.openBrowserAsync(URL_KEBIJAKAN_PRIVASI)}
        />
        <BarisMenuAkun ikon="act-hapus" judul="Hapus akun" bahaya onPress={() => router.push('/hapus-akun')} />
        <BarisMenuAkun ikon="ui-logout" judul="Keluar" onPress={() => void signOut()} />
      </KartuGrupAkun>

      <Text className="px-0.5 pt-0.5 text-center font-sans text-[11px] leading-4 text-mid">
        {`arta · Own Your Money${versi ? `\nVersi ${versi}` : ''}`}
      </Text>
    </ScrollView>
  );
}
