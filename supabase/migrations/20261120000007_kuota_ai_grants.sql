-- Grant eksplisit untuk tabel kuota AI (idempotent; aman di atas 0006).
-- API roles tidak boleh menulis; penulisan hanya lewat fungsi security definer / service role.

revoke all on public.ai_usage, public.entitlements from public, anon, authenticated;
grant select on public.ai_usage, public.entitlements to authenticated;
grant all on public.ai_usage, public.entitlements to service_role;
