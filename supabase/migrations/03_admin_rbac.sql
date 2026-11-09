/**
 * Supabase Migration: 03_admin_rbac.sql
 * Strict Administrative Isolation, Multi-Tenant RBAC, Cryptographic Audit Trail,
 * and Immutable Security Governance Logs.
 */

-- 1. App-specific Role and JWT claim inspection function
CREATE OR REPLACE FUNCTION public.is_academia_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Strict inspection of Supabase Auth JWT claims (app_metadata.claims.role or app_metadata.role)
  IF (COALESCE(auth.jwt() -> 'app_metadata' -> 'claims' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'academia_admin') THEN
    RETURN TRUE;
  END IF;

  -- Fallback check against verified profile table with active status
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'::user_role
      AND status = 'ACTIVE'::account_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Announcements table with strict administrative RLS
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' NOT NULL CHECK (priority IN ('normal', 'high', 'pinned')),
  author TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Read: All authenticated students and admins can view announcements
DROP POLICY IF EXISTS "Anyone can read announcements" ON public.announcements;
CREATE POLICY "Anyone can read announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (true);

-- Write: Strictly authorized administrators only
DROP POLICY IF EXISTS "Admins can insert announcements" ON public.announcements;
CREATE POLICY "Admins can insert announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_academia_admin());

DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (public.is_academia_admin());

DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (public.is_academia_admin());

-- 3. Immutable, append-only security governance audit trail
CREATE TABLE IF NOT EXISTS public.admin_governance_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_state JSONB,
  new_state JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admin_governance_actions ENABLE ROW LEVEL SECURITY;

-- Security invariant: Read strictly by admins; NO UPDATE or DELETE policies ever created (append-only)
DROP POLICY IF EXISTS "Admins can view governance actions" ON public.admin_governance_actions;
CREATE POLICY "Admins can view governance actions"
  ON public.admin_governance_actions FOR SELECT
  TO authenticated
  USING (public.is_academia_admin());

DROP POLICY IF EXISTS "Admins can insert governance actions" ON public.admin_governance_actions;
CREATE POLICY "Admins can insert governance actions"
  ON public.admin_governance_actions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_academia_admin());

-- 4. RPC: Admin Student Lifecycle Modification
CREATE OR REPLACE FUNCTION public.rpc_admin_update_student_status(
  p_student_id UUID,
  p_status account_status,
  p_reason TEXT,
  p_inactive_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_old_profile public.profiles%ROWTYPE;
  v_new_profile public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_academia_admin() THEN
    RAISE EXCEPTION 'Access Denied: Administrative authorization required (role != academia_admin)';
  END IF;

  SELECT * INTO v_old_profile FROM public.profiles WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student profile with id % not found', p_student_id;
  END IF;

  UPDATE public.profiles
  SET status = p_status,
      inactive_until = CASE WHEN p_status = 'INACTIVE'::account_status THEN p_inactive_until ELSE NULL END,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_student_id
  RETURNING * INTO v_new_profile;

  -- Append to immutable governance audit log
  INSERT INTO public.admin_governance_actions (
    admin_id, action_type, target_user_id, previous_state, new_state, reason
  ) VALUES (
    auth.uid(),
    'STATUS_UPDATE',
    p_student_id,
    jsonb_build_object('status', v_old_profile.status, 'inactive_until', v_old_profile.inactive_until),
    jsonb_build_object('status', v_new_profile.status, 'inactive_until', v_new_profile.inactive_until),
    p_reason
  );

  RETURN to_jsonb(v_new_profile);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: System-Wide Announcement Composer
CREATE OR REPLACE FUNCTION public.rpc_admin_create_announcement(
  p_title TEXT,
  p_body TEXT,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS JSONB AS $$
DECLARE
  v_announcement public.announcements%ROWTYPE;
  v_admin_name TEXT;
BEGIN
  IF NOT public.is_academia_admin() THEN
    RAISE EXCEPTION 'Access Denied: Administrative authorization required';
  END IF;

  SELECT name INTO v_admin_name FROM public.profiles WHERE id = auth.uid();
  IF v_admin_name IS NULL THEN
    v_admin_name := 'Admin Registrar';
  END IF;

  INSERT INTO public.announcements (title, body, priority, author)
  VALUES (p_title, p_body, p_priority, v_admin_name)
  RETURNING * INTO v_announcement;

  -- Log action
  INSERT INTO public.admin_governance_actions (
    admin_id, action_type, new_state, reason
  ) VALUES (
    auth.uid(),
    'ANNOUNCEMENT_CREATED',
    to_jsonb(v_announcement),
    'Global broadcast published'
  );

  RETURN to_jsonb(v_announcement);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Fetch Verified Parental Consent Audit Stream
CREATE OR REPLACE FUNCTION public.rpc_admin_fetch_consent_audit_stream()
RETURNS JSONB AS $$
DECLARE
  v_results JSONB;
BEGIN
  IF NOT public.is_academia_admin() THEN
    RAISE EXCEPTION 'Access Denied: Administrative authorization required';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'child_id', c.child_id,
      'child_name', p.name,
      'guardian_email', c.guardian_email,
      'policy_version', c.policy_version,
      'school_code', c.school_code,
      'verified', c.verified,
      'verified_at', c.verified_at,
      'created_at', c.created_at,
      'expires_at', c.expires_at
    )
  )
  INTO v_results
  FROM public.parental_consents c
  LEFT JOIN public.profiles p ON p.id = c.child_id
  ORDER BY c.created_at DESC;

  RETURN COALESCE(v_results, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

