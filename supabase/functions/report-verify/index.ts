// Penyambung Deno untuk `report-verify` (publik, verify_jwt = false): tautan verifikasi / berhenti
// dari email. Service role dipakai karena tidak ada sesi pengguna; setiap aksi dibatasi pada
// recipientId dari token HMAC yang sudah diperiksa. Logika di ../_shared/laporan/handlerVerifikasi.ts.
// File ini dikecualikan dari tsc.
import { createClient } from '@supabase/supabase-js';
import { buatHandlerVerifikasi } from '../_shared/laporan/handlerVerifikasi.ts';
import { buatTandatanganHmac } from '../_shared/laporan/muat.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function periksa(error: { code?: string } | null, tahap: string): void {
  if (error) throw new Error(`db ${tahap} ${error.code ?? ''}`);
}

Deno.serve(
  buatHandlerVerifikasi({
    async ambilEmail(id) {
      if (!POLA_UUID.test(id)) return null;
      const { data, error } = await sb.from('report_recipients').select('email').eq('id', id).maybeSingle();
      periksa(error, 'ambil');
      return typeof data?.email === 'string' ? data.email : null;
    },
    async tandaiTerverifikasi(id) {
      const { error } = await sb
        .from('report_recipients')
        .update({ terverifikasi: true, diverifikasi_pada: new Date().toISOString() })
        .eq('id', id);
      periksa(error, 'tandai');
    },
    async hapus(id) {
      const { error } = await sb.from('report_recipients').delete().eq('id', id);
      periksa(error, 'hapus');
    },
    tandatangan: buatTandatanganHmac(Deno.env.get('LAPORAN_SECRET') ?? '', crypto.subtle),
    sekarang: () => new Date(),
  }),
);
