-- Transaksi hanya boleh merujuk dompet milik user yang sama (FK komposit).
alter table public.wallets
  add constraint wallets_id_user_id_key unique (id, user_id);

alter table public.transactions
  drop constraint transactions_wallet_id_fkey,
  drop constraint transactions_wallet_tujuan_id_fkey;

-- MATCH SIMPLE (default): NULL pada wallet_id / wallet_tujuan_id tetap diizinkan.
alter table public.transactions
  add constraint transactions_wallet_owner_fkey
    foreign key (wallet_id, user_id) references public.wallets (id, user_id),
  add constraint transactions_wallet_tujuan_owner_fkey
    foreign key (wallet_tujuan_id, user_id) references public.wallets (id, user_id);

create index transactions_wallet_id_idx on public.transactions (wallet_id);
create index transactions_wallet_tujuan_id_idx on public.transactions (wallet_tujuan_id);
