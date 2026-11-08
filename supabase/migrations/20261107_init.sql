/**
 * Supabase Schema & Migrations for Academia
 *
 * Applies PostgreSQL Row-Level Security (RLS), RBAC, Quota enforcement,
 * and DPDP-compliant parental consent logging.
 */

-- Roles Enum
CREATE TYPE user_role AS ENUM ('student', 'admin');
CREATE TYPE account_status AS ENUM ('ACTIVE', 'INACTIVE', 'BAN');
CREATE TYPE tier_code AS ENUM ('A', 'B', 'C', 'D', 'E');

-- Profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role user_role DEFAULT 'student'::user_role NOT NULL,
  tier tier_code DEFAULT 'A'::tier_code NOT NULL,
  status account_status DEFAULT 'ACTIVE'::account_status NOT NULL,
  inactive_until TIMESTAMPTZ,
  flags INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Quotas Table with Local Reset Tracker
CREATE TABLE IF NOT EXISTS public.quotas (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  portfolio_daily INTEGER DEFAULT 3 NOT NULL,
  portfolio_weekly INTEGER DEFAULT 10 NOT NULL,
  sandbox_daily INTEGER DEFAULT 1 NOT NULL,
  sandbox_weekly INTEGER DEFAULT 5 NOT NULL,
  chat_daily INTEGER DEFAULT 25 NOT NULL,
  chat_weekly INTEGER DEFAULT 150 NOT NULL,
  last_daily_reset DATE DEFAULT CURRENT_DATE NOT NULL,
  last_weekly_reset DATE DEFAULT CURRENT_DATE NOT NULL
);

-- Minor Consent Tokens & Verifiable Audit Trail (DPDP Act / COPPA)
CREATE TABLE IF NOT EXISTS public.parental_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  guardian_email TEXT NOT NULL,
  consent_token TEXT NOT NULL UNIQUE,
  policy_version TEXT DEFAULT '2026.1' NOT NULL,
  verified BOOLEAN DEFAULT FALSE NOT NULL,
  school_code TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Administrative Warnings & Audit Log
CREATE TABLE IF NOT EXISTS public.admin_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  ts TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_warnings ENABLE ROW LEVEL SECURITY;

-- Helper function to verify admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::user_role AND status = 'ACTIVE'::account_status
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS: Profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Only admins can update roles/statuses"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- RLS: Quotas
CREATE POLICY "Users can read own quotas"
  ON public.quotas FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Atomic Quota Deduction with Server-Side Reset
CREATE OR REPLACE FUNCTION public.consume_quota(target_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  uid UUID := auth.uid();
  q public.quotas%ROWTYPE;
  today DATE := CURRENT_DATE;
  monday DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
BEGIN
  SELECT * INTO q FROM public.quotas WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Daily reset if date passed
  IF q.last_daily_reset < today THEN
    q.portfolio_daily := 3;
    q.sandbox_daily := 1;
    q.chat_daily := 25;
    q.last_daily_reset := today;
  END IF;

  -- Weekly reset if week boundary passed
  IF q.last_weekly_reset < monday THEN
    q.portfolio_weekly := 10;
    q.sandbox_weekly := 5;
    q.chat_weekly := 150;
    q.last_weekly_reset := monday;
  END IF;

  -- Check & Deduct
  IF target_key = 'portfolio' AND q.portfolio_daily > 0 AND q.portfolio_weekly > 0 THEN
    q.portfolio_daily := q.portfolio_daily - 1;
    q.portfolio_weekly := q.portfolio_weekly - 1;
  ELSIF target_key = 'sandbox' AND q.sandbox_daily > 0 AND q.sandbox_weekly > 0 THEN
    q.sandbox_daily := q.sandbox_daily - 1;
    q.sandbox_weekly := q.sandbox_weekly - 1;
  ELSIF target_key = 'chat' AND q.chat_daily > 0 AND q.chat_weekly > 0 THEN
    q.chat_daily := q.chat_daily - 1;
    q.chat_weekly := q.chat_weekly - 1;
  ELSE
    RETURN FALSE; -- Quota exhausted
  END IF;

  UPDATE public.quotas
  SET portfolio_daily = q.portfolio_daily, portfolio_weekly = q.portfolio_weekly,
      sandbox_daily = q.sandbox_daily, sandbox_weekly = q.sandbox_weekly,
      chat_daily = q.chat_daily, chat_weekly = q.chat_weekly,
      last_daily_reset = q.last_daily_reset, last_weekly_reset = q.last_weekly_reset
  WHERE user_id = uid;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

