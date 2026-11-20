// Penyambung Deno untuk `report-send`: Supabase dengan token pengguna (RLS berlaku), adapter email,
// HMAC. Logika ada di ../_shared/laporan/handlerKirim.ts (dites di Jest). File ini dikecualikan dari tsc.
import { createClient } from '@supabase/supabase-js';
import { GalatSesi } from '../_shared/handler.ts';
import { pilihPengirim } from '../_shared/laporan/email.ts';
import { buatHandlerKirim, type DbKirim } from '../_shared/laporan/handlerKirim.ts';
import {
  buatTandatanganHmac,
  muatDataLaporan,
  muatPenerima,
  muatPro,
  muatProfil,
  type SbLike,
} from '../_shared/laporan/muat.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

type GalatRpc = { code?: string; message?: string } | null;

// Token ditolak (401/PGRST3xx) atau fungsi tidak menemukan auth.uid() → sesi habis.
// Selain itu pesan Postgres diteruskan (mis. "Batas kirim laporan 3 kali per hari"); tidak dicatat.
function periksa(error: GalatRpc, status: number): void {
  if (!error) return;
  if (
    status === 401 ||
    (error.code ?? '').startsWith('PGRST3') ||
    (error.message ?? '').includes('Tidak terautentikasi')
  ) {
    throw new GalatSesi();
  }
  throw new Error(error.message || `db ${status}`);
}

function buatDb(token: string): DbKirim {
  const klien = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const sb = klien as unknown as SbLike;

  let uid: Promise<string> | null = null;
  const userId = () =>
    (uid ??= (async () => {
      const { data, error } = await klien.auth.getUser(token);
      if (data?.user?.id) return data.user.id;
      if (error && typeof error.status === 'number' && error.status >= 500) throw new Error('auth');
      throw new GalatSesi();
    })());

  return {
    userId,
    async pro() {
      return muatPro(sb, await userId(), new Date());
    },
    async nama() {
      return (await muatProfil(sb, await userId())).nama;
    },
    async data() {
      return muatDataLaporan(sb, await userId());
    },
    async penerima() {
      return muatPenerima(sb, await userId());
    },
    async mulaiKirim(bulan) {
      const { data, error, status } = await klien.rpc('mulai_kirim_laporan', { p_bulan: bulan });
      periksa(error, status);
      return String(data);
    },
    async selesaiKirim(id, status, jumlah) {
      const r = await klien.rpc('selesai_kirim_laporan', { p_id: id, p_status: status, p_jumlah: jumlah });
      periksa(r.error, r.status);
    },
    async tandaiVerifikasi(recipientId) {
      const { data, error, status } = await klien.rpc('tandai_verifikasi_dikirim', { p_recipient: recipientId });
      periksa(error, status);
      return data === true;
    },
  };
}

Deno.serve(
  buatHandlerKirim({
    db: buatDb,
    email: pilihPengirim((k) => Deno.env.get(k), fetch, console.log),
    tandatangan: buatTandatanganHmac(Deno.env.get('LAPORAN_SECRET') ?? '', crypto.subtle),
    urlVerify: `${SUPABASE_URL}/functions/v1/report-verify`,
    sekarang: () => new Date(),
  }),
);
