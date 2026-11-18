import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getAppStatus,
  loginAccount,
  logoutAccount,
  registerAccount,
  updateProfile,
} from '../lib/api/repository';
import type { AuthUser, BackendMode, UserProfile } from '../types/database';

interface OwnerProfileContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  authenticated: boolean;
  backendMode: BackendMode;
  supabaseConfigured: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  saveProfile: (
    updates: Partial<
      Pick<
        UserProfile,
        | 'full_name'
        | 'timezone'
        | 'skin_type'
        | 'hair_type'
        | 'reminders_enabled'
        | 'browser_notifications_enabled'
        | 'compact_mode'
      >
    >,
  ) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const OwnerProfileContext = createContext<OwnerProfileContextValue | null>(null);

export function OwnerProfileProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [backendMode, setBackendMode] = useState<BackendMode>('local');
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await getAppStatus();
      setBackendMode(status.backendMode);
      setSupabaseConfigured(status.supabaseConfigured);
      setAuthenticated(status.authenticated);
      setUser(status.user);
      setProfile(status.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak dapat memuat status aplikasi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginAccount({ email, password });
    setUser(res.user);
    setProfile(res.profile);
    setAuthenticated(true);
    setError(null);
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const res = await registerAccount({ full_name: fullName, email, password });
    setUser(res.user);
    setProfile(res.profile);
    setAuthenticated(true);
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    await logoutAccount();
    setUser(null);
    setProfile(null);
    setAuthenticated(false);
    if (typeof window !== 'undefined') {
      window.location.hash = '#/dashboard';
    }
  }, []);

  const saveProfile = useCallback(
    async (
      updates: Partial<
        Pick<
          UserProfile,
          | 'full_name'
          | 'timezone'
          | 'skin_type'
          | 'hair_type'
          | 'reminders_enabled'
          | 'browser_notifications_enabled'
          | 'compact_mode'
        >
      >,
    ) => {
      const updated = await updateProfile(updates);
      setProfile(updated);
    },
    [],
  );

  return (
    <OwnerProfileContext.Provider
      value={{
        user,
        profile,
        authenticated,
        backendMode,
        supabaseConfigured,
        loading,
        error,
        login,
        register,
        logout,
        saveProfile,
        refreshProfile,
      }}
    >
      {children}
    </OwnerProfileContext.Provider>
  );
}

export function useOwnerProfile(): OwnerProfileContextValue {
  const ctx = useContext(OwnerProfileContext);
  if (!ctx) throw new Error('useOwnerProfile harus digunakan di dalam OwnerProfileProvider');
  return ctx;
}
