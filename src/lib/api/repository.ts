import type {
  AuthUser,
  BackendMode,
  HairJournal,
  HairJournalInput,
  JournalPhoto,
  Product,
  ProductHistoryEntry,
  ProductInput,
  PushStatusInfo,
  PushSubscriptionInput,
  PushSubscriptionSummary,
  Routine,
  RoutineCompletionStatus,
  RoutineInput,
  RoutineLog,
  SkinJournal,
  SkinJournalInput,
  UserProfile,
} from '../../types/database';

export interface AppStatusInfo {
  supabaseConfigured: boolean;
  backendMode: BackendMode;
  authenticated: boolean;
  user: AuthUser | null;
  profile: UserProfile | null;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Permintaan gagal (${res.status})`);
  }
  return data;
}

export async function getAppStatus(): Promise<AppStatusInfo> {
  return apiFetch<AppStatusInfo>('/api/status');
}

export async function registerAccount(input: {
  full_name: string;
  email: string;
  password: string;
}): Promise<{ user: AuthUser; profile: UserProfile }> {
  return apiFetch<{ user: AuthUser; profile: UserProfile }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser; profile: UserProfile }> {
  return apiFetch<{ user: AuthUser; profile: UserProfile }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logoutAccount(): Promise<void> {
  await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function updateProfile(
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
): Promise<UserProfile> {
  const data = await apiFetch<{ profile: UserProfile }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return data.profile;
}

// WEB PUSH (VAPID)
export async function fetchPushStatus(): Promise<PushStatusInfo> {
  return apiFetch<PushStatusInfo>('/api/push/status');
}

export async function savePushSubscription(
  subscription: PushSubscriptionInput,
  userAgent?: string,
): Promise<PushSubscriptionSummary> {
  const data = await apiFetch<{ subscription: PushSubscriptionSummary }>('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription, userAgent }),
  });
  return data.subscription;
}

export async function removePushSubscription(endpoint?: string): Promise<void> {
  await apiFetch<{ ok: boolean }>('/api/push/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
}

export async function sendTestPushNotification(): Promise<{
  sent: number;
  failed: number;
  removedExpired: number;
  lastError?: string;
}> {
  return apiFetch<{
    sent: number;
    failed: number;
    removedExpired: number;
    lastError?: string;
  }>('/api/push/test', { method: 'POST' });
}

// PRODUCTS
export async function fetchProductsAndHistory(): Promise<{
  products: Product[];
  history: ProductHistoryEntry[];
}> {
  return apiFetch<{ products: Product[]; history: ProductHistoryEntry[] }>('/api/products');
}

export async function createProduct(input: ProductInput): Promise<{
  product: Product;
  historyEntry: ProductHistoryEntry;
}> {
  return apiFetch<{ product: Product; historyEntry: ProductHistoryEntry }>('/api/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateProduct(
  id: string,
  updates: Partial<ProductInput> & { history_note?: string },
): Promise<Product> {
  const data = await apiFetch<{ product: Product }>(`/api/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return data.product;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/products/${id}`, { method: 'DELETE' });
}

// ROUTINES
export async function fetchRoutinesAndLogs(): Promise<{
  routines: Routine[];
  logs: RoutineLog[];
}> {
  return apiFetch<{ routines: Routine[]; logs: RoutineLog[] }>('/api/routines');
}

export async function createRoutine(input: RoutineInput): Promise<Routine> {
  const data = await apiFetch<{ routine: Routine }>('/api/routines', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.routine;
}

export async function updateRoutine(id: string, input: Partial<RoutineInput>): Promise<Routine> {
  const data = await apiFetch<{ routine: Routine }>(`/api/routines/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.routine;
}

export async function deleteRoutine(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/routines/${id}`, { method: 'DELETE' });
}

export async function logRoutineActivity(input: {
  routine_id: string;
  routine_item_id?: string | null;
  log_date: string;
  status: RoutineCompletionStatus;
  note?: string;
}): Promise<RoutineLog> {
  const data = await apiFetch<{ log: RoutineLog }>('/api/routine-logs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.log;
}

// JOURNALS & PRIVATE PHOTOS
export async function fetchJournalsAndPhotos(): Promise<{
  skin: SkinJournal[];
  hair: HairJournal[];
  photos: JournalPhoto[];
}> {
  return apiFetch<{ skin: SkinJournal[]; hair: HairJournal[]; photos: JournalPhoto[] }>(
    '/api/journals',
  );
}

export async function createSkinJournal(input: SkinJournalInput): Promise<SkinJournal> {
  const data = await apiFetch<{ entry: SkinJournal }>('/api/journals/skin', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.entry;
}

export async function updateSkinJournal(
  id: string,
  input: Partial<SkinJournalInput>,
): Promise<SkinJournal> {
  const data = await apiFetch<{ entry: SkinJournal }>(`/api/journals/skin/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.entry;
}

export async function deleteSkinJournal(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/journals/skin/${id}`, { method: 'DELETE' });
}

export async function createHairJournal(input: HairJournalInput): Promise<HairJournal> {
  const data = await apiFetch<{ entry: HairJournal }>('/api/journals/hair', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.entry;
}

export async function updateHairJournal(
  id: string,
  input: Partial<HairJournalInput>,
): Promise<HairJournal> {
  const data = await apiFetch<{ entry: HairJournal }>(`/api/journals/hair/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.entry;
}

export async function deleteHairJournal(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/journals/hair/${id}`, { method: 'DELETE' });
}

export async function uploadJournalPhoto(input: {
  journal_type: 'face' | 'hair';
  skin_journal_id?: string | null;
  hair_journal_id?: string | null;
  entry_date: string;
  caption: string;
  dataUrl: string;
}): Promise<JournalPhoto> {
  const data = await apiFetch<{ photo: JournalPhoto }>('/api/photos', {
    method: 'POST',
    body: JSON.stringify({
      journal_type: input.journal_type,
      skin_journal_id: input.skin_journal_id ?? null,
      hair_journal_id: input.hair_journal_id ?? null,
      entry_date: input.entry_date,
      caption: input.caption,
      data_url: input.dataUrl,
    }),
  });
  return data.photo;
}

export async function deleteJournalPhoto(photo: JournalPhoto): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/photos/${photo.id}`, { method: 'DELETE' });
}

export interface ExportBundle {
  exportedAt: string;
  profile: UserProfile | null;
  products: Product[];
  product_history: ProductHistoryEntry[];
  routines: Routine[];
  routine_items: unknown[];
  routine_logs: RoutineLog[];
  skin_journals: SkinJournal[];
  hair_journals: HairJournal[];
  journal_photos: JournalPhoto[];
}

export async function exportAllUserData(): Promise<ExportBundle> {
  return apiFetch<ExportBundle>('/api/export');
}
