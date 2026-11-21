import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { Ikon } from '@/components/ikon/Ikon';
import { BarisDompetLain } from '@/components/onboarding/BarisDompetLain';
import { BarisPilihDompet, PetakIkon } from '@/components/onboarding/BarisPilihDompet';
import {
  NAMA_BAWAAN,
  PILIHAN_AWAL,
  SARAN,
  namaDepan,
  type ItemDompet,
  type TipeSaran,
} from '@/components/onboarding/data';
import { DockOnboarding } from '@/components/onboarding/DockOnboarding';
import { HeroSaldoAwal } from '@/components/onboarding/HeroSaldoAwal';
import { IntroOnboarding } from '@/components/onboarding/IntroOnboarding';
import { KartuSaldoDompet } from '@/components/onboarding/KartuSaldoDompet';
import { LayarSelesai } from '@/components/onboarding/LayarSelesai';
import { OverlayAkunSiap } from '@/components/onboarding/OverlayAkunSiap';
import { StripTotal } from '@/components/onboarding/StripTotal';
import { CatatanInfo, KepalaSeksi, KolomGalat } from '@/components/onboarding/Teks';
import { TopbarOnboarding } from '@/components/onboarding/TopbarOnboarding';
import { useCreateWallet } from '@/data/wallets';
import { toAppError, type AppError } from '@/data/errors';
import { adalahNamaKembar } from '@/data/pesan';
import { formatRupiah } from '@/domain/money';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

type Tambahan = { key: string; nama: string };
type Selesai = { total: number; sub: string };
type Baris = { key: string; nama: string; tipe: TipeSaran; saldo: number; target: number | null };

// Hook data sudah melempar AppError; galat mentah (mis. dari supabase) dibungkus.
function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}

function hariIniLokal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function jumlah(daftar: ItemDompet[], nilai: (it: ItemDompet) => number, tipe?: TipeSaran): number {
  return daftar.filter((it) => !tipe || it.tipe === tipe).reduce((s, it) => s + nilai(it), 0);
}

export default function DompetAwal() {
  const { session, profile, refreshProfile } = useAuth();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const createWallet = useCreateWallet();
  const kurangiGerak = useReducedMotion();

  const [intro, setIntro] = useState(!kurangiGerak);
  const [langkah, setLangkah] = useState<1 | 2>(1);
  const [nama, setNama] = useState('');
  const [pilih, setPilih] = useState<Record<string, boolean>>(PILIHAN_AWAL);
  const [saldo, setSaldo] = useState<Record<string, number | null>>({});
  const [target, setTarget] = useState<Record<string, number | null>>({});
  const [revisi, setRevisi] = useState<Record<string, number>>({});
  const [tambahan, setTambahan] = useState<Tambahan[]>([]);
  const [dibuat, setDibuat] = useState<Record<string, boolean>>({});
  const [fokusKey, setFokusKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selesai, setSelesai] = useState<Selesai | null>(null);
  const urut = useRef(0);
  const jalan = useRef(false); // penjaga proses berjalan: ketukan ganda tidak memulai dua kali
  const dibuatRef = useRef<Record<string, number>>({}); // key -> saldo awal dompet yang sudah dibuat (idempoten)
  const scrollRef = useRef<ScrollViewInstance>(null);

  const semua: ItemDompet[] = useMemo(
    () => [
      ...SARAN,
      ...tambahan.map<ItemDompet>((c) => ({
        key: c.key,
        nama: c.nama,
        tipe: 'harian',
        ikon: 'ui-pocket',
        hint: 'Dompet tambahan',
        custom: true,
      })),
    ],
    [tambahan],
  );
  const terpilih = semua.filter((it) => it.custom || pilih[it.key]);
  const nilaiSaldo = (it: ItemDompet) => saldo[it.key] ?? 0;
  const total = jumlah(terpilih, nilaiSaldo);
  const harian = jumlah(terpilih, nilaiSaldo, 'harian');
  const darurat = jumlah(terpilih, nilaiSaldo, 'darurat');
  const terisi = terpilih.filter((it) => nilaiSaldo(it) > 0).length;

  // Validasi: nama tidak kosong dan tidak kembar; nominal & target valid.
  const namaBersih = terpilih.map((it) => it.nama.trim().toLowerCase());
  const kembar = namaBersih.some((n, i) => n !== '' && namaBersih.indexOf(n) !== i);
  const kosong = terpilih.some((it) => it.nama.trim() === '');
  const nominalSalah = terpilih.some((it) => saldo[it.key] === null || target[it.key] === null);
  const peringatan = kembar ? 'Nama dompet tidak boleh sama.' : kosong ? 'Isi nama dompet dulu.' : null;
  const tampilGalat = error ?? peringatan;
  const namaBermasalah = kembar || kosong;

  const sapaan = namaDepan(nama) || namaDepan(profile?.nama) || namaDepan(sumberGoogle(session));

  const catatanHero =
    langkah === 1
      ? terisi
        ? `${terisi} dompet sudah ada saldo · lanjut untuk periksa`
        : 'Belum ada saldo terisi.'
      : total > 0
        ? `${terisi} dompet terisi · total dana saat ini`
        : 'Isi saldo di bawah atau kosongkan saja.';

  const ke = useCallback((l: 1 | 2) => {
    setLangkah(l);
    setError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Tombol kembali Android: dari langkah 2 ke langkah 1 dulu.
  useEffect(() => {
    if (langkah !== 2 || selesai || busy) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      ke(1);
      return true;
    });
    return () => sub.remove();
  }, [langkah, selesai, busy, ke]);

  const tutupIntro = useCallback(() => setIntro(false), []);

  function ubahTarget(key: string, n: number | null) {
    // allowZero: 0/kosong = tanpa target; null = nominal tidak valid.
    setTarget((s) => ({ ...s, [key]: n === null ? null : n > 0 ? n : 0 }));
  }

  function tambahDompet() {
    urut.current += 1;
    const key = `c${urut.current}`;
    setTambahan((c) => [...c, { key, nama: '' }]);
    setFokusKey(key);
    if (langkah === 1) ke(2);
  }

  function hapusTambahan(key: string) {
    setTambahan((c) => c.filter((x) => x.key !== key));
    setSaldo((s) => omit(s, key));
    setTarget((s) => omit(s, key));
  }

  function pintasan(key: string, v: number) {
    setSaldo((s) => ({ ...s, [key]: v }));
    setRevisi((r) => ({ ...r, [key]: (r[key] ?? 0) + 1 }));
  }

  function lanjut() {
    if (terpilih.length === 0) {
      setError('Pilih minimal satu dompet dulu.');
      return;
    }
    ke(2);
  }

  async function simpan(lewati: boolean) {
    if (busy || jalan.current || !session || namaBermasalah) return;
    if (!lewati && nominalSalah) return;
    jalan.current = true;
    setBusy(true);
    setError(null);
    try {
      // Tanpa dompet terpilih (hanya lewat Lewati): buat "Cash" bawaan agar app tidak kosong.
      const baris: Baris[] =
        terpilih.length === 0
          ? [{ key: 'bawaan', nama: NAMA_BAWAAN, tipe: 'harian', saldo: 0, target: null }]
          : terpilih.map((it) => ({
              key: it.key,
              nama: it.nama.trim(),
              tipe: it.tipe,
              saldo: lewati ? 0 : (saldo[it.key] ?? 0),
              target: it.tipe === 'darurat' ? target[it.key] || null : null,
            }));
      const tanggal = hariIniLokal();
      for (const r of baris) {
        // Baris yang sudah dibuat dilewati saat coba lagi: tanpa duplikat.
        if (r.key in dibuatRef.current) continue;
        try {
          await createWallet.mutateAsync({
            nama: r.nama,
            tipe: r.tipe,
            saldo_awal: r.saldo,
            tanggal_saldo_awal: tanggal,
            ...(r.tipe === 'darurat' ? { target: r.target } : {}),
          });
        } catch (e) {
          // 23505 (nama sudah ada): percobaan sebelumnya sudah membuatnya (respons hilang / profil gagal) -> lanjut.
          if (!adalahNamaKembar(e)) throw e;
        }
        dibuatRef.current[r.key] = r.saldo;
        setDibuat((d) => ({ ...d, [r.key]: true }));
      }
      const { error: err } = await supabase
        .from('profiles')
        .update({ nama: nama.trim() || null, onboarding_selesai: true })
        .eq('id', session.user.id);
      if (err) throw toAppError(err);
      const jumlahTotal = baris.reduce((s, r) => s + (dibuatRef.current[r.key] ?? 0), 0);
      const berisi = baris.filter((r) => (dibuatRef.current[r.key] ?? 0) > 0).length;
      setSelesai({
        total: jumlahTotal,
        sub: lewati
          ? 'Kamu bisa mengisi saldo kapan saja dari layar Akun.'
          : berisi > 0
            ? `${berisi} dompet siap dipakai. Sekarang kamu bisa langsung mencatat transaksi pertama.`
            : 'Semua dompet mulai dari Rp0. Catat transaksi pertama untuk mengisi saldo.',
      });
    } catch (e) {
      setError(pesanGalat(e));
    } finally {
      jalan.current = false;
      setBusy(false);
    }
  }

  if (selesai) {
    // AuthGate mengalihkan ke /(tabs) setelah profil diperbarui.
    return <LayarSelesai total={selesai.total} sub={selesai.sub} onLanjut={() => refreshProfile()} />;
  }
  if (intro) return <OverlayAkunSiap onSelesai={tutupIntro} />;

  const utamaNonaktif = busy || (langkah === 1 ? terpilih.length === 0 : terpilih.length === 0 || namaBermasalah || nominalSalah);
  const awalPilih = semua.filter((it) => !it.custom);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ paddingTop: insets.top }}
      className="flex-1 bg-bg"
    >
      <TopbarOnboarding langkah={langkah} />
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, gap: 18 }}
      >
        <IntroOnboarding langkah={langkah} nama={sapaan} />

        {langkah === 1 ? (
          <View className="gap-1.5">
            <Text className="text-[11.5px] font-semibold text-mid font-sans">Nama panggilan (opsional)</Text>
            <TextInput
              value={nama}
              onChangeText={setNama}
              placeholder="Nama panggilan"
              placeholderTextColor={t.mid}
              accessibilityLabel="Nama panggilan (opsional)"
              maxLength={40}
              style={{ borderColor: t.line }}
              className="min-h-[44px] rounded-[14px] border bg-card px-[14px] py-2 text-sm text-fg font-sans"
            />
          </View>
        ) : null}

        <HeroSaldoAwal total={total} harian={harian} darurat={darurat} catatan={catatanHero} />

        <View className="gap-2.5">
          <KepalaSeksi judul="Pilih dompet kamu" catatan={`${terpilih.length} dipilih`} />
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Pilih dompet"
            style={{ borderColor: t.line }}
            className="overflow-hidden rounded-[20px] border bg-card"
          >
            {awalPilih.map((it, i) => (
              <BarisPilihDompet
                key={it.key}
                nama={it.nama}
                hint={dibuat[it.key] ? 'sudah dibuat' : pilih[it.key] ? `${formatRupiah(nilaiSaldo(it))} · ${it.hint}` : it.hint}
                ikon={it.ikon}
                dipilih={!!pilih[it.key]}
                terkunci={!!dibuat[it.key]}
                pertama={i === 0}
                onToggle={() => setPilih((p) => ({ ...p, [it.key]: !p[it.key] }))}
              />
            ))}
          </View>
        </View>

        {langkah === 2 && terpilih.length > 0 ? (
          <View className="gap-2.5 pt-1">
            <KepalaSeksi judul="Saldo tiap dompet" catatan="Rupiah" />
            {terpilih.map((it) => (
              <KartuSaldoDompet
                key={it.key}
                item={it}
                saldo={saldo[it.key] ?? 0}
                target={target[it.key] ?? null}
                revisi={revisi[it.key] ?? 0}
                terkunci={!!dibuat[it.key]}
                onSaldo={(n) => setSaldo((s) => ({ ...s, [it.key]: n }))}
                onTarget={(n) => ubahTarget(it.key, n)}
                onPintasan={(v) => pintasan(it.key, v)}
              />
            ))}
          </View>
        ) : null}

        {tambahan.length > 0 ? (
          <View className="gap-2.5 pt-1">
            <KepalaSeksi judul="Dompet lain" catatan="Opsional" />
            {tambahan.map((c) => (
              <BarisDompetLain
                key={c.key}
                nama={c.nama}
                terkunci={!!dibuat[c.key]}
                fokus={fokusKey === c.key}
                onNama={(v) => setTambahan((l) => l.map((x) => (x.key === c.key ? { ...x, nama: v } : x)))}
                onHapus={() => hapusTambahan(c.key)}
              />
            ))}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tambah dompet lain"
          onPress={tambahDompet}
          style={{ borderColor: t.line, borderStyle: 'dashed', minHeight: 56 }}
          className="flex-row items-center gap-3 rounded-[20px] border px-4 py-[11px]"
        >
          <PetakIkon ikon="ui-wallet-plus" />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-[14.5px] font-semibold leading-[19px] text-fg font-sans">Tambah dompet lain</Text>
            <Text className="text-[11.5px] leading-[16px] text-mid font-sans">Mis. e-wallet lain, rekening bank, uang tunai</Text>
          </View>
          <Ikon nama="ui-arrow-right" ukuran={16} warna={t.mid} />
        </Pressable>

        <StripTotal total={total} jumlah={terpilih.length} />

        <CatatanInfo>
          Saldo awal dicatat sebagai titik mulai, bukan pemasukan — jadi laporan bulan ini tetap bersih. Kamu bisa mengubahnya kapan saja di Akun.
        </CatatanInfo>

        <KolomGalat pesan={tampilGalat} />

        <Text className="px-1 pt-0.5 text-center text-[11px] leading-[16px] text-mid font-sans">arta · Own Your Money</Text>
      </ScrollView>

      <DockOnboarding
        langkah={langkah}
        utamaNonaktif={utamaNonaktif}
        lewatiNonaktif={busy || namaBermasalah}
        busy={busy}
        bawah={insets.bottom}
        onUtama={() => (langkah === 1 ? lanjut() : simpan(false))}
        onLewati={() => simpan(true)}
        onKembali={() => ke(1)}
      />
    </KeyboardAvoidingView>
  );
}

function omit<T>(o: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _hapus, ...sisa } = o;
  return sisa;
}

function sumberGoogle(session: { user?: { user_metadata?: Record<string, unknown> } } | null): string {
  const m = session?.user?.user_metadata;
  const v = m?.full_name ?? m?.name;
  return typeof v === 'string' ? v : '';
}
