// Penyambung Deno untuk `report-monthly` (verify_jwt = false, dilindungi header x-cron-secret,
// dipanggil pg_cron tiap jam). Service role karena job berjalan tanpa sesi pengguna; setiap kueri
// menyaring user_id. Logika di ../_shared/laporan/handlerBulanan.ts. File ini dikecualikan dari tsc.
import { createClient } from '@supabase/supabase-js';
import { pilihPengirim } from '../_shared/laporan/email.ts';
import { buatHandlerBulanan } from '../_shared/laporan/handlerBulanan.ts';
import {
  buatTandatanganHmac,
  klaimBulanan,
  muatDataLaporan,
  muatKandidat,
  muatPenerima,
  selesaiBulanan,
  type SbLike,
} from '../_shared/laporan/muat.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}) as unknown as SbLike;

Deno.serve(
  buatHandlerBulanan({
    rahasiaCron: Deno.env.get('LAPORAN_CRON_SECRET') ?? '',
    kandidat: () => muatKandidat(sb, new Date()),
    klaim: (userId, bulan) => klaimBulanan(sb, userId, bulan),
    data: (userId) => muatDataLaporan(sb, userId),
    penerima: (userId) => muatPenerima(sb, userId),
    selesai: (id, status, jumlah) => selesaiBulanan(sb, id, status, jumlah),
    email: pilihPengirim((k) => Deno.env.get(k), fetch, console.log),
    tandatangan: buatTandatanganHmac(Deno.env.get('LAPORAN_SECRET') ?? '', crypto.subtle),
    urlVerify: `${SUPABASE_URL}/functions/v1/report-verify`,
    sekarang: () => new Date(),
  }),
);
