# Task 2 report: DB schema + RLS

Status: DONE_WITH_CONCERNS (awaiting owner's `npx supabase db push --remote`; GREEN run pending). Commit 65c86f7.

## Implemented
- supabase/migrations/20261119000001_init.sql: profiles, wallets, categories, transactions exactly per brief; index transactions(user_id, tanggal desc); RLS on all four with per-operation policies (`user_id = (select auth.uid())`, with check on insert/update; profiles keyed on id); trigger on auth.users insert -> handle_new_user (security definer, search_path = '', fully qualified) creating profile + 9 default categories (6 pengeluaran, 3 pemasukan).
- tests/integration/helpers.ts (createTestUser via admin API + anon sign-in, cleanupUsers), rls.test.ts (4 tests from brief), jest.integration.config.js (node env, babel-jest + preset-typescript, dotenv .env.test), package.json: script test:integration (--runInBand), testPathIgnorePatterns for tests/integration in default jest, devDependency dotenv.
- supabase/config.toml + supabase/.gitignore (from `supabase init`; .temp stays ignored/uncommitted).

## RED evidence
`npm run test:integration`: 3 failed, 1 passed. Failures: PGRST205 "Could not find the table 'public.wallets'/'public.profiles' in the schema cache". The test "B cannot insert wallet for A" passes vacuously now (error not null because table missing); it becomes meaningful after push.

## SQL decisions
- user_id has `default auth.uid()` so tests/app can insert without passing user_id (brief test inserts `{nama, saldo_awal}` only).
- handle_new_user execute revoked from public/anon/authenticated.
- Policies are `to authenticated`; no delete policy on profiles (cascade from auth.users handles it).
- Not done: policy preventing wallet_id referencing another user's wallet (FK only). Possible hardening later; save_transactions (invoker) could validate.

## Concerns
- .env.test SUPABASE_URL contains a path (/rest/v1/). helpers.ts tolerates this via `new URL(...).origin`; owner may want to fix the value to the bare project URL.
- Not verified against Postgres (no Docker); SQL reviewed by reading only. supabase init --force rewrote supabase/.gitignore (still ignores .temp, .branches).
- Pending: owner runs `npx supabase db push --remote`, then re-run `npm run test:integration` for GREEN (4 tests).

## Post-push run (1)
`npm run test:integration` after first push: Tests: 3 failed, 1 passed. Cause: Postgres 42501 "permission denied for table profiles/wallets" -- the hosted project did not grant table privileges to `authenticated`, so RLS never got evaluated.
Fix: new migration supabase/migrations/20261119000002_grants.sql (grant select/insert/update[/delete] to authenticated on the 4 tables). Initial migration left untouched. ANOTHER `npx supabase db push --remote` IS NEEDED, then re-run integration tests (GREEN pending).
Test users: the createTestUser/cleanupUsers afterAll ran; users are deleted per run (not independently verified via admin list).
`npm run typecheck`: initially failed (node `crypto` import in helpers.ts); fixed by dropping the import (local random id helper); now clean.
`npm test`: 85 pass, 2-3 fail (AmountInput, catat.test.tsx) with "Exceeded timeout of 5000 ms" on this slow machine; unrelated to this task (only change to default jest config is testPathIgnorePatterns). Flaky/pre-existing.

## GREEN (after grants migration pushed)
`npm run test:integration` -> Test Suites: 1 passed, 1 total; Tests: 4 passed, 4 total.
Cleanup check (service-role admin listUsers): total users 0, @example.com users 0. No test users left behind.
Task 2 status: DONE.
