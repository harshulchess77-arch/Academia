/**
 * Supabase Schema & Migrations for Academia (Phase 3: Database Backend Alignment)
 *
 * Implements native database-level quota defaults, triggers for automatic quota initialization,
 * strict student account lifecycle constraints, and RPC endpoints for atomic quota and consent management.
 */

-- Ensure account_status enum has all valid boundaries
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE account_status AS ENUM ('ACTIVE', 'INACTIVE', 'BAN');
  END IF;
END$$;

-- Trigger to automatically create quotas for every new profile with PostgreSQL table defaults
CREATE OR REPLACE FUNCTION public.fn_handle_new_user_quotas()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.quotas (
    user_id,
    portfolio_daily,
    portfolio_weekly,
    sandbox_daily,
    sandbox_weekly,
    chat_daily,
    chat_weekly,
    last_daily_reset,
    last_weekly_reset
  ) VALUES (
    NEW.id,
    3,    -- Database default: 3 portfolio generations per day
    10,   -- Database default: 10 portfolio generations per week
    1,    -- Database default: 1 sandbox run per day
    5,    -- Database default: 5 sandbox runs per week
    25,   -- Database default: 25 chat turns per day
    150,  -- Database default: 150 chat turns per week
    CURRENT_DATE,
    DATE_TRUNC('week', CURRENT_DATE)::DATE
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to public.profiles
DROP TRIGGER IF EXISTS tr_user_quotas_init ON public.profiles;
CREATE TRIGGER tr_user_quotas_init
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_handle_new_user_quotas();

-- RPC: Register User Profile (Strict server-side validation)
CREATE OR REPLACE FUNCTION public.rpc_register_user_profile(
  p_email TEXT,
  p_name TEXT,
  p_role TEXT DEFAULT 'student',
  p_tier TEXT DEFAULT 'A',
  p_parent_email TEXT DEFAULT NULL,
  p_parent_token TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role user_role := COALESCE(p_role::user_role, 'student'::user_role);
  v_tier tier_code := COALESCE(p_tier::tier_code, 'A'::tier_code);
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to initialize profile';
  END IF;

  INSERT INTO public.profiles (id, email, name, role, tier, status)
  VALUES (v_uid, p_email, p_name, v_role, v_tier, 'ACTIVE'::account_status)
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = EXCLUDED.name,
      updated_at = timezone('utc'::text, now())
  RETURNING * INTO v_profile;

  -- If under 18 consent token is attached, record it
  IF p_parent_email IS NOT NULL AND p_parent_token IS NOT NULL THEN
    INSERT INTO public.parental_consents (
      child_id, guardian_email, consent_token, verified, expires_at
    ) VALUES (
      v_uid, p_parent_email, p_parent_token, TRUE, timezone('utc'::text, now() + interval '48 hours')
    )
    ON CONFLICT (consent_token) DO NOTHING;
  END IF;

  RETURN to_jsonb(v_profile);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Verify Account Lifecycle & Access Check
CREATE OR REPLACE FUNCTION public.rpc_check_account_lifecycle(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'status', 'NOT_FOUND', 'reason', 'User does not exist');
  END IF;

  IF v_profile.status = 'BAN'::account_status THEN
    RETURN jsonb_build_object('allowed', false, 'status', 'BAN', 'reason', 'Account banned by administrative action');
  ELSIF v_profile.status = 'INACTIVE'::account_status AND v_profile.inactive_until IS NOT NULL AND v_profile.inactive_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status', 'INACTIVE',
      'inactive_until', v_profile.inactive_until,
      'reason', 'Account paused until ' || v_profile.inactive_until::TEXT
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'status', 'ACTIVE', 'tier', v_profile.tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

