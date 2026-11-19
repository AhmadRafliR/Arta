import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (set it in .env.test)`);
  return v;
}

// Tolerate a SUPABASE_URL pasted with a path such as /rest/v1/.
const projectUrl = () => new URL(env('SUPABASE_URL')).origin;

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false } };

let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (!admin) admin = createClient(projectUrl(), env('SUPABASE_SERVICE_ROLE_KEY'), clientOpts);
  return admin;
}

const createdUserIds: string[] = [];

export async function createTestUser(): Promise<{ client: SupabaseClient; userId: string }> {
  const email = `test-${randomUUID()}@example.com`;
  const password = `${randomUUID()}${randomUUID()}`;
  const { data, error } = await getAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  createdUserIds.push(data.user.id);

  const client = createClient(projectUrl(), env('SUPABASE_ANON_KEY'), clientOpts);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);
  return { client, userId: data.user.id };
}

export async function cleanupUsers(): Promise<void> {
  const ids = createdUserIds.splice(0);
  await Promise.all(ids.map((id) => getAdmin().auth.admin.deleteUser(id)));
}
