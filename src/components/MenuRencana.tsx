import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeTier } from '@/components/BadgeTier';
import { BarisMenuAkun, JudulSeksiAkun, KartuGrupAkun, type NadaProgres } from '@/components/BarisAkun';
import type { NamaIkon } from '@/components/ikon/data';
import { formatRingkas } from '@/domain/money';

/** Ringkasan opsional per baris; dihitung layar Akun dari hook data. Tanpa ringkasan, baris tetap tampil. */
export type RingkasanRencana = {
  budget?: { persen: number; sub: string; nada: NadaProgres } | null;
  darurat?: { total: number; target: number | null; persen: number | null } | null;
  investasi?: { jumlah: number; total: number } | null;
};

const rp = (n: number) => `Rp${formatRingkas(n)}`;

type ItemMenu = {
  label: string;
  ikon: NamaIkon;
  rute: string;
  pro?: boolean;
  sub?: string | null;
  subWaspada?: boolean;
  progres?: { persen: number; nada?: NadaProgres } | null;
  nilai?: string | null;
};

function susunMenu(r: RingkasanRencana): ItemMenu[] {
  const { budget, darurat, investasi } = r;
  return [
    {
      label: 'Budget',
      ikon: 'ui-budget',
      rute: '/budget',
      sub: budget ? budget.sub : 'Batas bulanan per kategori',
      subWaspada: budget?.nada === 'lewat',
      progres: budget ? { persen: budget.persen, nada: budget.nada } : null,
      nilai: budget ? `${budget.persen}%` : null,
    },
    {
      label: 'Dana darurat',
      ikon: 'ui-shield',
      rute: '/dana-darurat',
      sub: darurat
        ? darurat.target !== null
          ? `${rp(darurat.total)} dari ${rp(darurat.target)}`
          : `${rp(darurat.total)} terkumpul`
        : 'Bantalan untuk kejadian tak terduga',
      progres: darurat && darurat.persen !== null ? { persen: darurat.persen } : null,
      nilai: darurat && darurat.persen !== null ? `${darurat.persen}%` : null,
    },
    {
      label: 'Investasi',
      ikon: 'wallet-investasi',
      rute: '/investasi',
      sub: investasi ? `${investasi.jumlah} aset terpantau` : 'Pantau nilai aset',
      nilai: investasi ? rp(investasi.total) : null,
    },
    { label: 'Laporan email', ikon: 'ui-ekspor', rute: '/laporan', pro: true, sub: 'Maks. 3 penerima, gratis dengan iklan' },
  ];
}

/** Bagian "Rencana keuangan" di layar Akun: pintu masuk ke budget, dana darurat, investasi, dan laporan. */
export function MenuRencana({
  ringkasan = {},
  onBukaBudget,
}: {
  ringkasan?: RingkasanRencana;
  /** Bila diisi, baris Budget memanggil ini (mis. membuka sheet) alih-alih pindah ke halaman Budget. */
  onBukaBudget?: () => void;
}) {
  const router = useRouter();
  return (
    <View className="gap-3">
      <JudulSeksiAkun>Rencana keuangan</JudulSeksiAkun>
      <KartuGrupAkun>
        {susunMenu(ringkasan).map((m, i) => (
          <BarisMenuAkun
            key={m.rute}
            pertama={i === 0}
            ikon={m.ikon}
            judul={m.label}
            sub={m.sub}
            subWaspada={m.subWaspada}
            progres={m.progres}
            nilai={m.nilai}
            kanan={m.pro ? <BadgeTier tier="pro" tinggi={20} /> : null}
            accessibilityLabel={m.label}
            onPress={() => (m.rute === '/budget' && onBukaBudget ? onBukaBudget() : router.push(m.rute as never))}
          />
        ))}
      </KartuGrupAkun>
    </View>
  );
}
