-- Academia DB Defect Tests (demonstrating defects in 20261107_init.sql)
-- Run with: psql -v ON_ERROR_STOP=0 -f test/db/00_defect_tests.sql

\echo '=== TEST 1: New auth user auto-provisioning defect ==='
-- Expectation: inserting into auth.users provisions public.profiles and public.quotas.
-- Defect: No trigger exists on auth.users in 20261107_init.sql.
INSERT INTO auth.users (id, email) VALUES ('a0000000-0000-0000-0000-000000000001', 'student1@example.com') ON CONFLICT DO NOTHING;
SELECT CASE 
  WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000001') 
  THEN 'DEFECT CONFIRMED: No profile created for auth.users signup'
  ELSE 'PASS'
END AS test_1_profile_provisioning;

\echo '=== TEST 2: consume_quota failure on unprovisioned user ==='
-- Defect: Because no quotas row exists, consume_quota returns FALSE.
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001"}', true);
SET LOCAL ROLE authenticated;
SELECT CASE 
  WHEN public.consume_quota('portfolio') = FALSE
  THEN 'DEFECT CONFIRMED: consume_quota fails because quotas row was never created'
  ELSE 'UNEXPECTED'
END AS test_2_consume_quota_unprovisioned;

\echo '=== TEST 3: Banned student quota consumption defect ==='
-- Setup manual profile and quota with status = 'BAN'
RESET ROLE;
INSERT INTO public.profiles (id, email, name, role, tier, status)
VALUES ('b0000000-0000-0000-0000-000000000002', 'banned@example.com', 'Banned Student', 'student', 'A', 'BAN')
ON CONFLICT (id) DO UPDATE SET status = 'BAN';
INSERT INTO public.quotas (user_id, portfolio_daily, portfolio_weekly)
VALUES ('b0000000-0000-0000-0000-000000000002', 3, 10)
ON CONFLICT (user_id) DO UPDATE SET portfolio_daily = 3;

-- Defect: Banned user can still consume quota because consume_quota ignores status!
SELECT set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002"}', true);
SET LOCAL ROLE authenticated;
SELECT CASE 
  WHEN public.consume_quota('portfolio') = TRUE
  THEN 'DEFECT CONFIRMED: Banned student successfully consumed quota (status check missing)'
  ELSE 'BLOCKED'
END AS test_3_banned_user_quota;

\echo '=== TEST 4: search_path hijack vulnerability defect ==='
-- Defect: is_admin and consume_quota are SECURITY DEFINER without SET search_path.
RESET ROLE;
SELECT proname, prosecdef, proconfig 
FROM pg_proc 
WHERE proname IN ('is_admin', 'consume_quota') AND pronamespace = 'public'::regnamespace;
-- proconfig is NULL when SET search_path is not declared.

\echo '=== TEST 5: Plaintext token storage defect ==='
-- Defect: consent_token is stored in plaintext with no hashing requirement.
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'parental_consents' AND column_name = 'consent_token';

\echo '=== TEST 6: Incomplete RLS on audit tables defect ==='
-- Defect: parental_consents and admin_warnings have RLS enabled but 0 policies.
SELECT schemaname, tablename, rowsecurity, 
       (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public' AND tablename IN ('parental_consents', 'admin_warnings');

