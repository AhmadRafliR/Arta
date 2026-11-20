import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { PESAN_OFFLINE_UMUM, PESAN_UMUM, toAppError, type AppError } from './errors';

export type Penerima = {
  id: string;
  email: string;
  terverifikasi: boolean;
  verifikasi_dikirim_pada: string | null;
};

export const PESAN_EMAIL_TIDAK_VALID = 'Alamat email tidak valid';
export const PESAN_EMAIL_KEMBAR = 'Email ini sudah ada di daftar';

// Sama dengan check constraint di SQL (report_recipients.email).
const POLA_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const KOLOM = 'id,email,terverifikasi,verifikasi_dikirim_pada';

type BodyGalat = { galat?: string; pesan?: string };

async function petakanGalatInvoke(e: unknown): Promise<AppError> {
  const o = (e && typeof e === 'object' ? e : {}) as { name?: unknown; context?: { json?: () => Promise<unknown> } };
  if (o.name === 'FunctionsFetchError') return { kind: 'offline', pesan: PESAN_OFFLINE_UMUM };
  if (o.name === 'FunctionsHttpError') {
    let body: BodyGalat = {};
    try {
      const b = await o.context?.json?.();
      if (b && typeof b === 'object') body = b as BodyGalat;
    } catch {
      // body bukan JSON: pakai pesan umum
    }
    const pesan = typeof body.pesan === 'string' && body.pesan ? body.pesan : PESAN_UMUM;
    return { kind: 'lain', pesan };
  }
  return toAppError(e, { aksi: 'lain' });
}

const sudahAppError = (e: unknown): e is AppError => !!e && typeof e === 'object' && 'kind' in e && 'pesan' in e;

async function panggilReportSend<T>(body: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase.functions.invoke('report-send', { body });
    if (error) throw await petakanGalatInvoke(error);
    return data as T;
  } catch (e) {
    if (sudahAppError(e)) throw e;
    throw toAppError(e, { aksi: 'lain' });
  }
}

function toPenerima(r: unknown): Penerima {
  const o = r as Record<string, unknown>;
  return {
    id: o.id as string,
    email: o.email as string,
    terverifikasi: Boolean(o.terverifikasi),
    verifikasi_dikirim_pada: (o.verifikasi_dikirim_pada as string | null) ?? null,
  };
}

/** Minta Edge Function mengirim email verifikasi ke satu penerima. */
export async function kirimVerifikasi(recipientId: string): Promise<{ terkirim: true }> {
  return panggilReportSend<{ terkirim: true }>({ aksi: 'verifikasi', recipient_id: recipientId });
}

export function usePenerima() {
  return useQuery<Penerima[], AppError>({
    queryKey: ['penerima-laporan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_recipients')
        .select(KOLOM)
        .order('created_at', { ascending: true });
      if (error) throw toAppError(error, { aksi: 'baca' });
      return (data ?? []).map(toPenerima);
    },
  });
}

export type HasilTambahPenerima = {
  penerima: Penerima;
  verifikasiTerkirim: boolean;
  pesanVerifikasi?: string;
};

export function useTambahPenerima() {
  const qc = useQueryClient();
  return useMutation<HasilTambahPenerima, AppError, string>({
    mutationFn: async (emailMentah) => {
      const email = emailMentah.trim().toLowerCase();
      if (email.length > 254 || !POLA_EMAIL.test(email)) {
        const galat: AppError = { kind: 'validasi', pesan: PESAN_EMAIL_TIDAK_VALID };
        throw galat;
      }
      const { data, error } = await supabase.from('report_recipients').insert({ email }).select(KOLOM).single();
      if (error) {
        const e = toAppError(error);
        if (e.code === '23505') throw { ...e, kind: 'validasi', pesan: PESAN_EMAIL_KEMBAR } as AppError;
        throw e;
      }
      const penerima = toPenerima(data);
      try {
        await kirimVerifikasi(penerima.id);
        return { penerima, verifikasiTerkirim: true };
      } catch (e) {
        return { penerima, verifikasiTerkirim: false, pesanVerifikasi: (e as AppError).pesan };
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['penerima-laporan'] }),
  });
}

export function useHapusPenerima() {
  const qc = useQueryClient();
  return useMutation<void, AppError, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('report_recipients').delete().eq('id', id);
      if (error) throw toAppError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['penerima-laporan'] }),
  });
}

export function useKirimVerifikasi() {
  const qc = useQueryClient();
  return useMutation<{ terkirim: true }, AppError, string>({
    mutationFn: (recipientId) => kirimVerifikasi(recipientId),
    onSettled: () => qc.invalidateQueries({ queryKey: ['penerima-laporan'] }),
  });
}

export function useKirimLaporan() {
  return useMutation<{ terkirim: number; bulan: string }, AppError, { bulan: string }>({
    mutationFn: ({ bulan }) => panggilReportSend<{ terkirim: number; bulan: string }>({ aksi: 'kirim', bulan }),
  });
}
