import { createClient } from '@supabase/supabase-js';
import { cleanupUsers, createTestUser } from './helpers';

afterAll(cleanupUsers);

const env = (n: string) => {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env var ${n} (set it in .env.test)`);
  return v;
};
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = () =>
  createClient(new URL(env('SUPABASE_URL')).origin, env('SUPABASE_SERVICE_ROLE_KEY'), opts);
const anon = () =>
  createClient(new URL(env('SUPABASE_URL')).origin, env('SUPABASE_ANON_KEY'), opts);

const bulanJakarta = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' })
    .format(new Date())
    .slice(0, 7);

test('pengguna baru: kuota 0 dari 30, bukan pro', async () => {
  const a = await createTestUser();
  const { data, error } = await a.client.rpc('kuota_ai');
  expect(error).toBeNull();
  expect(data).toEqual({ bulan: bulanJakarta(), terpakai: 0, batas: 30, pro: false });
});

test('30 pemakaian ok, ke-31 ditolak dan terpakai tetap 30', async () => {
  const a = await createTestUser();
  for (let i = 1; i <= 30; i++) {
    const { data, error } = await a.client.rpc('pakai_kuota_ai');
    expect(error).toBeNull();
    expect(data.ok).toBe(true);
    expect(data.terpakai).toBe(i);
  }
  const { data, error } = await a.client.rpc('pakai_kuota_ai');
  expect(error).toBeNull();
  expect(data).toEqual({ ok: false, bulan: bulanJakarta(), terpakai: 30, batas: 30, pro: false });
  const { data: k } = await a.client.rpc('kuota_ai');
  expect(k.terpakai).toBe(30);
});

test('pemakaian paralel tidak melewati batas', async () => {
  const a = await createTestUser();
  const hasil = await Promise.all(
    Array.from({ length: 35 }, () => a.client.rpc('pakai_kuota_ai')),
  );
  expect(hasil.every((r) => r.error === null)).toBe(true);
  expect(hasil.filter((r) => r.data?.ok === true)).toHaveLength(30);
  const { data: k } = await a.client.rpc('kuota_ai');
  expect(k.terpakai).toBe(30);
});

test('pengguna B tidak bisa membaca ai_usage milik A', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  await a.client.rpc('pakai_kuota_ai');
  const own = await a.client.from('ai_usage').select('*');
  expect(own.data).toHaveLength(1);
  const { data, error } = await b.client.from('ai_usage').select('*');
  expect(error).toBeNull();
  expect(data).toEqual([]);
});

test('insert/update langsung ke ai_usage dan entitlements ditolak', async () => {
  const a = await createTestUser();
  await a.client.rpc('pakai_kuota_ai');
  const bulan = bulanJakarta();

  const i1 = await a.client
    .from('ai_usage')
    .insert({ user_id: a.userId, bulan: '2030-01', jumlah: 0 });
  expect(i1.error).not.toBeNull();
  const u1 = await a.client.from('ai_usage').update({ jumlah: 0 }).eq('bulan', bulan);
  expect(u1.error).not.toBeNull();
  const { data: k } = await a.client.rpc('kuota_ai');
  expect(k.terpakai).toBe(1);

  const i2 = await a.client.from('entitlements').insert({ user_id: a.userId, pro_aktif: true });
  expect(i2.error).not.toBeNull();
  const u2 = await a.client
    .from('entitlements')
    .update({ pro_aktif: true })
    .eq('user_id', a.userId);
  expect(u2.error).not.toBeNull();
  const { data: k2 } = await a.client.rpc('kuota_ai');
  expect(k2.pro).toBe(false);
});

test('anon tidak bisa memanggil kuota_ai atau pakai_kuota_ai', async () => {
  const r1 = await anon().rpc('kuota_ai');
  expect(r1.error).not.toBeNull();
  const r2 = await anon().rpc('pakai_kuota_ai');
  expect(r2.error).not.toBeNull();
});

test('entitlements pro aktif -> batas 600; berlaku_sampai lampau -> bukan pro', async () => {
  const a = await createTestUser();
  const svc = admin();
  const ins = await svc
    .from('entitlements')
    .insert({ user_id: a.userId, pro_aktif: true, sumber: 'tes' });
  expect(ins.error).toBeNull();
  const { data } = await a.client.rpc('kuota_ai');
  expect(data).toMatchObject({ batas: 600, pro: true });

  const upd = await svc
    .from('entitlements')
    .update({ berlaku_sampai: new Date(Date.now() - 86_400_000).toISOString() })
    .eq('user_id', a.userId);
  expect(upd.error).toBeNull();
  const { data: lampau } = await a.client.rpc('kuota_ai');
  expect(lampau).toMatchObject({ batas: 30, pro: false });

  await svc
    .from('entitlements')
    .update({ berlaku_sampai: new Date(Date.now() + 86_400_000).toISOString() })
    .eq('user_id', a.userId);
  const { data: depan } = await a.client.rpc('kuota_ai');
  expect(depan).toMatchObject({ batas: 600, pro: true });
});
