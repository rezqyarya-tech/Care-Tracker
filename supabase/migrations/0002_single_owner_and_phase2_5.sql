-- Personal Care Tracker: Migration 0002
-- Single-Owner No-Login Architecture + Phase 2-5 Enhancements
-- Preserves all existing tables and data while removing dependency on auth.users.

-- 1. Relax auth.users foreign keys safely so single-owner records work without Supabase Auth login
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE IF EXISTS public.products DROP CONSTRAINT IF EXISTS products_user_id_fkey;
ALTER TABLE IF EXISTS public.product_history DROP CONSTRAINT IF EXISTS product_history_user_id_fkey;
ALTER TABLE IF EXISTS public.routines DROP CONSTRAINT IF EXISTS routines_user_id_fkey;
ALTER TABLE IF EXISTS public.routine_items DROP CONSTRAINT IF EXISTS routine_items_user_id_fkey;
ALTER TABLE IF EXISTS public.routine_logs DROP CONSTRAINT IF EXISTS routine_logs_user_id_fkey;
ALTER TABLE IF EXISTS public.skin_journals DROP CONSTRAINT IF EXISTS skin_journals_user_id_fkey;
ALTER TABLE IF EXISTS public.hair_journals DROP CONSTRAINT IF EXISTS hair_journals_user_id_fkey;
ALTER TABLE IF EXISTS public.journal_photos DROP CONSTRAINT IF EXISTS journal_photos_user_id_fkey;

-- 2. Simplify profiles for single-owner preferences & reminder settings
ALTER TABLE IF EXISTS public.profiles
  ALTER COLUMN email SET DEFAULT '',
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS browser_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS compact_mode BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Phase 2 & 5 Routine enhancements: interval scheduling, hair tonic/mask types, per-routine reminders
ALTER TABLE IF EXISTS public.routines
  ADD COLUMN IF NOT EXISTS interval_days INTEGER NOT NULL DEFAULT 2 CHECK (interval_days >= 1 AND interval_days <= 60),
  ADD COLUMN IF NOT EXISTS interval_start_date DATE,
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_time TIME;

ALTER TABLE IF EXISTS public.routines DROP CONSTRAINT IF EXISTS routines_routine_type_check;
ALTER TABLE IF EXISTS public.routines
  ADD CONSTRAINT routines_routine_type_check CHECK (
    routine_type IN (
      'morning',
      'evening',
      'custom',
      'shampoo',
      'conditioner',
      'hair_tonic',
      'hair_mask',
      'hair_treatment',
      'other_hair'
    )
  );

-- 4. Lock down direct client/anon access: RLS stays enabled on all tables & private storage.
--    Only the trusted Node.js backend using SUPABASE_SERVICE_ROLE_KEY accesses these tables.
REVOKE ALL ON public.profiles,
  public.products,
  public.product_history,
  public.routines,
  public.routine_items,
  public.routine_logs,
  public.skin_journals,
  public.hair_journals,
  public.journal_photos FROM anon, authenticated;

-- Remove old client-side policies so no direct anon/browser reads or writes are permitted
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "products_all_own" ON public.products;
DROP POLICY IF EXISTS "product_history_all_own" ON public.product_history;
DROP POLICY IF EXISTS "routines_all_own" ON public.routines;
DROP POLICY IF EXISTS "routine_items_all_own" ON public.routine_items;
DROP POLICY IF EXISTS "routine_logs_all_own" ON public.routine_logs;
DROP POLICY IF EXISTS "skin_journals_all_own" ON public.skin_journals;
DROP POLICY IF EXISTS "hair_journals_all_own" ON public.hair_journals;
DROP POLICY IF EXISTS "journal_photos_all_own" ON public.journal_photos;
DROP POLICY IF EXISTS "journal_photos_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "journal_photos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "journal_photos_storage_delete" ON storage.objects;
