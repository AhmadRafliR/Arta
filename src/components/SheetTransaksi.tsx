import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { labelHariPanjang } from '@/components/BarBulan';
import { Ikon } from '@/components/ikon/Ikon';
import type { NamaIkon } from '@/components/ikon/data';
import { DaftarDetail, KepalaSheet, SheetBawah } from '@/components/SheetBawah';
import { arahTx, ikonTx, kategoriKapital, LABEL_JENIS, nominalBertanda } from '@/components/TxRow';
import { useDeleteTransaction } from '@/data/transactions';
import { toAppError, type AppError } from '@/data/errors';
import { formatRupiah } from '@/domain/money';
import type { Tx } from '@/domain/types';
import { labelTanggalRelatif } from '@/lib/labelTanggal';
import { useTheme } from '@/theme/ThemeProvider';

function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}

/** Judul transaksi di sheet (mockup: nama kategori; transfer "A → B"; hutang "Cicilan …"). */
export function judulSheet(tx: Tx, namaDompet: (id: string | null) => string | null): string {
  const kategori = kategoriKapital(tx);
  if (tx.jenis === 'transfer') {
    const asal = namaDompet(tx.wallet_id);
    const tujuan = namaDompet(tx.wallet_tujuan_id);
    return asal && tujuan ? `${asal} → ${tujuan}` : LABEL_JENIS.transfer;
  }
  if (tx.jenis === 'hutang_bayar') return kategori ? `Cicilan ${kategori}` : LABEL_JENIS.hutang_bayar;
  if (tx.jenis === 'hutang_baru') return kategori ? `Hutang ${kategori}` : LABEL_JENIS.hutang_baru;
  if (tx.jenis === 'penyesuaian' && tx.debt_id) return 'Penyesuaian sisa hutang';
  return kategori ?? tx.catatan ?? LABEL_JENIS[tx.jenis];
}

/** Baris rincian transaksi (mockup: .detail-list). */
export function rincianTx(tx: Tx, namaDompet: (id: string | null) => string | null, hariIni: string) {
  const baris: { label: string; nilai: string }[] = [{ label: 'Jenis', nilai: LABEL_JENIS[tx.jenis] }];
  const kategori = kategoriKapital(tx);
  if ((tx.jenis === 'pemasukan' || tx.jenis === 'pengeluaran') && kategori) baris.push({ label: 'Kategori', nilai: kategori });
  if (tx.jenis.startsWith('hutang_') && kategori) baris.push({ label: 'Hutang', nilai: kategori });
  baris.push({ label: 'Nominal', nilai: formatRupiah(tx.nominal) });
  if (tx.jenis === 'transfer') {
    baris.push({ label: 'Dari', nilai: namaDompet(tx.wallet_id) ?? '—' });
    baris.push({ label: 'Ke', nilai: namaDompet(tx.wallet_tujuan_id) ?? '—' });
  } else {
    const dompet = namaDompet(tx.wallet_id);
    if (dompet) baris.push({ label: tx.jenis === 'hutang_bayar' ? 'Dompet bayar' : 'Dompet', nilai: dompet });
  }
  baris.push({ label: 'Tanggal', nilai: labelHariPanjang(tx.tanggal, hariIni) });
  baris.push({ label: 'Catatan', nilai: tx.catatan || '—' });
  return baris;
}

type Varian = 'biasa' | 'bahaya' | 'konfirmasi';

// Tombol sheet berikon (mockup: .btn-sheet / .is-danger / .is-confirm). Lokal karena Tombol bersama tanpa ikon.
function TombolSheet({
  label,
  ikon,
  varian = 'biasa',
  busy,
  disabled,
  onPress,
}: {
  label: string;
  ikon: NamaIkon;
  varian?: Varian;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { t } = useTheme();
  // Teks di atas latar danger: warna kartu (putih di terang, gelap di mode gelap) seperti mockup.
  const warna = varian === 'konfirmasi' ? t.card : varian === 'bahaya' ? t.dangerInk : t.fg;
  const kelas =
    varian === 'konfirmasi' ? '' : varian === 'bahaya' ? 'border-dangersoft bg-card' : 'border-line bg-card';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { minHeight: 46, borderRadius: 14, opacity: pressed ? 0.85 : 1 },
        varian === 'konfirmasi' ? { backgroundColor: t.dangerInk, borderColor: t.dangerInk } : null,
      ]}
      className={`flex-1 flex-row items-center justify-center gap-[7px] border px-3.5 py-[11px] ${kelas}`}
    >
      {busy ? (
        <ActivityIndicator color={warna} />
      ) : (
        <>
          <Ikon nama={ikon} ukuran={18} warna={warna} />
          <Text style={{ color: warna }} className="font-sans text-sm font-semibold">
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

type Props = {
  /** Transaksi yang ditampilkan (tetap disimpan saat sheet menutup agar animasi tidak kosong). */
  tx: Tx | null;
  terbuka: boolean;
  onTutup: () => void;
  /** Buka rute ubah (`/transaksi/[id]`). */
  onUbah: (tx: Tx) => void;
  namaDompet: (id: string | null) => string | null;
  hariIni: string;
};

// Sheet detail transaksi (mockup arta: #sheet): kepala berikon + nominal, rincian, tombol Ubah dan Hapus.
// Hapus meminta konfirmasi di dalam sheet: ketuk pertama -> "Yakin hapus?", ketuk kedua -> hapus.
export function SheetTransaksi({ tx, terbuka, onTutup, onUbah, namaDompet, hariIni }: Props) {
  return (
    <SheetBawah terbuka={terbuka && !!tx} onTutup={onTutup} testID="sheet-transaksi">
      {tx ? <IsiSheet key={tx.id} tx={tx} onTutup={onTutup} onUbah={onUbah} namaDompet={namaDompet} hariIni={hariIni} /> : null}
    </SheetBawah>
  );
}

function IsiSheet({ tx, onTutup, onUbah, namaDompet, hariIni }: Omit<Props, 'tx' | 'terbuka'> & { tx: Tx }) {
  const hapus = useDeleteTransaction();
  const [yakin, setYakin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function tekanHapus() {
    if (!yakin) {
      setYakin(true);
      return;
    }
    setBusy(true);
    setGalat(null);
    try {
      await hapus.mutateAsync(tx.id);
      onTutup();
    } catch (e) {
      setGalat(pesanGalat(e));
      setYakin(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <KepalaSheet
        ikon={ikonTx(tx)}
        judul={judulSheet(tx, namaDompet)}
        sub={`${LABEL_JENIS[tx.jenis]} · ${labelTanggalRelatif(tx.tanggal, hariIni)}`}
        kanan={nominalBertanda(tx)}
        kananMasuk={arahTx(tx).masuk}
      />
      <DaftarDetail baris={rincianTx(tx, namaDompet, hariIni)} />
      {galat ? <Text className="font-sans text-[12.5px] text-dangerink">{galat}</Text> : null}
      <View className="flex-row gap-2">
        <TombolSheet label="Ubah" ikon="act-ubah" disabled={busy} onPress={() => onUbah(tx)} />
        <TombolSheet
          label={yakin ? 'Yakin hapus?' : 'Hapus'}
          ikon="act-hapus"
          varian={yakin ? 'konfirmasi' : 'bahaya'}
          busy={busy}
          disabled={busy}
          onPress={() => void tekanHapus()}
        />
      </View>
      {yakin && !busy ? (
        <Text className="text-center font-sans text-[11.5px] text-fg2">Saldo dompet akan dihitung ulang.</Text>
      ) : null}
    </>
  );
}
