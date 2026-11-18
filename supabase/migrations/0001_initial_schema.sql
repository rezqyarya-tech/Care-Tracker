-- Personal Care Tracker: Complete PostgreSQL & Supabase Schema
-- Migration 0001: Core Tables, Constraints, Indexes, Triggers, RLS Policies, and Private Storage

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  skin_type TEXT,
  hair_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  care_area TEXT NOT NULL CHECK (care_area IN ('face', 'hair')),
  start_date DATE NOT NULL,
  end_date DATE,
  usage_frequency TEXT NOT NULL DEFAULT 'Daily',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'discontinued')),
  notes TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT products_dates_valid CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_products_user_status ON public.products(user_id, status);
CREATE INDEX IF NOT EXISTS idx_products_user_care_area ON public.products(user_id, care_area);

-- 3. PRODUCT HISTORY (Immutable audit trail preserving start/pause/resume/discontinue events)
CREATE TABLE IF NOT EXISTS public.product_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('started', 'paused', 'resumed', 'discontinued', 'updated')),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  effective_date DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_history_product ON public.product_history(product_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_product_history_user ON public.product_history(user_id, effective_date DESC);

-- 4. ROUTINES
CREATE TABLE IF NOT EXISTS public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  care_area TEXT NOT NULL CHECK (care_area IN ('face', 'hair')),
  routine_type TEXT NOT NULL CHECK (
    routine_type IN ('morning', 'evening', 'custom', 'shampoo', 'conditioner', 'hair_treatment', 'other_hair')
  ),
  frequency_type TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency_type IN ('daily', 'weekly', 'interval', 'as_needed')),
  days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  scheduled_time TIME NOT NULL DEFAULT '08:00',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routines_user_enabled ON public.routines(user_id, is_enabled);

-- 5. ROUTINE ITEMS (Ordered activities & associated products inside a routine)
CREATE TABLE IF NOT EXISTS public.routine_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  instructions TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routine_items_routine ON public.routine_items(routine_id, step_order);

-- 6. ROUTINE LOGS (Manual completion records - never auto-completed)
CREATE TABLE IF NOT EXISTS public.routine_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  routine_item_id UUID REFERENCES public.routine_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'skipped', 'missed')),
  completed_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routine_logs_user_date ON public.routine_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_routine_logs_routine_date ON public.routine_logs(routine_id, log_date DESC);

-- 7. SKIN JOURNALS
CREATE TABLE IF NOT EXISTS public.skin_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  acne_severity INTEGER NOT NULL CHECK (acne_severity >= 0 AND acne_severity <= 10),
  acne_type TEXT NOT NULL CHECK (acne_type IN ('no_acne', 'small_pimples', 'inflamed_acne', 'deep_painful_acne', 'other')),
  acne_locations TEXT[] NOT NULL DEFAULT '{}',
  oiliness TEXT NOT NULL CHECK (oiliness IN ('dry', 'normal', 'oily', 'very_oily')),
  irritation TEXT NOT NULL CHECK (irritation IN ('none', 'mild', 'moderate', 'severe')),
  redness TEXT NOT NULL DEFAULT 'none' CHECK (redness IN ('none', 'mild', 'moderate', 'severe')),
  dryness_peeling TEXT NOT NULL DEFAULT 'none' CHECK (dryness_peeling IN ('none', 'mild', 'moderate', 'severe')),
  context_factors TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skin_journals_user_date ON public.skin_journals(user_id, entry_date DESC);

-- 8. HAIR JOURNALS
CREATE TABLE IF NOT EXISTS public.hair_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  scalp_condition TEXT NOT NULL CHECK (scalp_condition IN ('balanced', 'dry', 'oily', 'sensitive', 'irritated')),
  hair_oiliness TEXT NOT NULL CHECK (hair_oiliness IN ('dry', 'normal', 'oily', 'very_oily')),
  dandruff TEXT NOT NULL CHECK (dandruff IN ('none', 'mild', 'moderate', 'severe')),
  scalp_itching TEXT NOT NULL CHECK (scalp_itching IN ('none', 'mild', 'moderate', 'severe')),
  shedding_level TEXT NOT NULL CHECK (shedding_level IN ('minimal', 'normal', 'elevated', 'heavy')),
  general_condition TEXT NOT NULL CHECK (general_condition IN ('healthy', 'dry_frizzy', 'oily_flat', 'brittle', 'recovering')),
  washed_hair BOOLEAN NOT NULL DEFAULT FALSE,
  context_factors TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hair_journals_user_date ON public.hair_journals(user_id, entry_date DESC);

-- 9. JOURNAL PHOTOS (Private photo metadata linked to journal entries)
CREATE TABLE IF NOT EXISTS public.journal_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_type TEXT NOT NULL CHECK (journal_type IN ('face', 'hair')),
  skin_journal_id UUID REFERENCES public.skin_journals(id) ON DELETE SET NULL,
  hair_journal_id UUID REFERENCES public.hair_journals(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_photos_user_date ON public.journal_photos(user_id, entry_date DESC);

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_routines_updated_at BEFORE UPDATE ON public.routines FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_skin_journals_updated_at BEFORE UPDATE ON public.skin_journals FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_hair_journals_updated_at BEFORE UPDATE ON public.hair_journals FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hair_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_photos ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only read/insert/update/delete their own records
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "products_all_own" ON public.products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "product_history_all_own" ON public.product_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routines_all_own" ON public.routines FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_items_all_own" ON public.routine_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_logs_all_own" ON public.routine_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "skin_journals_all_own" ON public.skin_journals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "hair_journals_all_own" ON public.hair_journals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "journal_photos_all_own" ON public.journal_photos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PRIVATE STORAGE BUCKET FOR JOURNAL PHOTOS
INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-photos', 'journal-photos', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "journal_photos_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'journal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "journal_photos_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'journal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "journal_photos_storage_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'journal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
