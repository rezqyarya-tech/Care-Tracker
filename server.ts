import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import * as webpush from 'web-push';
import {
  formatEndpointPreview,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './src/lib/server/authHelpers';
import { findDuePushNotificationsForUser } from './src/lib/utils/pushSchedulerLogic';
import type {
  AuthUser,
  HairJournal,
  JournalPhoto,
  Product,
  ProductEventType,
  ProductHistoryEntry,
  ProductStatus,
  Routine,
  RoutineItem,
  RoutineLog,
  SkinJournal,
  UserProfile,
} from './src/types/database';

const SESSION_COOKIE_NAME = 'pct_session';
const DEFAULT_OWNER_ID =
  process.env.OWNER_PROFILE_ID?.trim() || '00000000-0000-0000-0000-000000000001';

interface StoredLocalUser {
  id: string;
  email: string;
  passwordHash: string;
  profile: UserProfile;
}

interface StoredPushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string;
  created_at: string;
  updated_at: string;
}

interface StoredPushDispatchLog {
  dispatch_key: string;
  user_id: string;
  routine_id: string;
  log_date: string;
  sent_at: string;
}

interface VaultData {
  users: StoredLocalUser[];
  legacyOwnerProfile?: UserProfile;
  products: Product[];
  product_history: ProductHistoryEntry[];
  routines: Routine[];
  routine_items: RoutineItem[];
  routine_logs: RoutineLog[];
  skin_journals: SkinJournal[];
  hair_journals: HairJournal[];
  journal_photos: JournalPhoto[];
  push_subscriptions: StoredPushSubscription[];
  push_dispatch_logs: StoredPushDispatchLog[];
}

interface ServerSecrets {
  sessionSecret: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
}

interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const VAULT_FILE = path.join(DATA_DIR, 'vault.json');
const SECRETS_FILE = path.join(DATA_DIR, 'server-secrets.json');

const PRODUCT_STATUS_ID: Record<ProductStatus, string> = {
  active: 'Aktif',
  paused: 'Dijeda',
  discontinued: 'Dihentikan',
};

function getSupabaseServerConfig(): { url: string; serviceRoleKey: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

let cachedSupabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient | null {
  const cfg = getSupabaseServerConfig();
  if (!cfg) return null;
  if (!cachedSupabaseAdmin) {
    cachedSupabaseAdmin = createClient(cfg.url, cfg.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return cachedSupabaseAdmin;
}

function createEphemeralSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseServerConfig();
  if (!cfg) return null;
  return createClient(cfg.url, cfg.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function ensureStorageDirs(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

function loadOrCreateServerSecrets(): {
  sessionSecret: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  vapidSource: 'env' | 'local';
} {
  ensureStorageDirs();

  let persisted: Partial<ServerSecrets> = {};
  if (fs.existsSync(SECRETS_FILE)) {
    try {
      persisted = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8')) as Partial<ServerSecrets>;
    } catch {
      persisted = {};
    }
  }

  let dirty = false;

  const envSessionSecret = (process.env.SESSION_SECRET || '').trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  let sessionSecret = envSessionSecret;
  if (!sessionSecret && supabaseKey) {
    sessionSecret = crypto.createHmac('sha256', 'pct-session-v1').update(supabaseKey).digest('hex');
  }
  if (!sessionSecret) {
    if (persisted.sessionSecret) {
      sessionSecret = persisted.sessionSecret;
    } else {
      sessionSecret = crypto.randomBytes(32).toString('hex');
      persisted.sessionSecret = sessionSecret;
      dirty = true;
    }
  }

  const envVapidPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envVapidPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const vapidSubject =
    (process.env.VAPID_SUBJECT || '').trim() || 'mailto:admin@personalcaretracker.local';

  let vapidPublicKey = envVapidPublic;
  let vapidPrivateKey = envVapidPrivate;
  const vapidSource: 'env' | 'local' = envVapidPublic && envVapidPrivate ? 'env' : 'local';

  if (vapidSource === 'local') {
    if (persisted.vapidPublicKey && persisted.vapidPrivateKey) {
      vapidPublicKey = persisted.vapidPublicKey;
      vapidPrivateKey = persisted.vapidPrivateKey;
    } else {
      const generated = webpush.generateVAPIDKeys();
      vapidPublicKey = generated.publicKey;
      vapidPrivateKey = generated.privateKey;
      persisted.vapidPublicKey = vapidPublicKey;
      persisted.vapidPrivateKey = vapidPrivateKey;
      dirty = true;
    }
  }

  if (dirty) {
    const tmpFile = `${SECRETS_FILE}.tmp.${process.pid}`;
    fs.writeFileSync(tmpFile, JSON.stringify(persisted, null, 2), 'utf-8');
    fs.renameSync(tmpFile, SECRETS_FILE);
  }

  return {
    sessionSecret,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
    vapidSource,
  };
}

function getLocalDateIso(timeZone = 'Asia/Jakarta', date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function getLocalTimeHHMM(timeZone = 'Asia/Jakarta', date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${hour === '24' ? '00' : hour}:${minute}`;
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

function normalizeUserProfile(
  raw?: Partial<UserProfile> | null,
  fallback?: { id?: string; email?: string; full_name?: string },
): UserProfile {
  const now = new Date().toISOString();
  return {
    id: raw?.id || fallback?.id || crypto.randomUUID(),
    email: raw?.email ?? fallback?.email ?? '',
    full_name: raw?.full_name?.trim() || fallback?.full_name || 'Pengguna Pribadi',
    timezone: raw?.timezone || 'Asia/Jakarta',
    skin_type: raw?.skin_type ?? null,
    hair_type: raw?.hair_type ?? null,
    reminders_enabled: raw?.reminders_enabled ?? true,
    browser_notifications_enabled: raw?.browser_notifications_enabled ?? false,
    compact_mode: raw?.compact_mode ?? false,
    created_at: raw?.created_at || now,
    updated_at: raw?.updated_at || now,
  };
}

function normalizeRoutine(r: Routine): Routine {
  return {
    ...r,
    interval_days: Number.isFinite(r.interval_days) && r.interval_days >= 1 ? r.interval_days : 2,
    interval_start_date: r.interval_start_date ?? r.created_at.slice(0, 10),
    reminder_enabled: Boolean(r.reminder_enabled),
    reminder_time: r.reminder_time ?? null,
  };
}

function createEmptyVault(): VaultData {
  return {
    users: [],
    products: [],
    product_history: [],
    routines: [],
    routine_items: [],
    routine_logs: [],
    skin_journals: [],
    hair_journals: [],
    journal_photos: [],
    push_subscriptions: [],
    push_dispatch_logs: [],
  };
}

interface RawLegacyVault extends Partial<Omit<VaultData, 'users'>> {
  ownerProfile?: Partial<UserProfile>;
  users?: Array<Partial<StoredLocalUser>>;
}

function readVault(): VaultData {
  ensureStorageDirs();
  if (!fs.existsSync(VAULT_FILE)) {
    const empty = createEmptyVault();
    writeVault(empty);
    return empty;
  }
  try {
    const raw = fs.readFileSync(VAULT_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as RawLegacyVault;

    const users: StoredLocalUser[] = (parsed.users ?? [])
      .filter((u): u is StoredLocalUser => Boolean(u && u.id && u.email && u.passwordHash))
      .map((u) => ({
        id: u.id,
        email: normalizeEmail(u.email),
        passwordHash: u.passwordHash,
        profile: normalizeUserProfile(u.profile, { id: u.id, email: normalizeEmail(u.email) }),
      }));

    const legacyOwnerProfile = parsed.legacyOwnerProfile
      ? normalizeUserProfile(parsed.legacyOwnerProfile, { id: DEFAULT_OWNER_ID })
      : parsed.ownerProfile
        ? normalizeUserProfile(parsed.ownerProfile, { id: DEFAULT_OWNER_ID })
        : undefined;

    return {
      users,
      legacyOwnerProfile,
      products: parsed.products ?? [],
      product_history: parsed.product_history ?? [],
      routines: (parsed.routines ?? []).map(normalizeRoutine),
      routine_items: parsed.routine_items ?? [],
      routine_logs: parsed.routine_logs ?? [],
      skin_journals: parsed.skin_journals ?? [],
      hair_journals: parsed.hair_journals ?? [],
      journal_photos: parsed.journal_photos ?? [],
      push_subscriptions: parsed.push_subscriptions ?? [],
      push_dispatch_logs: parsed.push_dispatch_logs ?? [],
    };
  } catch {
    return createEmptyVault();
  }
}

function writeVault(data: VaultData): void {
  ensureStorageDirs();
  const tmpFile = `${VAULT_FILE}.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, VAULT_FILE);
}

function adoptLegacyVaultRecordsIfNeeded(vault: VaultData, targetUserId: string): void {
  const legacyId = vault.legacyOwnerProfile?.id || DEFAULT_OWNER_ID;
  const hasOrphanRecords =
    vault.products.some((p) => p.user_id === legacyId) ||
    vault.routines.some((r) => r.user_id === legacyId) ||
    vault.skin_journals.some((j) => j.user_id === legacyId) ||
    vault.hair_journals.some((j) => j.user_id === legacyId) ||
    vault.journal_photos.some((p) => p.user_id === legacyId);

  if (!hasOrphanRecords) {
    delete vault.legacyOwnerProfile;
    return;
  }

  vault.products = vault.products.map((p) =>
    p.user_id === legacyId ? { ...p, user_id: targetUserId } : p,
  );
  vault.product_history = vault.product_history.map((h) =>
    h.user_id === legacyId ? { ...h, user_id: targetUserId } : h,
  );
  vault.routines = vault.routines.map((r) =>
    r.user_id === legacyId ? { ...r, user_id: targetUserId } : r,
  );
  vault.routine_items = vault.routine_items.map((i) =>
    i.user_id === legacyId ? { ...i, user_id: targetUserId } : i,
  );
  vault.routine_logs = vault.routine_logs.map((l) =>
    l.user_id === legacyId ? { ...l, user_id: targetUserId } : l,
  );
  vault.skin_journals = vault.skin_journals.map((j) =>
    j.user_id === legacyId ? { ...j, user_id: targetUserId } : j,
  );
  vault.hair_journals = vault.hair_journals.map((j) =>
    j.user_id === legacyId ? { ...j, user_id: targetUserId } : j,
  );
  vault.journal_photos = vault.journal_photos.map((p) =>
    p.user_id === legacyId ? { ...p, user_id: targetUserId } : p,
  );
  delete vault.legacyOwnerProfile;
}

async function resolveSupabaseUserProfile(
  supabase: SupabaseClient,
  authUser: AuthUser,
  fallbackFullName?: string,
): Promise<UserProfile> {
  const { data: existing, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (existing) {
    return normalizeUserProfile(existing as Partial<UserProfile>, {
      id: authUser.id,
      email: authUser.email,
      full_name: fallbackFullName,
    });
  }

  const now = new Date().toISOString();
  const initialProfile = {
    id: authUser.id,
    email: authUser.email,
    full_name: fallbackFullName?.trim() || authUser.email.split('@')[0] || 'Pengguna Pribadi',
    timezone: 'Asia/Jakarta',
    skin_type: null,
    hair_type: null,
    reminders_enabled: true,
    browser_notifications_enabled: false,
    compact_mode: false,
    created_at: now,
    updated_at: now,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert(initialProfile)
    .select()
    .single();

  if (insertErr) throw new Error(insertErr.message);
  return normalizeUserProfile(inserted as Partial<UserProfile>, {
    id: authUser.id,
    email: authUser.email,
  });
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
  });
}

function handleError(res: Response, err: unknown, fallbackMessage: string): void {
  const message = err instanceof Error ? err.message : fallbackMessage;
  res.status(500).json({ error: message || fallbackMessage });
}

async function sendWebPushToSubscriptions(
  subscriptions: StoredPushSubscription[],
  payload: Record<string, unknown>,
  onExpiredEndpoint: (endpoint: string) => Promise<void> | void,
): Promise<{ sent: number; failed: number; removedExpired: number; lastError?: string }> {
  let sent = 0;
  let failed = 0;
  let removedExpired = 0;
  let lastError: string | undefined;

  const serialized = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        serialized,
        { TTL: 60 * 60 },
      );
      sent += 1;
    } catch (err) {
      const statusCode =
        typeof err === 'object' && err !== null && 'statusCode' in err
          ? Number((err as { statusCode?: number }).statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        removedExpired += 1;
        await onExpiredEndpoint(sub.endpoint);
      } else {
        failed += 1;
        lastError = err instanceof Error ? err.message : 'Gagal mengirim Web Push';
      }
    }
  }

  return { sent, failed, removedExpired, lastError };
}

async function startServer(): Promise<void> {
  const secrets = loadOrCreateServerSecrets();
  webpush.setVapidDetails(secrets.vapidSubject, secrets.vapidPublicKey, secrets.vapidPrivateKey);

  const app = express();
  app.set('trust proxy', 1);
  const PORT = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '12mb' }));
  app.use(cookieParser());

  const getAuthenticatedUser = (req: Request): AuthUser | null => {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (typeof rawToken !== 'string' || !rawToken) return null;
    const payload = verifySessionToken(rawToken, secrets.sessionSecret);
    if (!payload) return null;
    return { id: payload.userId, email: payload.email };
  };

  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      res.status(401).json({ error: 'Sesi Anda belum aktif. Silakan masuk terlebih dahulu.' });
      return;
    }
    req.authUser = authUser;
    next();
  };

  // Health & Auth Status
  app.get('/api/health', (_req, res) => {
    const supabaseConfigured = Boolean(getSupabaseServerConfig());
    res.json({ ok: true, supabaseConfigured });
  });

  app.get('/api/status', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      const supabaseConfigured = Boolean(supabase);
      const backendMode = supabaseConfigured ? 'supabase' : 'local';
      const sessionUser = getAuthenticatedUser(req);

      if (!sessionUser) {
        res.json({
          supabaseConfigured,
          backendMode,
          authenticated: false,
          user: null,
          profile: null,
        });
        return;
      }

      if (supabase) {
        try {
          const profile = await resolveSupabaseUserProfile(supabase, sessionUser);
          res.json({
            supabaseConfigured: true,
            backendMode: 'supabase',
            authenticated: true,
            user: sessionUser,
            profile,
          });
          return;
        } catch {
          clearSessionCookie(req, res);
          res.json({
            supabaseConfigured: true,
            backendMode: 'supabase',
            authenticated: false,
            user: null,
            profile: null,
          });
          return;
        }
      }

      const vault = readVault();
      const localUser = vault.users.find((u) => u.id === sessionUser.id);
      if (!localUser) {
        clearSessionCookie(req, res);
        res.json({
          supabaseConfigured: false,
          backendMode: 'local',
          authenticated: false,
          user: null,
          profile: null,
        });
        return;
      }

      res.json({
        supabaseConfigured: false,
        backendMode: 'local',
        authenticated: true,
        user: { id: localUser.id, email: localUser.email },
        profile: localUser.profile,
      });
    } catch (err) {
      handleError(res, err, 'Tidak dapat memeriksa status sesi aplikasi.');
    }
  });

  // AUTHENTICATION ROUTES
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { full_name, email, password } = req.body as {
        full_name?: string;
        email?: string;
        password?: string;
      };

      const cleanName = (full_name ?? '').trim();
      const cleanEmail = normalizeEmail(email ?? '');
      const rawPassword = password ?? '';

      if (!cleanName) {
        res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
        return;
      }
      if (!isValidEmail(cleanEmail)) {
        res.status(400).json({ error: 'Format alamat email tidak valid.' });
        return;
      }
      if (rawPassword.length < 6) {
        res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
        return;
      }

      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: cleanEmail,
          password: rawPassword,
          email_confirm: true,
          user_metadata: { full_name: cleanName },
        });
        if (createErr || !created.user) {
          const msg = createErr?.message ?? 'Gagal mendaftarkan akun.';
          if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
            res.status(409).json({ error: 'Email ini sudah terdaftar. Silakan masuk.' });
            return;
          }
          res.status(400).json({ error: msg });
          return;
        }

        const authUser: AuthUser = { id: created.user.id, email: cleanEmail };
        const profile = await resolveSupabaseUserProfile(supabase, authUser, cleanName);
        const token = signSessionToken(
          { userId: authUser.id, email: authUser.email },
          secrets.sessionSecret,
        );
        setSessionCookie(req, res, token);
        res.status(201).json({ user: authUser, profile });
        return;
      }

      const vault = readVault();
      const duplicate = vault.users.some((u) => normalizeEmail(u.email) === cleanEmail);
      if (duplicate) {
        res.status(409).json({ error: 'Email ini sudah terdaftar. Silakan masuk.' });
        return;
      }

      const isFirstUser = vault.users.length === 0;
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      const profile = normalizeUserProfile(
        isFirstUser && vault.legacyOwnerProfile
          ? {
              ...vault.legacyOwnerProfile,
              id: userId,
              email: cleanEmail,
              full_name: cleanName,
              updated_at: now,
            }
          : null,
        { id: userId, email: cleanEmail, full_name: cleanName },
      );

      const newUser: StoredLocalUser = {
        id: userId,
        email: cleanEmail,
        passwordHash: hashPassword(rawPassword),
        profile,
      };

      vault.users.push(newUser);
      if (isFirstUser) {
        adoptLegacyVaultRecordsIfNeeded(vault, userId);
      }
      writeVault(vault);

      const token = signSessionToken(
        { userId: newUser.id, email: newUser.email },
        secrets.sessionSecret,
      );
      setSessionCookie(req, res, token);
      res.status(201).json({
        user: { id: newUser.id, email: newUser.email },
        profile: newUser.profile,
      });
    } catch (err) {
      handleError(res, err, 'Pendaftaran akun gagal.');
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      const cleanEmail = normalizeEmail(email ?? '');
      const rawPassword = password ?? '';

      if (!isValidEmail(cleanEmail) || !rawPassword) {
        res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
        return;
      }

      const supabase = getSupabaseAdmin();
      if (supabase) {
        const authClient = createEphemeralSupabaseClient()!;
        const { data, error } = await authClient.auth.signInWithPassword({
          email: cleanEmail,
          password: rawPassword,
        });
        if (error || !data.user) {
          res.status(401).json({ error: 'Email atau kata sandi salah.' });
          return;
        }
        const authUser: AuthUser = {
          id: data.user.id,
          email: normalizeEmail(data.user.email ?? cleanEmail),
        };
        const fullNameMeta =
          typeof data.user.user_metadata?.full_name === 'string'
            ? data.user.user_metadata.full_name
            : undefined;
        const profile = await resolveSupabaseUserProfile(supabase, authUser, fullNameMeta);
        const token = signSessionToken(
          { userId: authUser.id, email: authUser.email },
          secrets.sessionSecret,
        );
        setSessionCookie(req, res, token);
        res.json({ user: authUser, profile });
        return;
      }

      const vault = readVault();
      const user = vault.users.find((u) => normalizeEmail(u.email) === cleanEmail);
      if (!user || !verifyPassword(rawPassword, user.passwordHash)) {
        res.status(401).json({ error: 'Email atau kata sandi salah.' });
        return;
      }

      const token = signSessionToken(
        { userId: user.id, email: user.email },
        secrets.sessionSecret,
      );
      setSessionCookie(req, res, token);
      res.json({
        user: { id: user.id, email: user.email },
        profile: user.profile,
      });
    } catch (err) {
      handleError(res, err, 'Gagal masuk ke akun.');
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const authUser = req.authUser!;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const profile = await resolveSupabaseUserProfile(supabase, authUser);
        res.json({ user: authUser, profile });
        return;
      }
      const vault = readVault();
      const localUser = vault.users.find((u) => u.id === authUser.id);
      if (!localUser) {
        clearSessionCookie(req, res);
        res.status(401).json({ error: 'Akun tidak ditemukan. Silakan masuk kembali.' });
        return;
      }
      res.json({ user: { id: localUser.id, email: localUser.email }, profile: localUser.profile });
    } catch (err) {
      handleError(res, err, 'Gagal memuat akun aktif.');
    }
  });

  // PROFILE & PREFERENCES (Authenticated)
  app.get('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const authUser = req.authUser!;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const profile = await resolveSupabaseUserProfile(supabase, authUser);
        res.json({ profile });
        return;
      }
      const vault = readVault();
      const localUser = vault.users.find((u) => u.id === authUser.id);
      if (!localUser) {
        res.status(404).json({ error: 'Profil tidak ditemukan.' });
        return;
      }
      res.json({ profile: localUser.profile });
    } catch (err) {
      handleError(res, err, 'Gagal memuat profil.');
    }
  });

  app.patch('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const authUser = req.authUser!;
      const {
        full_name,
        timezone,
        skin_type,
        hair_type,
        reminders_enabled,
        browser_notifications_enabled,
        compact_mode,
      } = req.body as Partial<UserProfile>;

      if (full_name !== undefined && !full_name.trim()) {
        res.status(400).json({ error: 'Nama profil tidak boleh kosong.' });
        return;
      }

      const supabase = getSupabaseAdmin();
      if (supabase) {
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (full_name !== undefined) updates.full_name = full_name.trim();
        if (timezone !== undefined) updates.timezone = timezone;
        if (skin_type !== undefined) updates.skin_type = skin_type;
        if (hair_type !== undefined) updates.hair_type = hair_type;
        if (reminders_enabled !== undefined) updates.reminders_enabled = Boolean(reminders_enabled);
        if (browser_notifications_enabled !== undefined) {
          updates.browser_notifications_enabled = Boolean(browser_notifications_enabled);
        }
        if (compact_mode !== undefined) updates.compact_mode = Boolean(compact_mode);

        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', authUser.id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        res.json({ profile: normalizeUserProfile(data as Partial<UserProfile>, authUser) });
        return;
      }

      const vault = readVault();
      const userIdx = vault.users.findIndex((u) => u.id === authUser.id);
      if (userIdx === -1) {
        res.status(404).json({ error: 'Profil tidak ditemukan.' });
        return;
      }
      const current = vault.users[userIdx].profile;
      const updatedProfile: UserProfile = {
        ...current,
        full_name: full_name !== undefined ? full_name.trim() : current.full_name,
        timezone: timezone !== undefined ? timezone : current.timezone,
        skin_type: skin_type !== undefined ? skin_type : current.skin_type,
        hair_type: hair_type !== undefined ? hair_type : current.hair_type,
        reminders_enabled:
          reminders_enabled !== undefined ? Boolean(reminders_enabled) : current.reminders_enabled,
        browser_notifications_enabled:
          browser_notifications_enabled !== undefined
            ? Boolean(browser_notifications_enabled)
            : current.browser_notifications_enabled,
        compact_mode: compact_mode !== undefined ? Boolean(compact_mode) : current.compact_mode,
        updated_at: new Date().toISOString(),
      };
      vault.users[userIdx].profile = updatedProfile;
      writeVault(vault);
      res.json({ profile: updatedProfile });
    } catch (err) {
      handleError(res, err, 'Tidak dapat memperbarui profil.');
    }
  });

  // WEB PUSH (VAPID) ROUTES
  app.get('/api/push/status', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const authUser = req.authUser!;
      const supabase = getSupabaseAdmin();

      if (supabase) {
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('id, endpoint, user_agent, created_at')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);

        const rows = (data ?? []) as Array<{
          id: string;
          endpoint: string;
          user_agent: string;
          created_at: string;
        }>;
        res.json({
          vapidConfigured: true,
          vapidSource: secrets.vapidSource,
          publicKey: secrets.vapidPublicKey,
          subscriptionCount: rows.length,
          subscriptions: rows.map((row) => ({
            id: row.id,
            endpointPreview: formatEndpointPreview(row.endpoint),
            userAgent: row.user_agent,
            createdAt: row.created_at,
          })),
        });
        return;
      }

      const vault = readVault();
      const subs = vault.push_subscriptions
        .filter((s) => s.user_id === authUser.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      res.json({
        vapidConfigured: true,
        vapidSource: secrets.vapidSource,
        publicKey: secrets.vapidPublicKey,
        subscriptionCount: subs.length,
        subscriptions: subs.map((s) => ({
          id: s.id,
          endpointPreview: formatEndpointPreview(s.endpoint),
          userAgent: s.user_agent,
          createdAt: s.created_at,
        })),
      });
    } catch (err) {
      handleError(res, err, 'Gagal memuat status Web Push.');
    }
  });

  app.post('/api/push/subscribe', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const authUser = req.authUser!;
      const { subscription, userAgent } = req.body as {
        subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
        userAgent?: string;
      };

      const endpoint = subscription?.endpoint?.trim() ?? '';
      const p256dh = subscription?.keys?.p256dh?.trim() ?? '';
      const authKey = subscription?.keys?.auth?.trim() ?? '';

      if (!endpoint || !p256dh || !authKey) {
        res.status(400).json({ error: 'Data langganan Web Push (endpoint & keys) tidak lengkap.' });
        return;
      }
      if (!/^https?:\/\//i.test(endpoint)) {
        res.status(400).json({ error: 'Endpoint Web Push tidak valid.' });
        return;
      }

      const cleanUa = (userAgent || req.headers['user-agent'] || '').slice(0, 200);
      const now = new Date().toISOString();
      const supabase = getSupabaseAdmin();

      if (supabase) {
        const { data, error } = await supabase
          .from('push_subscriptions')
          .upsert(
            {
              user_id: authUser.id,
              endpoint,
              p256dh,
              auth: authKey,
              user_agent: cleanUa,
              updated_at: now,
            },
            { onConflict: 'endpoint' },
          )
          .select('id, endpoint, user_agent, created_at')
          .single();
        if (error) throw new Error(error.message);

        await supabase
          .from('profiles')
          .update({ browser_notifications_enabled: true, updated_at: now })
          .eq('id', authUser.id);

        res.status(201).json({
          subscription: {
            id: (data as { id: string }).id,
            endpointPreview: formatEndpointPreview(endpoint),
            userAgent: cleanUa,
            createdAt: (data as { created_at: string }).created_at,
          },
        });
        return;
      }

      const vault = readVault();
      const existingIdx = vault.push_subscriptions.findIndex((s) => s.endpoint === endpoint);
      let record: StoredPushSubscription;

      if (existingIdx !== -1) {
        record = {
          ...vault.push_subscriptions[existingIdx],
          user_id: authUser.id,
          p256dh,
          auth: authKey,
          user_agent: cleanUa,
          updated_at: now,
        };
        vault.push_subscriptions[existingIdx] = record;
      } else {
        record = {
          id: crypto.randomUUID(),
          user_id: authUser.id,
          endpoint,
          p256dh,
          auth: authKey,
          user_agent: cleanUa,
          created_at: now,
          updated_at: now,
        };
        vault.push_subscriptions.push(record);
      }

      const userIdx = vault.users.findIndex((u) => u.id === authUser.id);
      if (userIdx !== -1) {
        vault.users[userIdx].profile.browser_notifications_enabled = true;
        vault.users[userIdx].profile.updated_at = now;
      }
      writeVault(vault);

      res.status(201).json({
        subscription: {
          id: record.id,
          endpointPreview: formatEndpointPreview(record.endpoint),
          userAgent: record.user_agent,
          createdAt: record.created_at,
        },
      });
    } catch (err) {
      handleError(res, err, 'Gagal menyimpan langganan notifikasi push.');
    }
  });

  app.delete('/api/push/subscribe', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const authUser = req.authUser!;
      const { endpoint } = (req.body ?? {}) as { endpoint?: string };
      const supabase = getSupabaseAdmin();

      if (supabase) {
        let query = supabase.from('push_subscriptions').delete().eq('user_id', authUser.id);
        if (endpoint) {
          query = query.eq('endpoint', endpoint);
        }
        const { error } = await query;
        if (error) throw new Error(error.message);
        res.json({ ok: true });
        return;
      }

      const vault = readVault();
      vault.push_subscriptions = vault.push_subscriptions.filter((s) => {
        if (s.user_id !== authUser.id) return true;
        if (endpoint) return s.endpoint !== endpoint;
        return false;
      });
      writeVault(vault);
      res.json({ ok: true });
    } catch (err) {
      handleError(res, err, 'Gagal membatalkan langganan notifikasi push.');
    }
  });

  app.post('/api/push/test', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const authUser = req.authUser!;
      const supabase = getSupabaseAdmin();

      let userSubs: StoredPushSubscription[] = [];
      if (supabase) {
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', authUser.id);
        if (error) throw new Error(error.message);
        userSubs = (data ?? []) as StoredPushSubscription[];
      } else {
        const vault = readVault();
        userSubs = vault.push_subscriptions.filter((s) => s.user_id === authUser.id);
      }

      if (userSubs.length === 0) {
        res.status(400).json({
          error:
            'Belum ada perangkat yang terdaftar untuk Web Push. Klik "Aktifkan Notifikasi Push" terlebih dahulu.',
        });
        return;
      }

      const result = await sendWebPushToSubscriptions(
        userSubs,
        {
          title: 'Uji Notifikasi · Personal Care Tracker',
          body: 'Web Push (VAPID) aktif. Pengingat rutinitas akan dikirim langsung ke perangkat ini sesuai jadwal.',
          tag: 'pct-test-push',
          url: '/#/routine',
        },
        async (expiredEndpoint) => {
          if (supabase) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('user_id', authUser.id)
              .eq('endpoint', expiredEndpoint);
          } else {
            const v = readVault();
            v.push_subscriptions = v.push_subscriptions.filter(
              (s) => !(s.user_id === authUser.id && s.endpoint === expiredEndpoint),
            );
            writeVault(v);
          }
        },
      );

      res.json(result);
    } catch (err) {
      handleError(res, err, 'Gagal mengirim notifikasi uji Web Push.');
    }
  });

  // PRODUCTS & PRODUCT HISTORY
  app.get('/api/products', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const [prodRes, histRes] = await Promise.all([
          supabase
            .from('products')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          supabase
            .from('product_history')
            .select('*')
            .eq('user_id', userId)
            .order('effective_date', { ascending: false }),
        ]);
        if (prodRes.error) throw new Error(prodRes.error.message);
        if (histRes.error) throw new Error(histRes.error.message);
        res.json({
          products: (prodRes.data ?? []) as Product[],
          history: (histRes.data ?? []) as ProductHistoryEntry[],
        });
        return;
      }

      const vault = readVault();
      const products = vault.products
        .filter((p) => p.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const history = vault.product_history
        .filter((h) => h.user_id === userId)
        .sort(
          (a, b) =>
            b.effective_date.localeCompare(a.effective_date) ||
            b.created_at.localeCompare(a.created_at),
        );
      res.json({ products, history });
    } catch (err) {
      handleError(res, err, 'Gagal memuat daftar produk.');
    }
  });

  app.post('/api/products', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body as Partial<Product>;
      if (!body.name?.trim() || !body.category?.trim() || !body.start_date || !body.care_area) {
        res.status(400).json({ error: 'Data produk yang wajib belum lengkap.' });
        return;
      }
      if (body.end_date && body.end_date < body.start_date) {
        res.status(400).json({ error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.' });
        return;
      }

      const status: ProductStatus = body.status ?? 'active';
      const eventType: ProductEventType =
        status === 'discontinued' ? 'discontinued' : status === 'paused' ? 'paused' : 'started';
      const initialNote = `Produk ditambahkan dengan status ${PRODUCT_STATUS_ID[status]}.`;

      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: product, error } = await supabase
          .from('products')
          .insert({
            user_id: userId,
            name: body.name.trim(),
            brand: (body.brand ?? '').trim(),
            category: body.category.trim(),
            care_area: body.care_area,
            start_date: body.start_date,
            end_date: body.end_date ?? null,
            usage_frequency: (body.usage_frequency ?? 'Sekali sehari').trim(),
            status,
            notes: (body.notes ?? '').trim(),
            image_url: body.image_url ?? null,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);

        const { data: historyEntry, error: histErr } = await supabase
          .from('product_history')
          .insert({
            product_id: (product as Product).id,
            user_id: userId,
            event_type: eventType,
            previous_status: null,
            new_status: status,
            effective_date: body.start_date,
            note: initialNote,
          })
          .select()
          .single();
        if (histErr) throw new Error(histErr.message);

        res.status(201).json({ product, historyEntry });
        return;
      }

      const vault = readVault();
      const now = new Date().toISOString();
      const product: Product = {
        id: crypto.randomUUID(),
        user_id: userId,
        name: body.name.trim(),
        brand: (body.brand ?? '').trim(),
        category: body.category.trim(),
        care_area: body.care_area,
        start_date: body.start_date,
        end_date: body.end_date ?? null,
        usage_frequency: (body.usage_frequency ?? 'Sekali sehari').trim(),
        status,
        notes: (body.notes ?? '').trim(),
        image_url: body.image_url ?? null,
        created_at: now,
        updated_at: now,
      };

      const historyEntry: ProductHistoryEntry = {
        id: crypto.randomUUID(),
        product_id: product.id,
        user_id: userId,
        event_type: eventType,
        previous_status: null,
        new_status: status,
        effective_date: product.start_date,
        note: initialNote,
        created_at: now,
      };

      vault.products.push(product);
      vault.product_history.push(historyEntry);
      writeVault(vault);
      res.status(201).json({ product, historyEntry });
    } catch (err) {
      handleError(res, err, 'Gagal menyimpan produk.');
    }
  });

  app.patch('/api/products/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body as Partial<Product> & { history_note?: string };
      const supabase = getSupabaseAdmin();

      if (supabase) {
        const owner = await resolveSupabaseUserProfile(supabase, req.authUser!);
        const { data: existing, error: fetchErr } = await supabase
          .from('products')
          .select('*')
          .eq('id', req.params.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (fetchErr) throw new Error(fetchErr.message);
        if (!existing) {
          res.status(404).json({ error: 'Produk tidak ditemukan.' });
          return;
        }
        const prev = existing as Product;
        const nextStart = body.start_date ?? prev.start_date;
        const nextEnd = body.end_date !== undefined ? body.end_date : prev.end_date;
        if (nextEnd && nextEnd < nextStart) {
          res.status(400).json({ error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.' });
          return;
        }

        const nextStatus = body.status ?? prev.status;
        const dbUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (body.name !== undefined) dbUpdates.name = body.name.trim();
        if (body.brand !== undefined) dbUpdates.brand = body.brand.trim();
        if (body.category !== undefined) dbUpdates.category = body.category.trim();
        if (body.care_area !== undefined) dbUpdates.care_area = body.care_area;
        if (body.start_date !== undefined) dbUpdates.start_date = body.start_date;
        if (body.end_date !== undefined) dbUpdates.end_date = body.end_date;
        if (body.usage_frequency !== undefined) {
          dbUpdates.usage_frequency = body.usage_frequency.trim();
        }
        if (body.status !== undefined) dbUpdates.status = body.status;
        if (body.notes !== undefined) dbUpdates.notes = body.notes.trim();
        if (body.image_url !== undefined) dbUpdates.image_url = body.image_url;

        const { data: updated, error: updErr } = await supabase
          .from('products')
          .update(dbUpdates)
          .eq('id', prev.id)
          .eq('user_id', userId)
          .select()
          .single();
        if (updErr) throw new Error(updErr.message);

        if (nextStatus !== prev.status) {
          const eventType: ProductEventType =
            nextStatus === 'paused'
              ? 'paused'
              : nextStatus === 'discontinued'
                ? 'discontinued'
                : 'resumed';
          await supabase.from('product_history').insert({
            product_id: prev.id,
            user_id: userId,
            event_type: eventType,
            previous_status: prev.status,
            new_status: nextStatus,
            effective_date: getLocalDateIso(owner.timezone),
            note:
              body.history_note?.trim() ||
              `Status diubah dari ${PRODUCT_STATUS_ID[prev.status]} menjadi ${PRODUCT_STATUS_ID[nextStatus]}.`,
          });
        }

        res.json({ product: updated });
        return;
      }

      const vault = readVault();
      const user = vault.users.find((u) => u.id === userId);
      const idx = vault.products.findIndex((p) => p.id === req.params.id && p.user_id === userId);
      if (idx === -1) {
        res.status(404).json({ error: 'Produk tidak ditemukan.' });
        return;
      }
      const existing = vault.products[idx];
      const nextStart = body.start_date ?? existing.start_date;
      const nextEnd = body.end_date !== undefined ? body.end_date : existing.end_date;
      if (nextEnd && nextEnd < nextStart) {
        res.status(400).json({ error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.' });
        return;
      }

      const now = new Date().toISOString();
      const nextStatus = body.status ?? existing.status;
      const updated: Product = {
        ...existing,
        name: body.name !== undefined ? body.name.trim() : existing.name,
        brand: body.brand !== undefined ? body.brand.trim() : existing.brand,
        category: body.category !== undefined ? body.category.trim() : existing.category,
        care_area: body.care_area ?? existing.care_area,
        start_date: nextStart,
        end_date: nextEnd,
        usage_frequency:
          body.usage_frequency !== undefined
            ? body.usage_frequency.trim()
            : existing.usage_frequency,
        status: nextStatus,
        notes: body.notes !== undefined ? body.notes.trim() : existing.notes,
        image_url: body.image_url !== undefined ? body.image_url : existing.image_url,
        updated_at: now,
      };

      vault.products[idx] = updated;

      if (nextStatus !== existing.status) {
        let eventType: ProductEventType = 'updated';
        if (nextStatus === 'paused') eventType = 'paused';
        else if (nextStatus === 'discontinued') eventType = 'discontinued';
        else if (nextStatus === 'active') eventType = 'resumed';

        vault.product_history.push({
          id: crypto.randomUUID(),
          product_id: updated.id,
          user_id: userId,
          event_type: eventType,
          previous_status: existing.status,
          new_status: nextStatus,
          effective_date: getLocalDateIso(user?.profile.timezone || 'Asia/Jakarta'),
          note:
            body.history_note?.trim() ||
            `Status diubah dari ${PRODUCT_STATUS_ID[existing.status]} menjadi ${PRODUCT_STATUS_ID[nextStatus]}.`,
          created_at: now,
        });
      }

      writeVault(vault);
      res.json({ product: updated });
    } catch (err) {
      handleError(res, err, 'Gagal memperbarui produk.');
    }
  });

  app.delete('/api/products/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', req.params.id)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
        res.json({ ok: true });
        return;
      }

      const vault = readVault();
      const exists = vault.products.some((p) => p.id === req.params.id && p.user_id === userId);
      if (!exists) {
        res.status(404).json({ error: 'Produk tidak ditemukan.' });
        return;
      }
      vault.products = vault.products.filter(
        (p) => !(p.id === req.params.id && p.user_id === userId),
      );
      vault.product_history = vault.product_history.filter(
        (h) => !(h.product_id === req.params.id && h.user_id === userId),
      );
      vault.routine_items = vault.routine_items.map((item) =>
        item.product_id === req.params.id && item.user_id === userId
          ? { ...item, product_id: null }
          : item,
      );
      writeVault(vault);
      res.json({ ok: true });
    } catch (err) {
      handleError(res, err, 'Gagal menghapus produk.');
    }
  });

  // ROUTINES & LOGS
  app.get('/api/routines', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const [rRes, iRes, lRes] = await Promise.all([
          supabase
            .from('routines')
            .select('*')
            .eq('user_id', userId)
            .order('scheduled_time', { ascending: true }),
          supabase
            .from('routine_items')
            .select('*')
            .eq('user_id', userId)
            .order('step_order', { ascending: true }),
          supabase
            .from('routine_logs')
            .select('*')
            .eq('user_id', userId)
            .order('log_date', { ascending: false }),
        ]);
        if (rRes.error) throw new Error(rRes.error.message);
        if (iRes.error) throw new Error(iRes.error.message);
        if (lRes.error) throw new Error(lRes.error.message);

        const items = (iRes.data ?? []) as RoutineItem[];
        const routines = ((rRes.data ?? []) as Routine[]).map((r) =>
          normalizeRoutine({
            ...r,
            items: items.filter((item) => item.routine_id === r.id),
          }),
        );

        res.json({
          routines,
          logs: (lRes.data ?? []) as RoutineLog[],
        });
        return;
      }

      const vault = readVault();
      const itemsByRoutine = new Map<string, RoutineItem[]>();
      for (const item of vault.routine_items) {
        if (item.user_id !== userId) continue;
        const list = itemsByRoutine.get(item.routine_id) ?? [];
        list.push(item);
        itemsByRoutine.set(item.routine_id, list);
      }

      const routines = vault.routines
        .filter((r) => r.user_id === userId)
        .map((r) =>
          normalizeRoutine({
            ...r,
            items: (itemsByRoutine.get(r.id) ?? []).sort((a, b) => a.step_order - b.step_order),
          }),
        )
        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

      const logs = vault.routine_logs
        .filter((l) => l.user_id === userId)
        .sort(
          (a, b) => b.log_date.localeCompare(a.log_date) || b.created_at.localeCompare(a.created_at),
        );

      res.json({ routines, logs });
    } catch (err) {
      handleError(res, err, 'Gagal memuat rutinitas.');
    }
  });

  app.post('/api/routines', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body as Partial<Routine> & {
        items?: Array<{ product_id: string | null; title: string; instructions: string }>;
      };
      if (!body.name?.trim() || !body.care_area || !body.routine_type || !body.scheduled_time) {
        res.status(400).json({ error: 'Data rutinitas yang wajib belum lengkap.' });
        return;
      }

      const intervalDays =
        body.interval_days && Number(body.interval_days) >= 1 ? Number(body.interval_days) : 2;
      const supabase = getSupabaseAdmin();

      if (supabase) {
        const owner = await resolveSupabaseUserProfile(supabase, req.authUser!);
        const { data: routine, error } = await supabase
          .from('routines')
          .insert({
            user_id: userId,
            name: body.name.trim(),
            care_area: body.care_area,
            routine_type: body.routine_type,
            frequency_type: body.frequency_type ?? 'weekly',
            days_of_week: body.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
            interval_days: intervalDays,
            interval_start_date: body.interval_start_date ?? getLocalDateIso(owner.timezone),
            scheduled_time: body.scheduled_time,
            is_enabled: body.is_enabled ?? true,
            reminder_enabled: Boolean(body.reminder_enabled),
            reminder_time: body.reminder_enabled
              ? body.reminder_time || body.scheduled_time
              : body.reminder_time ?? null,
            notes: (body.notes ?? '').trim(),
          })
          .select()
          .single();
        if (error) throw new Error(error.message);

        const itemRows = (body.items ?? []).map((item, idx) => ({
          routine_id: (routine as Routine).id,
          user_id: userId,
          product_id: item.product_id || null,
          step_order: idx + 1,
          title: item.title.trim(),
          instructions: (item.instructions ?? '').trim(),
        }));
        const { data: savedItems, error: itemErr } = await supabase
          .from('routine_items')
          .insert(itemRows)
          .select();
        if (itemErr) throw new Error(itemErr.message);

        res.status(201).json({
          routine: normalizeRoutine({ ...(routine as Routine), items: savedItems as RoutineItem[] }),
        });
        return;
      }

      const vault = readVault();
      const user = vault.users.find((u) => u.id === userId);
      const now = new Date().toISOString();
      const routineId = crypto.randomUUID();
      const routine = normalizeRoutine({
        id: routineId,
        user_id: userId,
        name: body.name.trim(),
        care_area: body.care_area,
        routine_type: body.routine_type,
        frequency_type: body.frequency_type ?? 'weekly',
        days_of_week: body.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
        interval_days: intervalDays,
        interval_start_date:
          body.interval_start_date ?? getLocalDateIso(user?.profile.timezone || 'Asia/Jakarta'),
        scheduled_time: body.scheduled_time,
        is_enabled: body.is_enabled ?? true,
        reminder_enabled: Boolean(body.reminder_enabled),
        reminder_time: body.reminder_enabled
          ? body.reminder_time || body.scheduled_time
          : body.reminder_time ?? null,
        notes: (body.notes ?? '').trim(),
        created_at: now,
        updated_at: now,
      });

      const createdItems: RoutineItem[] = (body.items ?? []).map((item, idx) => ({
        id: crypto.randomUUID(),
        routine_id: routineId,
        user_id: userId,
        product_id: item.product_id || null,
        step_order: idx + 1,
        title: item.title.trim(),
        instructions: (item.instructions ?? '').trim(),
        created_at: now,
      }));

      vault.routines.push(routine);
      vault.routine_items.push(...createdItems);
      writeVault(vault);
      res.status(201).json({ routine: { ...routine, items: createdItems } });
    } catch (err) {
      handleError(res, err, 'Gagal membuat rutinitas.');
    }
  });

  app.patch('/api/routines/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body as Partial<Routine> & {
        items?: Array<{ product_id: string | null; title: string; instructions: string }>;
      };
      const supabase = getSupabaseAdmin();

      if (supabase) {
        const { items, ...fields } = body;
        const dbUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (fields.name !== undefined) dbUpdates.name = fields.name.trim();
        if (fields.care_area !== undefined) dbUpdates.care_area = fields.care_area;
        if (fields.routine_type !== undefined) dbUpdates.routine_type = fields.routine_type;
        if (fields.frequency_type !== undefined) dbUpdates.frequency_type = fields.frequency_type;
        if (fields.days_of_week !== undefined) dbUpdates.days_of_week = fields.days_of_week;
        if (fields.interval_days !== undefined) dbUpdates.interval_days = fields.interval_days;
        if (fields.interval_start_date !== undefined) {
          dbUpdates.interval_start_date = fields.interval_start_date;
        }
        if (fields.scheduled_time !== undefined) dbUpdates.scheduled_time = fields.scheduled_time;
        if (fields.is_enabled !== undefined) dbUpdates.is_enabled = fields.is_enabled;
        if (fields.reminder_enabled !== undefined) {
          dbUpdates.reminder_enabled = Boolean(fields.reminder_enabled);
        }
        if (fields.reminder_time !== undefined) dbUpdates.reminder_time = fields.reminder_time;
        if (fields.notes !== undefined) dbUpdates.notes = fields.notes.trim();

        const { data: updated, error } = await supabase
          .from('routines')
          .update(dbUpdates)
          .eq('id', req.params.id)
          .eq('user_id', userId)
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!updated) {
          res.status(404).json({ error: 'Rutinitas tidak ditemukan.' });
          return;
        }

        if (items !== undefined) {
          await supabase.from('routine_items').delete().eq('routine_id', req.params.id);
          if (items.length > 0) {
            await supabase.from('routine_items').insert(
              items.map((item, orderIdx) => ({
                routine_id: req.params.id,
                user_id: userId,
                product_id: item.product_id || null,
                step_order: orderIdx + 1,
                title: item.title.trim(),
                instructions: (item.instructions ?? '').trim(),
              })),
            );
          }
        }

        const { data: savedItems } = await supabase
          .from('routine_items')
          .select('*')
          .eq('routine_id', req.params.id)
          .order('step_order', { ascending: true });

        res.json({
          routine: normalizeRoutine({
            ...(updated as Routine),
            items: (savedItems ?? []) as RoutineItem[],
          }),
        });
        return;
      }

      const vault = readVault();
      const idx = vault.routines.findIndex((r) => r.id === req.params.id && r.user_id === userId);
      if (idx === -1) {
        res.status(404).json({ error: 'Rutinitas tidak ditemukan.' });
        return;
      }

      const existing = vault.routines[idx];
      const now = new Date().toISOString();

      const updated = normalizeRoutine({
        ...existing,
        name: body.name !== undefined ? body.name.trim() : existing.name,
        care_area: body.care_area ?? existing.care_area,
        routine_type: body.routine_type ?? existing.routine_type,
        frequency_type: body.frequency_type ?? existing.frequency_type,
        days_of_week: body.days_of_week ?? existing.days_of_week,
        interval_days:
          body.interval_days !== undefined ? Number(body.interval_days) : existing.interval_days,
        interval_start_date:
          body.interval_start_date !== undefined
            ? body.interval_start_date
            : existing.interval_start_date,
        scheduled_time: body.scheduled_time ?? existing.scheduled_time,
        is_enabled: body.is_enabled ?? existing.is_enabled,
        reminder_enabled:
          body.reminder_enabled !== undefined
            ? Boolean(body.reminder_enabled)
            : existing.reminder_enabled,
        reminder_time:
          body.reminder_time !== undefined ? body.reminder_time : existing.reminder_time,
        notes: body.notes !== undefined ? body.notes.trim() : existing.notes,
        updated_at: now,
      });

      vault.routines[idx] = updated;

      if (body.items !== undefined) {
        vault.routine_items = vault.routine_items.filter(
          (i) => !(i.routine_id === existing.id && i.user_id === userId),
        );
        const nextItems: RoutineItem[] = body.items.map((item, orderIdx) => ({
          id: crypto.randomUUID(),
          routine_id: existing.id,
          user_id: userId,
          product_id: item.product_id || null,
          step_order: orderIdx + 1,
          title: item.title.trim(),
          instructions: (item.instructions ?? '').trim(),
          created_at: now,
        }));
        vault.routine_items.push(...nextItems);
      }

      writeVault(vault);
      const items = vault.routine_items
        .filter((i) => i.routine_id === existing.id && i.user_id === userId)
        .sort((a, b) => a.step_order - b.step_order);

      res.json({ routine: { ...updated, items } });
    } catch (err) {
      handleError(res, err, 'Gagal memperbarui rutinitas.');
    }
  });

  app.delete('/api/routines/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase
          .from('routines')
          .delete()
          .eq('id', req.params.id)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
        res.json({ ok: true });
        return;
      }

      const vault = readVault();
      const exists = vault.routines.some((r) => r.id === req.params.id && r.user_id === userId);
      if (!exists) {
        res.status(404).json({ error: 'Rutinitas tidak ditemukan.' });
        return;
      }
      vault.routines = vault.routines.filter(
        (r) => !(r.id === req.params.id && r.user_id === userId),
      );
      vault.routine_items = vault.routine_items.filter(
        (i) => !(i.routine_id === req.params.id && i.user_id === userId),
      );
      vault.routine_logs = vault.routine_logs.filter(
        (l) => !(l.routine_id === req.params.id && l.user_id === userId),
      );
      writeVault(vault);
      res.json({ ok: true });
    } catch (err) {
      handleError(res, err, 'Gagal menghapus rutinitas.');
    }
  });

  app.post('/api/routine-logs', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const { routine_id, routine_item_id, log_date, status, note } =
        req.body as Partial<RoutineLog>;
      if (!routine_id || !log_date || !status) {
        res.status(400).json({ error: 'ID rutinitas, tanggal catatan, dan status wajib diisi.' });
        return;
      }
      const itemId = routine_item_id ?? null;
      const now = new Date().toISOString();

      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: ownsRoutine } = await supabase
          .from('routines')
          .select('id')
          .eq('id', routine_id)
          .eq('user_id', userId)
          .maybeSingle();
        if (!ownsRoutine) {
          res.status(404).json({ error: 'Rutinitas tidak ditemukan.' });
          return;
        }

        let delQuery = supabase
          .from('routine_logs')
          .delete()
          .eq('user_id', userId)
          .eq('routine_id', routine_id)
          .eq('log_date', log_date);
        delQuery = itemId
          ? delQuery.eq('routine_item_id', itemId)
          : delQuery.is('routine_item_id', null);
        await delQuery;

        const { data: log, error } = await supabase
          .from('routine_logs')
          .insert({
            routine_id,
            routine_item_id: itemId,
            user_id: userId,
            log_date,
            status,
            completed_at: status === 'completed' ? now : null,
            note: (note ?? '').trim(),
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        res.status(201).json({ log });
        return;
      }

      const vault = readVault();
      const ownsRoutine = vault.routines.some((r) => r.id === routine_id && r.user_id === userId);
      if (!ownsRoutine) {
        res.status(404).json({ error: 'Rutinitas tidak ditemukan.' });
        return;
      }

      vault.routine_logs = vault.routine_logs.filter(
        (l) =>
          !(
            l.user_id === userId &&
            l.routine_id === routine_id &&
            l.routine_item_id === itemId &&
            l.log_date === log_date
          ),
      );

      const log: RoutineLog = {
        id: crypto.randomUUID(),
        routine_id,
        routine_item_id: itemId,
        user_id: userId,
        log_date,
        status,
        completed_at: status === 'completed' ? now : null,
        note: (note ?? '').trim(),
        created_at: now,
      };

      vault.routine_logs.push(log);
      writeVault(vault);
      res.status(201).json({ log });
    } catch (err) {
      handleError(res, err, 'Gagal mencatat aktivitas rutinitas.');
    }
  });

  // SKIN & HAIR JOURNALS
  app.get('/api/journals', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const [skinRes, hairRes, photoRes] = await Promise.all([
          supabase
            .from('skin_journals')
            .select('*')
            .eq('user_id', userId)
            .order('entry_date', { ascending: false }),
          supabase
            .from('hair_journals')
            .select('*')
            .eq('user_id', userId)
            .order('entry_date', { ascending: false }),
          supabase
            .from('journal_photos')
            .select('*')
            .eq('user_id', userId)
            .order('entry_date', { ascending: false }),
        ]);
        if (skinRes.error) throw new Error(skinRes.error.message);
        if (hairRes.error) throw new Error(hairRes.error.message);
        if (photoRes.error) throw new Error(photoRes.error.message);

        const photos = ((photoRes.data ?? []) as JournalPhoto[]).map((p) => ({
          ...p,
          signed_url: `/api/photos/${p.id}/file`,
        }));
        res.json({
          skin: (skinRes.data ?? []) as SkinJournal[],
          hair: (hairRes.data ?? []) as HairJournal[],
          photos,
        });
        return;
      }

      const vault = readVault();
      const skin = vault.skin_journals
        .filter((j) => j.user_id === userId)
        .sort(
          (a, b) =>
            b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at),
        );
      const hair = vault.hair_journals
        .filter((j) => j.user_id === userId)
        .sort(
          (a, b) =>
            b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at),
        );
      const photos = vault.journal_photos
        .filter((p) => p.user_id === userId)
        .sort(
          (a, b) =>
            b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at),
        )
        .map((p) => ({
          ...p,
          signed_url: `/api/photos/${p.id}/file`,
        }));
      res.json({ skin, hair, photos });
    } catch (err) {
      handleError(res, err, 'Gagal memuat catatan harian.');
    }
  });

  app.post('/api/journals/skin', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body as Partial<SkinJournal>;
      if (
        !body.entry_date ||
        body.acne_severity === undefined ||
        !body.acne_type ||
        !body.oiliness ||
        !body.irritation
      ) {
        res.status(400).json({ error: 'Data catatan wajah yang wajib belum lengkap.' });
        return;
      }

      const clampedSeverity = Math.max(0, Math.min(10, Number(body.acne_severity)));
      const supabase = getSupabaseAdmin();

      if (supabase) {
        const { data: entry, error } = await supabase
          .from('skin_journals')
          .insert({
            user_id: userId,
            entry_date: body.entry_date,
            acne_severity: clampedSeverity,
            acne_type: body.acne_type,
            acne_locations: body.acne_locations ?? [],
            oiliness: body.oiliness,
            irritation: body.irritation,
            redness: body.redness ?? 'none',
            dryness_peeling: body.dryness_peeling ?? 'none',
            context_factors: body.context_factors ?? [],
            notes: (body.notes ?? '').trim(),
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        res.status(201).json({ entry });
        return;
      }

      const vault = readVault();
      const now = new Date().toISOString();
      const entry: SkinJournal = {
        id: crypto.randomUUID(),
        user_id: userId,
        entry_date: body.entry_date,
        acne_severity: clampedSeverity,
        acne_type: body.acne_type,
        acne_locations: body.acne_locations ?? [],
        oiliness: body.oiliness,
        irritation: body.irritation,
        redness: body.redness ?? 'none',
        dryness_peeling: body.dryness_peeling ?? 'none',
        context_factors: body.context_factors ?? [],
        notes: (body.notes ?? '').trim(),
        created_at: now,
        updated_at: now,
      };
      vault.skin_journals.push(entry);
      writeVault(vault);
      res.status(201).json({ entry });
    } catch (err) {
      handleError(res, err, 'Gagal menyimpan catatan wajah.');
    }
  });

  app.patch('/api/journals/skin/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body as Partial<SkinJournal>;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (body.entry_date !== undefined) updates.entry_date = body.entry_date;
        if (body.acne_severity !== undefined) {
          updates.acne_severity = Math.max(0, Math.min(10, Number(body.acne_severity)));
        }
        if (body.acne_type !== undefined) updates.acne_type = body.acne_type;
        if (body.acne_locations !== undefined) updates.acne_locations = body.acne_locations;
        if (body.oiliness !== undefined) updates.oiliness = body.oiliness;
        if (body.irritation !== undefined) updates.irritation = body.irritation;
        if (body.redness !== undefined) updates.redness = body.redness;
        if (body.dryness_peeling !== undefined) updates.dryness_peeling = body.dryness_peeling;
        if (body.context_factors !== undefined) updates.context_factors = body.context_factors;
        if (body.notes !== undefined) updates.notes = body.notes.trim();

        const { data: entry, error } = await supabase
          .from('skin_journals')
          .update(updates)
          .eq('id', req.params.id)
          .eq('user_id', userId)
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!entry) {
          res.status(404).json({ error: 'Catatan wajah tidak ditemukan.' });
          return;
        }
        res.json({ entry });
        return;
      }

      const vault = readVault();
      const idx = vault.skin_journals.findIndex(
        (j) => j.id === req.params.id && j.user_id === userId,
      );
      if (idx === -1) {
        res.status(404).json({ error: 'Catatan wajah tidak ditemukan.' });
        return;
      }
      const prev = vault.skin_journals[idx];
      const updated: SkinJournal = {
        ...prev,
        entry_date: body.entry_date ?? prev.entry_date,
        acne_severity:
          body.acne_severity !== undefined
            ? Math.max(0, Math.min(10, Number(body.acne_severity)))
            : prev.acne_severity,
        acne_type: body.acne_type ?? prev.acne_type,
        acne_locations: body.acne_locations ?? prev.acne_locations,
        oiliness: body.oiliness ?? prev.oiliness,
        irritation: body.irritation ?? prev.irritation,
        redness: body.redness ?? prev.redness,
        dryness_peeling: body.dryness_peeling ?? prev.dryness_peeling,
        context_factors: body.context_factors ?? prev.context_factors,
        notes: body.notes !== undefined ? body.notes.trim() : prev.notes,
        updated_at: new Date().toISOString(),
      };
      vault.skin_journals[idx] = updated;
      writeVault(vault);
      res.json({ entry: updated });
    } catch (err) {
      handleError(res, err, 'Gagal memperbarui catatan wajah.');
    }
  });

  app.delete('/api/journals/skin/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase
          .from('skin_journals')
          .delete()
          .eq('id', req.params.id)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
        res.json({ ok: true });
        return;
      }

      const vault = readVault();
      vault.skin_journals = vault.skin_journals.filter(
        (j) => !(j.id === req.params.id && j.user_id === userId),
      );
      writeVault(vault);
      res.json({ ok: true });
    } catch (err) {
      handleError(res, err, 'Gagal menghapus catatan wajah.');
    }
  });

  app.post('/api/journals/hair', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body as Partial<HairJournal>;
      if (
        !body.entry_date ||
        !body.scalp_condition ||
        !body.hair_oiliness ||
        !body.dandruff ||
        !body.scalp_itching ||
        !body.shedding_level ||
        !body.general_condition
      ) {
        res.status(400).json({ error: 'Data catatan rambut yang wajib belum lengkap.' });
        return;
      }

      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: entry, error } = await supabase
          .from('hair_journals')
          .insert({
            user_id: userId,
            entry_date: body.entry_date,
            scalp_condition: body.scalp_condition,
            hair_oiliness: body.hair_oiliness,
            dandruff: body.dandruff,
            scalp_itching: body.scalp_itching,
            shedding_level: body.shedding_level,
            general_condition: body.general_condition,
            washed_hair: Boolean(body.washed_hair),
            context_factors: body.context_factors ?? [],
            notes: (body.notes ?? '').trim(),
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        res.status(201).json({ entry });
        return;
      }

      const vault = readVault();
      const now = new Date().toISOString();
      const entry: HairJournal = {
        id: crypto.randomUUID(),
        user_id: userId,
        entry_date: body.entry_date,
        scalp_condition: body.scalp_condition,
        hair_oiliness: body.hair_oiliness,
        dandruff: body.dandruff,
        scalp_itching: body.scalp_itching,
        shedding_level: body.shedding_level,
        general_condition: body.general_condition,
        washed_hair: Boolean(body.washed_hair),
        context_factors: body.context_factors ?? [],
        notes: (body.notes ?? '').trim(),
        created_at: now,
        updated_at: now,
      };
      vault.hair_journals.push(entry);
      writeVault(vault);
      res.status(201).json({ entry });
    } catch (err) {
      handleError(res, err, 'Gagal menyimpan catatan rambut.');
    }
  });

  app.patch('/api/journals/hair/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body as Partial<HairJournal>;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (body.entry_date !== undefined) updates.entry_date = body.entry_date;
        if (body.scalp_condition !== undefined) updates.scalp_condition = body.scalp_condition;
        if (body.hair_oiliness !== undefined) updates.hair_oiliness = body.hair_oiliness;
        if (body.dandruff !== undefined) updates.dandruff = body.dandruff;
        if (body.scalp_itching !== undefined) updates.scalp_itching = body.scalp_itching;
        if (body.shedding_level !== undefined) updates.shedding_level = body.shedding_level;
        if (body.general_condition !== undefined) updates.general_condition = body.general_condition;
        if (body.washed_hair !== undefined) updates.washed_hair = Boolean(body.washed_hair);
        if (body.context_factors !== undefined) updates.context_factors = body.context_factors;
        if (body.notes !== undefined) updates.notes = body.notes.trim();

        const { data: entry, error } = await supabase
          .from('hair_journals')
          .update(updates)
          .eq('id', req.params.id)
          .eq('user_id', userId)
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!entry) {
          res.status(404).json({ error: 'Catatan rambut tidak ditemukan.' });
          return;
        }
        res.json({ entry });
        return;
      }

      const vault = readVault();
      const idx = vault.hair_journals.findIndex(
        (j) => j.id === req.params.id && j.user_id === userId,
      );
      if (idx === -1) {
        res.status(404).json({ error: 'Catatan rambut tidak ditemukan.' });
        return;
      }
      const prev = vault.hair_journals[idx];
      const updated: HairJournal = {
        ...prev,
        entry_date: body.entry_date ?? prev.entry_date,
        scalp_condition: body.scalp_condition ?? prev.scalp_condition,
        hair_oiliness: body.hair_oiliness ?? prev.hair_oiliness,
        dandruff: body.dandruff ?? prev.dandruff,
        scalp_itching: body.scalp_itching ?? prev.scalp_itching,
        shedding_level: body.shedding_level ?? prev.shedding_level,
        general_condition: body.general_condition ?? prev.general_condition,
        washed_hair: body.washed_hair !== undefined ? Boolean(body.washed_hair) : prev.washed_hair,
        context_factors: body.context_factors ?? prev.context_factors,
        notes: body.notes !== undefined ? body.notes.trim() : prev.notes,
        updated_at: new Date().toISOString(),
      };
      vault.hair_journals[idx] = updated;
      writeVault(vault);
      res.json({ entry: updated });
    } catch (err) {
      handleError(res, err, 'Gagal memperbarui catatan rambut.');
    }
  });

  app.delete('/api/journals/hair/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase
          .from('hair_journals')
          .delete()
          .eq('id', req.params.id)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
        res.json({ ok: true });
        return;
      }

      const vault = readVault();
      vault.hair_journals = vault.hair_journals.filter(
        (j) => !(j.id === req.params.id && j.user_id === userId),
      );
      writeVault(vault);
      res.json({ ok: true });
    } catch (err) {
      handleError(res, err, 'Gagal menghapus catatan rambut.');
    }
  });

  // PRIVATE JOURNAL PHOTOS (Authenticated & scoped per user)
  app.post('/api/photos', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const { journal_type, skin_journal_id, hair_journal_id, entry_date, caption, data_url } =
        req.body as {
          journal_type?: 'face' | 'hair';
          skin_journal_id?: string | null;
          hair_journal_id?: string | null;
          entry_date?: string;
          caption?: string;
          data_url?: string;
        };

      if (!journal_type || !entry_date || !data_url) {
        res.status(400).json({ error: 'Jenis catatan, tanggal, dan data foto wajib diisi.' });
        return;
      }

      const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data_url);
      if (!match) {
        res.status(400).json({
          error: 'Format gambar tidak didukung. Silakan unggah PNG, JPEG, atau WebP.',
        });
        return;
      }

      const mimeType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 8 * 1024 * 1024) {
        res.status(400).json({ error: 'Ukuran gambar maksimal 8 MB.' });
        return;
      }

      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const photoId = crypto.randomUUID();
      const supabase = getSupabaseAdmin();

      if (supabase) {
        const storagePath = `${userId}/${journal_type}/${photoId}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('journal-photos')
          .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
        if (uploadError) throw new Error(uploadError.message);

        const { data: photo, error: insertError } = await supabase
          .from('journal_photos')
          .insert({
            id: photoId,
            user_id: userId,
            journal_type,
            skin_journal_id: skin_journal_id ?? null,
            hair_journal_id: hair_journal_id ?? null,
            entry_date,
            storage_path: storagePath,
            caption: (caption ?? '').trim(),
            mime_type: mimeType,
            size_bytes: buffer.length,
          })
          .select()
          .single();
        if (insertError) throw new Error(insertError.message);

        res.status(201).json({
          photo: {
            ...(photo as JournalPhoto),
            signed_url: `/api/photos/${(photo as JournalPhoto).id}/file`,
          },
        });
        return;
      }

      const vault = readVault();
      ensureStorageDirs();
      const fileName = `${userId}_${photoId}.${ext}`;
      fs.writeFileSync(path.join(PHOTOS_DIR, fileName), buffer);

      const photo: JournalPhoto = {
        id: photoId,
        user_id: userId,
        journal_type,
        skin_journal_id: skin_journal_id ?? null,
        hair_journal_id: hair_journal_id ?? null,
        entry_date,
        storage_path: fileName,
        caption: (caption ?? '').trim(),
        mime_type: mimeType,
        size_bytes: buffer.length,
        created_at: new Date().toISOString(),
      };
      vault.journal_photos.push(photo);
      writeVault(vault);

      res.status(201).json({
        photo: {
          ...photo,
          signed_url: `/api/photos/${photo.id}/file`,
        },
      });
    } catch (err) {
      handleError(res, err, 'Gagal mengunggah foto.');
    }
  });

  app.get('/api/photos/:id/file', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: photo, error } = await supabase
          .from('journal_photos')
          .select('*')
          .eq('id', req.params.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!photo) {
          res.status(404).json({ error: 'Foto tidak ditemukan.' });
          return;
        }
        const record = photo as JournalPhoto;
        const { data: fileBlob, error: dlErr } = await supabase.storage
          .from('journal-photos')
          .download(record.storage_path);
        if (dlErr || !fileBlob) {
          res.status(404).json({ error: 'File foto tidak ditemukan.' });
          return;
        }
        const arrayBuf = await fileBlob.arrayBuffer();
        res.setHeader('Content-Type', record.mime_type);
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(Buffer.from(arrayBuf));
        return;
      }

      const vault = readVault();
      const photo = vault.journal_photos.find(
        (p) => p.id === req.params.id && p.user_id === userId,
      );
      if (!photo) {
        res.status(404).json({ error: 'Foto tidak ditemukan.' });
        return;
      }
      const safeName = path.basename(photo.storage_path);
      const fullPath = path.join(PHOTOS_DIR, safeName);
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'File foto tidak ditemukan.' });
        return;
      }
      res.setHeader('Content-Type', photo.mime_type);
      res.setHeader('Cache-Control', 'private, no-store');
      res.sendFile(fullPath);
    } catch (err) {
      handleError(res, err, 'Gagal memuat file foto.');
    }
  });

  app.delete('/api/photos/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: photo, error } = await supabase
          .from('journal_photos')
          .select('*')
          .eq('id', req.params.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!photo) {
          res.status(404).json({ error: 'Foto tidak ditemukan.' });
          return;
        }
        const record = photo as JournalPhoto;
        await supabase.storage.from('journal-photos').remove([record.storage_path]);
        const { error: delErr } = await supabase
          .from('journal_photos')
          .delete()
          .eq('id', record.id)
          .eq('user_id', userId);
        if (delErr) throw new Error(delErr.message);
        res.json({ ok: true });
        return;
      }

      const vault = readVault();
      const photo = vault.journal_photos.find(
        (p) => p.id === req.params.id && p.user_id === userId,
      );
      if (!photo) {
        res.status(404).json({ error: 'Foto tidak ditemukan.' });
        return;
      }
      const safeName = path.basename(photo.storage_path);
      const fullPath = path.join(PHOTOS_DIR, safeName);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      vault.journal_photos = vault.journal_photos.filter(
        (p) => !(p.id === req.params.id && p.user_id === userId),
      );
      writeVault(vault);
      res.json({ ok: true });
    } catch (err) {
      handleError(res, err, 'Gagal menghapus foto.');
    }
  });

  // DATA EXPORT
  app.get('/api/export', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const owner = await resolveSupabaseUserProfile(supabase, req.authUser!);
        const [prod, hist, rout, items, logs, skin, hair, photos] = await Promise.all([
          supabase.from('products').select('*').eq('user_id', userId),
          supabase.from('product_history').select('*').eq('user_id', userId),
          supabase.from('routines').select('*').eq('user_id', userId),
          supabase.from('routine_items').select('*').eq('user_id', userId),
          supabase.from('routine_logs').select('*').eq('user_id', userId),
          supabase.from('skin_journals').select('*').eq('user_id', userId),
          supabase.from('hair_journals').select('*').eq('user_id', userId),
          supabase.from('journal_photos').select('*').eq('user_id', userId),
        ]);
        res.json({
          exportedAt: new Date().toISOString(),
          profile: owner,
          products: prod.data ?? [],
          product_history: hist.data ?? [],
          routines: rout.data ?? [],
          routine_items: items.data ?? [],
          routine_logs: logs.data ?? [],
          skin_journals: skin.data ?? [],
          hair_journals: hair.data ?? [],
          journal_photos: photos.data ?? [],
        });
        return;
      }

      const vault = readVault();
      const user = vault.users.find((u) => u.id === userId);
      res.json({
        exportedAt: new Date().toISOString(),
        profile: user?.profile ?? null,
        products: vault.products.filter((p) => p.user_id === userId),
        product_history: vault.product_history.filter((h) => h.user_id === userId),
        routines: vault.routines.filter((r) => r.user_id === userId),
        routine_items: vault.routine_items.filter((i) => i.user_id === userId),
        routine_logs: vault.routine_logs.filter((l) => l.user_id === userId),
        skin_journals: vault.skin_journals.filter((j) => j.user_id === userId),
        hair_journals: vault.hair_journals.filter((j) => j.user_id === userId),
        journal_photos: vault.journal_photos.filter((p) => p.user_id === userId),
      });
    } catch (err) {
      handleError(res, err, 'Gagal mengekspor data.');
    }
  });

  // Catch unknown /api/* routes cleanly with JSON 404
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  // Background Web Push (VAPID) Routine Reminder Scheduler
  let schedulerRunning = false;
  const runScheduledPushDispatch = async (): Promise<void> => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      const now = new Date();
      const supabase = getSupabaseAdmin();

      if (supabase) {
        const { data: subsData, error: subsErr } = await supabase
          .from('push_subscriptions')
          .select('*');
        if (subsErr || !subsData || subsData.length === 0) return;

        const subsByUser = new Map<string, StoredPushSubscription[]>();
        for (const sub of subsData as StoredPushSubscription[]) {
          const list = subsByUser.get(sub.user_id) ?? [];
          list.push(sub);
          subsByUser.set(sub.user_id, list);
        }

        const userIds = Array.from(subsByUser.keys());
        const [profRes, routRes, logRes, dispRes] = await Promise.all([
          supabase.from('profiles').select('*').in('id', userIds),
          supabase
            .from('routines')
            .select('*')
            .in('user_id', userIds)
            .eq('is_enabled', true)
            .eq('reminder_enabled', true),
          supabase.from('routine_logs').select('*').in('user_id', userIds).is('routine_item_id', null),
          supabase.from('push_dispatch_logs').select('dispatch_key').in('user_id', userIds),
        ]);

        if (profRes.error || routRes.error || logRes.error || dispRes.error) return;

        const profiles = (profRes.data ?? []) as UserProfile[];
        const routines = ((routRes.data ?? []) as Routine[]).map(normalizeRoutine);
        const logs = (logRes.data ?? []) as RoutineLog[];
        const sentSet = new Set(
          ((dispRes.data ?? []) as Array<{ dispatch_key: string }>).map((d) => d.dispatch_key),
        );

        for (const prof of profiles) {
          if (prof.reminders_enabled === false) continue;
          const userSubs = subsByUser.get(prof.id) ?? [];
          if (userSubs.length === 0) continue;

          const tz = prof.timezone || 'Asia/Jakarta';
          const currentDate = getLocalDateIso(tz, now);
          const currentTimeHHMM = getLocalTimeHHMM(tz, now);

          const dueList = findDuePushNotificationsForUser({
            userId: prof.id,
            routines,
            routineLogs: logs,
            currentDate,
            currentTimeHHMM,
            remindersEnabled: true,
            sentDispatchKeys: sentSet,
          });

          for (const due of dueList) {
            const res = await sendWebPushToSubscriptions(userSubs, due.payload, async (ep) => {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', prof.id)
                .eq('endpoint', ep);
            });
            if (res.sent > 0) {
              sentSet.add(due.dispatchKey);
              await supabase.from('push_dispatch_logs').upsert({
                dispatch_key: due.dispatchKey,
                user_id: prof.id,
                routine_id: due.routine.id,
                log_date: due.logDate,
                sent_at: now.toISOString(),
              });
            }
          }
        }
        return;
      }

      // Local Vault Web Push Scheduler
      const vault = readVault();
      if (vault.push_subscriptions.length === 0 || vault.users.length === 0) return;

      const sentSet = new Set(vault.push_dispatch_logs.map((d) => d.dispatch_key));
      let vaultDirty = false;

      for (const user of vault.users) {
        if (user.profile.reminders_enabled === false) continue;
        const userSubs = vault.push_subscriptions.filter((s) => s.user_id === user.id);
        if (userSubs.length === 0) continue;

        const tz = user.profile.timezone || 'Asia/Jakarta';
        const currentDate = getLocalDateIso(tz, now);
        const currentTimeHHMM = getLocalTimeHHMM(tz, now);

        const dueList = findDuePushNotificationsForUser({
          userId: user.id,
          routines: vault.routines,
          routineLogs: vault.routine_logs,
          currentDate,
          currentTimeHHMM,
          remindersEnabled: true,
          sentDispatchKeys: sentSet,
        });

        for (const due of dueList) {
          const result = await sendWebPushToSubscriptions(userSubs, due.payload, (ep) => {
            vault.push_subscriptions = vault.push_subscriptions.filter(
              (s) => !(s.user_id === user.id && s.endpoint === ep),
            );
            vaultDirty = true;
          });
          if (result.sent > 0) {
            sentSet.add(due.dispatchKey);
            vault.push_dispatch_logs.push({
              dispatch_key: due.dispatchKey,
              user_id: user.id,
              routine_id: due.routine.id,
              log_date: due.logDate,
              sent_at: now.toISOString(),
            });
            vaultDirty = true;
          }
        }
      }

      // Keep at most 7 days of local dispatch logs
      const cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const prunedLogs = vault.push_dispatch_logs.filter((d) => d.log_date >= cutoffDate);
      if (prunedLogs.length !== vault.push_dispatch_logs.length) {
        vault.push_dispatch_logs = prunedLogs;
        vaultDirty = true;
      }

      if (vaultDirty) {
        writeVault(vault);
      }
    } catch (err) {
      console.error('Web Push scheduler error:', err);
    } finally {
      schedulerRunning = false;
    }
  };

  setTimeout(() => {
    void runScheduledPushDispatch();
  }, 5_000);
  setInterval(() => {
    void runScheduledPushDispatch();
  }, 30_000);

  // Vite / Static Frontend
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Personal Care Tracker running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
