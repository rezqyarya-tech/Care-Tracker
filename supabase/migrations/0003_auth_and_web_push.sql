-- Personal Care Tracker: Migration 0003
-- Restores Authenticated Multi-User Isolation (Server-Mediated Auth) & Adds Web Push (VAPID) Tables

-- 1. Ensure profiles keeps email indexed for server-side lookup
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS browser_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS compact_mode BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(email));

-- 2. Web Push Subscriptions (VAPID per device/browser per user)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- 3. Web Push Dispatch Log (prevents duplicate notifications for the same routine on the same day)
CREATE TABLE IF NOT EXISTS public.push_dispatch_logs (
  dispatch_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_dispatch_logs_date ON public.push_dispatch_logs(log_date);

-- 4. Keep RLS enabled and revoke direct client access (only Node.js server with service role accesses DB)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_dispatch_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.push_subscriptions, public.push_dispatch_logs FROM anon, authenticated;
