export type CareArea = 'face' | 'hair';

export type ProductStatus = 'active' | 'paused' | 'discontinued';

export type ProductEventType = 'started' | 'paused' | 'resumed' | 'discontinued' | 'updated';

export type RoutineType =
  | 'morning'
  | 'evening'
  | 'custom'
  | 'shampoo'
  | 'conditioner'
  | 'hair_tonic'
  | 'hair_mask'
  | 'hair_treatment'
  | 'other_hair';

export type FrequencyType = 'daily' | 'weekly' | 'interval' | 'as_needed';

export type RoutineCompletionStatus = 'completed' | 'skipped' | 'missed';

export type AcneType =
  | 'no_acne'
  | 'small_pimples'
  | 'inflamed_acne'
  | 'deep_painful_acne'
  | 'other';

export type OilinessLevel = 'dry' | 'normal' | 'oily' | 'very_oily';

export type SeverityLevel = 'none' | 'mild' | 'moderate' | 'severe';

export type ScalpCondition = 'balanced' | 'dry' | 'oily' | 'sensitive' | 'irritated';

export type SheddingLevel = 'minimal' | 'normal' | 'elevated' | 'heavy';

export type GeneralHairCondition =
  | 'healthy'
  | 'dry_frizzy'
  | 'oily_flat'
  | 'brittle'
  | 'recovering';

export interface UserProfile {
  id: string;
  email?: string;
  full_name: string;
  timezone: string;
  skin_type: string | null;
  hair_type: string | null;
  reminders_enabled: boolean;
  browser_notifications_enabled: boolean;
  compact_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushSubscriptionSummary {
  id: string;
  endpointPreview: string;
  userAgent: string;
  createdAt: string;
}

export interface PushStatusInfo {
  vapidConfigured: boolean;
  vapidSource: 'env' | 'local';
  publicKey: string;
  subscriptionCount: number;
  subscriptions: PushSubscriptionSummary[];
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  brand: string;
  category: string;
  care_area: CareArea;
  start_date: string;
  end_date: string | null;
  usage_frequency: string;
  status: ProductStatus;
  notes: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductHistoryEntry {
  id: string;
  product_id: string;
  user_id: string;
  event_type: ProductEventType;
  previous_status: ProductStatus | null;
  new_status: ProductStatus;
  effective_date: string;
  note: string;
  created_at: string;
}

export interface RoutineItem {
  id: string;
  routine_id: string;
  user_id: string;
  product_id: string | null;
  step_order: number;
  title: string;
  instructions: string;
  created_at: string;
}

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  care_area: CareArea;
  routine_type: RoutineType;
  frequency_type: FrequencyType;
  days_of_week: number[];
  interval_days: number;
  interval_start_date: string | null;
  scheduled_time: string;
  is_enabled: boolean;
  reminder_enabled: boolean;
  reminder_time: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  items?: RoutineItem[];
}

export interface RoutineLog {
  id: string;
  routine_id: string;
  routine_item_id: string | null;
  user_id: string;
  log_date: string;
  status: RoutineCompletionStatus;
  completed_at: string | null;
  note: string;
  created_at: string;
}

export interface SkinJournal {
  id: string;
  user_id: string;
  entry_date: string;
  acne_severity: number;
  acne_type: AcneType;
  acne_locations: string[];
  oiliness: OilinessLevel;
  irritation: SeverityLevel;
  redness: SeverityLevel;
  dryness_peeling: SeverityLevel;
  context_factors: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface HairJournal {
  id: string;
  user_id: string;
  entry_date: string;
  scalp_condition: ScalpCondition;
  hair_oiliness: OilinessLevel;
  dandruff: SeverityLevel;
  scalp_itching: SeverityLevel;
  shedding_level: SheddingLevel;
  general_condition: GeneralHairCondition;
  washed_hair: boolean;
  context_factors: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface JournalPhoto {
  id: string;
  user_id: string;
  journal_type: CareArea;
  skin_journal_id: string | null;
  hair_journal_id: string | null;
  entry_date: string;
  storage_path: string;
  signed_url?: string;
  caption: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface ProductInput {
  name: string;
  brand: string;
  category: string;
  care_area: CareArea;
  start_date: string;
  end_date: string | null;
  usage_frequency: string;
  status: ProductStatus;
  notes: string;
  image_url: string | null;
}

export interface RoutineInput {
  name: string;
  care_area: CareArea;
  routine_type: RoutineType;
  frequency_type: FrequencyType;
  days_of_week: number[];
  interval_days?: number;
  interval_start_date?: string | null;
  scheduled_time: string;
  is_enabled: boolean;
  reminder_enabled?: boolean;
  reminder_time?: string | null;
  notes: string;
  items: Array<{
    product_id: string | null;
    title: string;
    instructions: string;
  }>;
}

export interface SkinJournalInput {
  entry_date: string;
  acne_severity: number;
  acne_type: AcneType;
  acne_locations: string[];
  oiliness: OilinessLevel;
  irritation: SeverityLevel;
  redness: SeverityLevel;
  dryness_peeling: SeverityLevel;
  context_factors: string[];
  notes: string;
}

export interface HairJournalInput {
  entry_date: string;
  scalp_condition: ScalpCondition;
  hair_oiliness: OilinessLevel;
  dandruff: SeverityLevel;
  scalp_itching: SeverityLevel;
  shedding_level: SheddingLevel;
  general_condition: GeneralHairCondition;
  washed_hair: boolean;
  context_factors: string[];
  notes: string;
}

export type AppRoute = 'dashboard' | 'routine' | 'products' | 'journal' | 'insights' | 'settings';

export type BackendMode = 'supabase' | 'local';
