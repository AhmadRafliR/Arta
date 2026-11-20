// Migrasi 20261120000041: push_tokens, pengaturan_pengingat, log_pengingat, penerima_pengingat.
import { createClient } from '@supabase/supabase-js';
import { cleanupUsers, createTestUser, uuidV4 } from './helpers';

afterAll(cleanupUsers);

const env = (n: string) => {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env var ${n} (set it in .env.test)`);
  return v;
};
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = () =>
  createClient(new URL(env('SUPABASE_URL')).origin, env('SUPABASE_SERVICE_ROLE_KEY'), opts);

const tokenBaru = () => `ExponentPushToken[${uuidV4()}]`;

async function jadikanPro(userId: string) {
  const { error } = await admin().rpc('terapkan_event_langganan', {
    p_user: userId,
    p_pro: true,
    p_berlaku_sampai: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    p_produk: 'arta_pro:bulanan',
    p_periode: 'normal',
    p_akan_diperpanjang: true,
    p_event_ms: Date.now(),
    p_sumber: 'revenuecat_sandbox',
  });
  if (error) throw new Error(error.message);
}

test('simpan_push_token menyimpan token milik sendiri', async () => {
  const a = await createTestUser();
  const tok = tokenBaru();
  expect((await a.client.rpc('simpan_push_token', { p_token: tok, p_platform: 'android' })).error).toBeNull();
  const { data } = await a.client.from('push_tokens').select('token, user_id, platform');
  expect(data).toEqual([{ token: tok, user_id: a.userId, platform: 'android' }]);
});

test('token tidak valid / platform tidak valid ditolak', async () => {
  const a = await createTestUser();
  const r1 = await a.client.rpc('simpan_push_token', { p_token: 'bukan-token', p_platform: 'android' });
  expect(r1.error?.message).toMatch(/Token push tidak valid/);
  const r2 = await a.client.rpc('simpan_push_token', { p_token: tokenBaru(), p_platform: 'symbian' });
  expect(r2.error?.message).toMatch(/Platform tidak valid/);
});

test('token yang sama dari akun lain berpindah pemilik (K14)', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const tok = tokenBaru();
  await a.client.rpc('simpan_push_token', { p_token: tok, p_platform: 'android' });
  await b.client.rpc('simpan_push_token', { p_token: tok, p_platform: 'android' });
  expect((await a.client.from('push_tokens').select('token')).data).toEqual([]);
  expect((await b.client.from('push_tokens').select('token')).data).toEqual([{ token: tok }]);
});

test('B tidak bisa membaca, menghapus, atau menyisipkan token A', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const tok = tokenBaru();
  await a.client.rpc('simpan_push_token', { p_token: tok, p_platform: 'android' });
  expect((await b.client.from('push_tokens').select('token').eq('token', tok)).data).toEqual([]);
  await b.client.rpc('hapus_push_token', { p_token: tok });
  await b.client.from('push_tokens').delete().eq('token', tok);
  expect((await a.client.from('push_tokens').select('token')).data).toEqual([{ token: tok }]);
  const ins = await b.client.from('push_tokens').insert({ token: tokenBaru(), platform: 'android' });
  expect(ins.error).not.toBeNull();
});

test('hapus_push_token menghapus token sendiri', async () => {
  const a = await createTestUser();
  const tok = tokenBaru();
  await a.client.rpc('simpan_push_token', { p_token: tok, p_platform: 'android' });
  await a.client.rpc('hapus_push_token', { p_token: tok });
  expect((await a.client.from('push_tokens').select('token')).data).toEqual([]);
});

test('pengaturan_pengingat: upsert milik sendiri, nilai tidak valid ditolak, B tidak melihat', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const up = await a.client
    .from('pengaturan_pengingat')
    .upsert({ user_id: a.userId, aktif: true, hari_sebelum: 3, jam: 19 });
  expect(up.error).toBeNull();
  const salah = await a.client.from('pengaturan_pengingat').upsert({ user_id: a.userId, hari_sebelum: 2 });
  expect(salah.error).not.toBeNull();
  expect((await b.client.from('pengaturan_pengingat').select('*')).data).toEqual([]);
  const bAtasNamaA = await b.client.from('pengaturan_pengingat').insert({ user_id: a.userId });
  expect(bAtasNamaA.error).not.toBeNull();
});

test('log_pengingat dan penerima_pengingat tertutup untuk authenticated', async () => {
  const a = await createTestUser();
  expect((await a.client.from('log_pengingat').select('*')).error).not.toBeNull();
  expect((await a.client.rpc('penerima_pengingat')).error).not.toBeNull();
});

test('penerima_pengingat: hanya Pro + punya token + pengingat aktif; default H-1 08.00', async () => {
  const proAktif = await createTestUser();
  const proMati = await createTestUser();
  const gratis = await createTestUser();
  const proTanpaToken = await createTestUser();
  for (const u of [proAktif, proMati, proTanpaToken]) await jadikanPro(u.userId);

  const tokA = tokenBaru();
  await proAktif.client.rpc('simpan_push_token', { p_token: tokA, p_platform: 'android' });
  await proMati.client.rpc('simpan_push_token', { p_token: tokenBaru(), p_platform: 'android' });
  await proMati.client.from('pengaturan_pengingat').upsert({ user_id: proMati.userId, aktif: false });
  await gratis.client.rpc('simpan_push_token', { p_token: tokenBaru(), p_platform: 'android' });

  const { data, error } = await admin().rpc('penerima_pengingat');
  expect(error).toBeNull();
  const ids = (data as { user_id: string }[]).map((r) => r.user_id);
  expect(ids).toContain(proAktif.userId);
  expect(ids).not.toContain(proMati.userId);
  expect(ids).not.toContain(gratis.userId);
  expect(ids).not.toContain(proTanpaToken.userId);
  const baris = (data as Record<string, unknown>[]).find((r) => r.user_id === proAktif.userId);
  expect(baris).toMatchObject({ tokens: [tokA], hari_sebelum: 1, jam: 8, zona_waktu: 'Asia/Jakarta' });
});
