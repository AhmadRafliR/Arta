-- Hosted project does not auto-grant table privileges to API roles; RLS still restricts rows.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.wallets to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
