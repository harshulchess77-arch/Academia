-- Academia Test Database Auth Shim
-- Approximates Supabase auth environment for local PostgreSQL testing and CI.
-- Creates auth schema, users table, roles, and auth.uid() helper.

CREATE SCHEMA IF NOT EXISTS auth;

-- Roles required by Supabase RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

-- Simulated auth.users table
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- auth.uid() function matching Supabase GoTrue request.jwt.claims context
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- auth.role() function
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claims', true)::json->>'role', '');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grants
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO authenticated, service_role;

