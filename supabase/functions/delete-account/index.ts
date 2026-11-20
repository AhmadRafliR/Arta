// Penyambung Deno untuk handler `delete-account`. Logika ada di ../_shared/hapusAkun.ts (dites di Jest).
// File ini dikecualikan dari tsc. Rahasia (service role, REVENUECAT_SECRET_KEY) hanya dari env Supabase.
import { createClient } from '@supabase/supabase-js';
import { buatHandlerHapusAkun } from '../_shared/hapusAkun.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPSI = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, OPSI);

Deno.serve(
  buatHandlerHapusAkun({
    async pengguna(token) {
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, OPSI);
      const { data, error } = await sb.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },

    async hapusRevenueCat(userId) {
      const kunci = Deno.env.get('REVENUECAT_SECRET_KEY');
      if (!kunci) return; // belum diset: dilewati
      const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${kunci}` },
      });
      await res.body?.cancel();
      // 404 = pelanggan tidak ada di RevenueCat: dianggap beres.
      if (!res.ok && res.status !== 404) throw new Error(`revenuecat ${res.status}`);
    },

    async hapusPengguna(userId) {
      const { error } = await admin().auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser ${error.status ?? ''}`);
    },

    async sisaData(userId) {
      const { data, error } = await admin().rpc('sisa_data_pengguna', { p_user: userId });
      if (error) throw new Error(`rpc ${error.code ?? ''}`);
      return ((data ?? []) as { tabel: string; jumlah: number | string }[]).map((r) => ({
        tabel: r.tabel,
        jumlah: Number(r.jumlah),
      }));
    },
  }),
);
