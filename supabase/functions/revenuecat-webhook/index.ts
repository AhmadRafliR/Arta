// Penyambung Deno untuk webhook RevenueCat. Logika ada di ../_shared/revenuecat.ts (dites di Jest).
// File ini dikecualikan dari tsc. Jangan log isi body.
import { createClient } from '@supabase/supabase-js';
import { buatHandlerWebhook, type Perubahan } from '../_shared/revenuecat.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RAHASIA = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
const ENTITLEMENT = Deno.env.get('REVENUECAT_ENTITLEMENT') || 'pro';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function terapkan(p: Perubahan): Promise<boolean> {
  const { data, error } = await sb.rpc('terapkan_event_langganan', {
    p_user: p.userId,
    p_pro: p.pro,
    p_berlaku_sampai: p.berlakuSampai,
    p_produk: p.produk,
    p_periode: p.periode,
    p_akan_diperpanjang: p.akanDiperpanjang,
    p_event_ms: p.eventMs,
    p_sumber: p.sumber,
  });
  if (error) throw new Error(`db ${error.code ?? ''}`);
  return data === true;
}

Deno.serve(
  buatHandlerWebhook({
    rahasia: RAHASIA,
    entitlement: ENTITLEMENT,
    terapkan,
    sekarang: () => Date.now(),
  }),
);
