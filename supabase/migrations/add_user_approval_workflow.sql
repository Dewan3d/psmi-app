-- ============================================================
-- PSMI System — Migration: User Approval Workflow
-- ============================================================
-- Allows new users to self-register while requiring explicit
-- administrator approval before granting access to inventory data.
-- ============================================================

-- 1. Add is_approved and email columns to profiles if they do not exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Ensure all existing profiles are marked as approved
UPDATE profiles SET is_approved = true WHERE is_approved IS NULL;

-- 3. Update the handle_new_user trigger function so that self-registered
-- users are set to is_approved = false by default
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, is_approved, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    'BRANCH_STAFF',
    COALESCE((NEW.raw_user_meta_data->>'is_approved')::boolean, false),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = COALESCE(EXCLUDED.email, profiles.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
