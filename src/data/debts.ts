import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Hutang, MetodeBunga, Tagihan, TipeHutang } from '@/domain/types';
import { toAppError, type AppError } from './errors';

// Didefinisikan di transactions.ts (dipakai NewTx); hanya tipe, jadi tanpa import runtime melingkar.
export type { HutangBaru } from './transactions';

type Row = Record<string, unknown>;

const numOrNull = (v: unknown) => (v == null ? null : Number(v));
const strOrNull = (v: unknown) => (v == null ? null : (v as string));

/** Baris `v_hutang` -> Hutang. bigint/numeric dari PostgREST bisa berupa string. */
export function toHutang(r: Row): Hutang {
  return {
    id: r.id as string,
    pemberi: r.pemberi as string,
    tipe: r.tipe as TipeHutang,
    tanggal_mulai: r.tanggal_mulai as string,
    pokok_awal: Number(r.pokok_awal),
    nominal_cicilan: numOrNull(r.nominal_cicilan),
    tenor_bulan: numOrNull(r.tenor_bulan),
    bunga_persen_bulanan: numOrNull(r.bunga_persen_bulanan),
    metode: (r.metode ?? null) as MetodeBunga | null,
    diarsip: Boolean(r.diarsip),
    sisa_pokok: Number(r.sisa_pokok ?? 0),
    total_bunga: Number(r.total_bunga ?? 0),
    total_bayar: Number(r.total_bayar ?? 0),
    jumlah_tagihan: Number(r.jumlah_tagihan ?? 0),
    tagihan_lunas: Number(r.tagihan_lunas ?? 0),
    jatuh_tempo_berikutnya: strOrNull(r.jatuh_tempo_berikutnya),
    nominal_berikutnya: numOrNull(r.nominal_berikutnya),
    jatuh_tempo_terakhir: strOrNull(r.jatuh_tempo_terakhir),
    bayar_terakhir: strOrNull(r.bayar_terakhir),
  };
}

/** Baris `debt_schedule` -> Tagihan. */
export function toTagihan(r: Row): Tagihan {
  return {
    id: r.id as string,
    debt_id: r.debt_id as string,
    jatuh_tempo: r.jatuh_tempo as string,
    nominal: Number(r.nominal),
    status: r.status as Tagihan['status'],
    transaction_id: strOrNull(r.transaction_id),
  };
}

// Satu literal (bukan gabungan `+`) agar parser kolom supabase-js tetap mengenali tipenya.
const COLS_HUTANG =
  'id,pemberi,tipe,tanggal_mulai,pokok_awal,nominal_cicilan,tenor_bulan,bunga_persen_bulanan,metode,diarsip,sisa_pokok,total_bunga,total_bayar,jumlah_tagihan,tagihan_lunas,jatuh_tempo_berikutnya,nominal_berikutnya,jatuh_tempo_terakhir,bayar_terakhir';

const COLS_JADWAL = 'id,debt_id,jatuh_tempo,nominal,status,transaction_id';

/**
 * Daftar hutang dari `v_hutang`. `arsip` true/false memfilter `diarsip`; tanpa `arsip` -> semua.
 * Kunci: ['debts', 'list', arsip ?? null].
 */
export function useDebts({ arsip }: { arsip?: boolean } = {}) {
  return useQuery<Hutang[], AppError>({
    queryKey: ['debts', 'list', arsip ?? null],
    queryFn: async () => {
      let q = supabase.from('v_hutang').select(COLS_HUTANG);
      if (arsip !== undefined) q = q.eq('diarsip', arsip);
      const { data, error } = await q
        .order('jatuh_tempo_berikutnya', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (error) throw toAppError(error, { aksi: 'baca' });
      return (data ?? []).map((r) => toHutang(r as Row));
    },
  });
}

/** Satu hutang menurut id; data awal diambil dari cache daftar mana pun bila ada. */
export function useDebt(id: string) {
  const qc = useQueryClient();
  return useQuery<Hutang, AppError>({
    queryKey: ['debts', 'one', id],
    initialData: () => {
      for (const [, list] of qc.getQueriesData<Hutang[]>({ queryKey: ['debts', 'list'] })) {
        const h = list?.find((d) => d.id === id);
        if (h) return h;
      }
      return undefined;
    },
    queryFn: async () => {
      const { data, error } = await supabase.from('v_hutang').select(COLS_HUTANG).eq('id', id).single();
      if (error) throw toAppError(error, { aksi: 'baca' });
      return toHutang(data as Row);
    },
  });
}

/** Jadwal tagihan satu hutang, urut `jatuh_tempo`. */
export function useDebtSchedule(id: string) {
  return useQuery<Tagihan[], AppError>({
    queryKey: ['debts', 'jadwal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_schedule')
        .select(COLS_JADWAL)
        .eq('debt_id', id)
        .order('jatuh_tempo', { ascending: true });
      if (error) throw toAppError(error, { aksi: 'baca' });
      return (data ?? []).map((r) => toTagihan(r as Row));
    },
  });
}

export type PatchHutang = Partial<Pick<Hutang, 'pemberi' | 'diarsip' | 'bunga_persen_bulanan' | 'metode' | 'pokok_awal'>>;

/** Ubah kolom `debts`. Perubahan bunga/pokok memicu hitung ulang porsi di server. */
export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation<void, AppError, { id: string; patch: PatchHutang }>({
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase.from('debts').update(patch).eq('id', id).select('id').single();
      if (error) throw toAppError(error, { aksi: 'simpan-transaksi' });
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['debts'] }),
        qc.invalidateQueries({ queryKey: ['transactions'] }),
      ]),
  });
}

/** Hapus hutang; transaksi & jadwalnya ikut terhapus (cascade), saldo dompet berubah. */
export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation<void, AppError, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (error) throw toAppError(error, { aksi: 'simpan-transaksi' });
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['debts'] }),
        qc.invalidateQueries({ queryKey: ['transactions'] }),
        qc.invalidateQueries({ queryKey: ['wallets'] }),
      ]),
  });
}

export type JadwalBaru = { debt_id: string; jatuh_tempo: string; nominal: number };

/** Tambah/ubah satu tagihan hutang berbunga lewat RPC `tambah_jadwal`. */
export function useTambahJadwal() {
  const qc = useQueryClient();
  return useMutation<Tagihan, AppError, JadwalBaru>({
    mutationFn: async ({ debt_id, jatuh_tempo, nominal }) => {
      let res;
      try {
        res = await supabase.rpc('tambah_jadwal', {
          p_debt: debt_id,
          p_jatuh_tempo: jatuh_tempo,
          p_nominal: nominal,
        });
      } catch (e) {
        throw toAppError(e, { aksi: 'simpan-transaksi' });
      }
      if (res.error) throw toAppError(res.error, { aksi: 'simpan-transaksi' });
      const row = Array.isArray(res.data) ? res.data[0] : res.data;
      return toTagihan(row as Row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  });
}
