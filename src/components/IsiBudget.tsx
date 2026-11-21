import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { kapital } from '@/components/BarBudget';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { ikonKategori } from '@/components/ikon/peta';
import { useAuth } from '@/auth/AuthProvider';
import { useBudgets } from '@/data/budgets';
import { useTransactions } from '@/data/transactions';
import {
  adalahBudgetSemua,
  labelKategoriBudget,
  pemakaianBudget,
  type PemakaianBudget,
  type StatusBudget,
} from '@/domain/budget';
import { formatRupiah } from '@/domain/money';
import { hariIni } from '@/lib/tanggal';
import { useTheme } from '@/theme/ThemeProvider';

const BULAN_PENUH = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function ikonBudget(kategori: string): NamaIkon {
  return adalahBudgetSemua(kategori) ? 'ui-sigma' : ikonKategori(kategori);
}

const TEKS_STATUS: Record<StatusBudget, string> = { aman: 'Aman', waspada: 'Waspada', lewat: 'Lewat' };

/** Data budget bulan ini dari hook (dipakai sheet dan halaman). */
export function useRingkasBudget() {
  const { profile } = useAuth();
  const bulan = hariIni(profile?.zona_waktu || undefined).slice(0, 7);
  const budgets = useBudgets();
  const txs = useTransactions(bulan);
  const galat = budgets.error ?? txs.error;
  const siap = budgets.data !== undefined && txs.data !== undefined;
  const daftar = siap ? pemakaianBudget(budgets.data ?? [], txs.data ?? [], bulan) : [];
  // Seluruh kategori di urutan teratas, sisanya mengikuti urutan pemakaian.
  const urut = [...daftar.filter((p) => adalahBudgetSemua(p.kategori)), ...daftar.filter((p) => !adalahBudgetSemua(p.kategori))];
  const perKategori = daftar.filter((p) => !adalahBudgetSemua(p.kategori));
  const dasar = perKategori.length > 0 ? perKategori : daftar;
  const batas = dasar.reduce((s, p) => s + p.batas, 0);
  // Mockup: total "dipakai" dibatasi per kategori supaya kategori yang lewat tidak menggelembungkan persen.
  const pakai = dasar.reduce((s, p) => s + Math.min(p.terpakai, p.batas), 0);
  const lewat = daftar.filter((p) => p.status === 'lewat').length;
  const [y, m] = bulan.split('-').map(Number);
  return { galat, siap, daftar: urut, batas, pakai, lewat, labelBulan: `${BULAN_PENUH[m - 1]} ${y}` };
}

function Cincin({ persen, warna }: { persen: number; warna: string }) {
  const { t } = useTheme();
  const r = 26;
  const k = 2 * Math.PI * r;
  return (
    <View style={{ width: 62, height: 62 }} className="items-center justify-center">
      <Svg width={62} height={62} viewBox="0 0 62 62" style={{ position: 'absolute' }}>
        <Circle cx={31} cy={31} r={r} stroke={t.line} strokeWidth={5} fill="none" />
        <Circle
          cx={31}
          cy={31}
          r={r}
          stroke={warna}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${k}`}
          strokeDashoffset={k * (1 - Math.min(100, persen) / 100)}
          transform="rotate(-90 31 31)"
        />
      </Svg>
      <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[14px] font-bold text-fg">
        {`${persen}%`}
      </Text>
    </View>
  );
}

function BarisBudget({ p, onPress, pertama }: { p: PemakaianBudget; onPress: () => void; pertama: boolean }) {
  const { t } = useTheme();
  const nama = kapital(labelKategoriBudget(p.kategori));
  const warna = p.status === 'lewat' ? t.danger : p.status === 'waspada' ? t.warn : t.accInk;
  const warnaTeks = p.status === 'lewat' ? t.dangerInk : p.status === 'waspada' ? t.warnInk : t.fg2;
  const latarIkon = p.status === 'lewat' ? t.dangerSoft : p.status === 'waspada' ? t.warnBg : t.card2;
  const sisaTeks = p.sisa >= 0 ? `${formatRupiah(p.sisa)} sisa` : `${formatRupiah(-p.sisa)} lewat`;
  const nilai = `${formatRupiah(p.terpakai)} / ${formatRupiah(p.batas)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nama}, ${nilai}, ${TEKS_STATUS[p.status]}`}
      onPress={onPress}
      className={`flex-row items-center gap-[11px] px-3 py-[11px] ${pertama ? '' : 'border-t border-line'}`}
    >
      <View style={{ width: 34, height: 34, backgroundColor: latarIkon }} className="items-center justify-center rounded-[11px]">
        <Ikon nama={ikonBudget(p.kategori)} ukuran={18} warna={p.status === 'aman' ? t.fg2 : warnaTeks} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text className="flex-shrink font-sans text-[14px] font-semibold text-fg" numberOfLines={1}>
            {nama}
          </Text>
          <View style={{ backgroundColor: p.status === 'aman' ? t.card2 : latarIkon }} className="rounded-full px-1.5 py-px">
            <Text style={{ color: p.status === 'aman' ? t.mid : warnaTeks }} className="font-sans text-[9.5px] font-bold tracking-[0.03em]">
              {TEKS_STATUS[p.status].toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={{ fontVariant: ['tabular-nums'] }} className="font-sans text-[11px] text-mid" numberOfLines={1}>
          {`${nilai} · `}
          <Text style={{ color: p.status === 'lewat' ? t.dangerInk : t.fg2 }} className="font-sans font-bold">
            {sisaTeks}
          </Text>
        </Text>
        <View className="mt-[3px] h-1 overflow-hidden rounded-full bg-card2">
          <View
            testID="bar-isi"
            style={{ width: `${Math.min(p.persen, 100)}%`, backgroundColor: warna, height: '100%', borderRadius: 999 }}
          />
        </View>
      </View>
      <Text style={{ fontVariant: ['tabular-nums'], color: p.status === 'aman' ? t.fg2 : warnaTeks }} className="font-sans text-[12.5px] font-bold">
        {`${p.persen}%`}
      </Text>
    </Pressable>
  );
}

/**
 * Isi "Budget bulanan" (mockup akun: #budgetView): kepala, ringkasan dipakai + cincin, daftar per kategori
 * dengan status, dan catatan sisa. Dipakai sheet Budget di Akun dan halaman Budget.
 */
export function IsiBudget({ onUbah, onTutup }: { onUbah: (id: string) => void; onTutup?: () => void }) {
  const { t } = useTheme();
  const r = useRingkasBudget();
  const persen = r.batas > 0 ? Math.round((r.pakai * 100) / r.batas) : 0;
  const warnaTotal = persen > 100 ? t.danger : persen >= 80 ? t.warn : t.accInk;

  const kepala = (
    <View className="flex-row items-center gap-3">
      <View style={{ width: 42, height: 42 }} className="items-center justify-center rounded-[14px] bg-accsoft">
        <Ikon nama="ui-budget" ukuran={21} warna={t.accInk} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text accessibilityRole="header" className="font-sans text-base font-semibold text-fg">
          Budget bulanan
        </Text>
        <Text className="font-sans text-xs text-fg2" numberOfLines={1}>
          {r.daftar.length > 0 ? `${r.daftar.length} kategori · ${r.labelBulan}` : 'Belum diatur'}
        </Text>
      </View>
      {onTutup ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tutup"
          onPress={onTutup}
          style={{ width: 38, height: 38 }}
          className="items-center justify-center rounded-full border border-line bg-card"
        >
          <Ikon nama="ui-close" ukuran={18} warna={t.fg} />
        </Pressable>
      ) : null}
    </View>
  );

  if (r.galat) {
    return (
      <>
        {kepala}
        <Text className="text-fg font-sans">{r.galat.pesan}</Text>
      </>
    );
  }
  if (!r.siap) {
    return (
      <>
        {kepala}
        <Text className="text-mid font-sans">Memuat…</Text>
      </>
    );
  }

  return (
    <>
      {kepala}
      <View testID="ringkasan-budget" className="gap-2.5 rounded-[20px] border border-line bg-card2 px-3.5 py-[13px]">
        <View className="flex-row items-center gap-3">
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-1.5">
              <Ikon nama="ui-money" ukuran={13} warna={t.mid} />
              <Text className="font-sans text-[10.5px] font-semibold tracking-[0.07em] text-mid">DIPAKAI BULAN INI</Text>
            </View>
            <Text style={{ fontVariant: ['tabular-nums'] }} className="mt-[3px] font-sans text-[21px] font-bold text-fg" numberOfLines={1}>
              {formatRupiah(r.pakai)}
            </Text>
            <Text className="mt-0.5 font-sans text-[11px] text-mid">
              {r.batas > 0 ? `dari ${formatRupiah(r.batas)} total batas` : 'Belum ada batas yang ditetapkan'}
            </Text>
          </View>
          <Cincin persen={persen} warna={warnaTotal} />
        </View>
        <View className="h-[5px] overflow-hidden rounded-full bg-line">
          <View style={{ width: `${Math.min(100, persen)}%`, backgroundColor: warnaTotal, height: '100%', borderRadius: 999 }} />
        </View>
      </View>

      {r.daftar.length === 0 ? (
        <View className="items-center gap-[3px] px-3.5 pb-[18px] pt-4">
          <View style={{ width: 44, height: 44 }} className="mb-1 items-center justify-center rounded-[15px] bg-accsoft">
            <Ikon nama="ui-budget" ukuran={22} warna={t.accInk} />
          </View>
          <Text className="font-sans text-[13.5px] font-bold text-fg">Belum ada budget</Text>
          <Text className="max-w-[240px] text-center font-sans text-[11.5px] leading-[17px] text-mid">
            Tetapkan batas per kategori supaya kamu tahu kapan harus ngerem.
          </Text>
        </View>
      ) : (
        <>
          <View className="gap-1">
            <View className="flex-row items-baseline px-0.5">
              <Text className="flex-1 font-sans text-[10.5px] font-bold tracking-[0.08em] text-mid">PER KATEGORI</Text>
              <Text className="font-sans text-[11px] font-semibold text-mid">{`${r.daftar.length} aktif`}</Text>
            </View>
            <View className="overflow-hidden rounded-[14px] border border-line bg-card">
              {r.daftar.map((p, i) => (
                <BarisBudget key={p.id} p={p} pertama={i === 0} onPress={() => onUbah(p.id)} />
              ))}
            </View>
          </View>
          <View className="flex-row items-center gap-1.5 px-0.5">
            <Ikon nama={r.lewat > 0 ? 'ui-alert' : 'ui-info'} ukuran={14} warna={r.lewat > 0 ? t.dangerInk : t.mid} />
            <Text style={r.lewat > 0 ? { color: t.dangerInk } : undefined} className="flex-1 font-sans text-[11.5px] font-semibold text-mid">
              {r.lewat > 0
                ? `${r.lewat} kategori sudah lewat batas bulan ini.`
                : `Sisa ${formatRupiah(Math.max(0, r.batas - r.pakai))} dari total batas bulan ini.`}
            </Text>
          </View>
        </>
      )}
    </>
  );
}
