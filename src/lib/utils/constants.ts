import type {
  AcneType,
  CareArea,
  FrequencyType,
  GeneralHairCondition,
  OilinessLevel,
  ProductEventType,
  ProductStatus,
  RoutineCompletionStatus,
  RoutineType,
  ScalpCondition,
  SeverityLevel,
  SheddingLevel,
} from '../../types/database';

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

export const FACE_PRODUCT_CATEGORIES = [
  'Pembersih Wajah',
  'Pelembap',
  'Tabir Surya',
  'Serum',
  'Toner',
  'Eksfolian',
  'Perawatan Jerawat',
  'Lainnya',
] as const;

export const HAIR_PRODUCT_CATEGORIES = [
  'Sampo',
  'Kondisioner',
  'Tonik Rambut',
  'Masker Rambut',
  'Perawatan Rambut',
  'Lainnya',
] as const;

export const USAGE_FREQUENCY_OPTIONS = [
  'Sekali sehari',
  'Dua kali sehari',
  'Dua hari sekali',
  '2–3 kali seminggu',
  'Seminggu sekali',
  'Sesuai kebutuhan',
] as const;

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Aktif',
  paused: 'Dijeda',
  discontinued: 'Dihentikan',
};

export const PRODUCT_EVENT_LABELS: Record<ProductEventType, string> = {
  started: 'Mulai digunakan',
  paused: 'Dijeda',
  resumed: 'Dilanjutkan',
  discontinued: 'Dihentikan',
  updated: 'Diperbarui',
};

export const CARE_AREA_LABELS: Record<CareArea, string> = {
  face: 'Perawatan Wajah',
  hair: 'Perawatan Rambut',
};

export const FACE_ROUTINE_TYPES: Array<{ value: RoutineType; label: string }> = [
  { value: 'morning', label: 'Pagi' },
  { value: 'evening', label: 'Malam' },
  { value: 'custom', label: 'Rutinitas khusus' },
];

export const HAIR_ROUTINE_TYPES: Array<{ value: RoutineType; label: string }> = [
  { value: 'shampoo', label: 'Keramas' },
  { value: 'conditioner', label: 'Penggunaan kondisioner' },
  { value: 'hair_tonic', label: 'Hair tonic' },
  { value: 'hair_mask', label: 'Hair mask' },
  { value: 'hair_treatment', label: 'Perawatan tambahan' },
  { value: 'other_hair', label: 'Lainnya' },
];

export const ROUTINE_TYPE_LABELS: Record<RoutineType, string> = {
  morning: 'Pagi',
  evening: 'Malam',
  custom: 'Rutinitas khusus',
  shampoo: 'Keramas',
  conditioner: 'Penggunaan kondisioner',
  hair_tonic: 'Hair tonic',
  hair_mask: 'Hair mask',
  hair_treatment: 'Perawatan tambahan',
  other_hair: 'Lainnya',
};

export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  daily: 'Setiap hari',
  weekly: 'Hari tertentu',
  interval: 'Setiap beberapa hari',
  as_needed: 'Sesuai kebutuhan',
};

export const DAYS_OF_WEEK = [
  { value: 0, short: 'Min', label: 'Minggu' },
  { value: 1, short: 'Sen', label: 'Senin' },
  { value: 2, short: 'Sel', label: 'Selasa' },
  { value: 3, short: 'Rab', label: 'Rabu' },
  { value: 4, short: 'Kam', label: 'Kamis' },
  { value: 5, short: 'Jum', label: 'Jumat' },
  { value: 6, short: 'Sab', label: 'Sabtu' },
] as const;

export const ROUTINE_COMPLETION_LABELS: Record<RoutineCompletionStatus, string> = {
  completed: 'Selesai',
  skipped: 'Dilewati',
  missed: 'Terlewat',
};

export const ACNE_TYPE_OPTIONS: Array<{ value: AcneType; label: string }> = [
  { value: 'no_acne', label: 'Tidak ada' },
  { value: 'small_pimples', label: 'Jerawat kecil' },
  { value: 'inflamed_acne', label: 'Jerawat meradang' },
  { value: 'deep_painful_acne', label: 'Jerawat besar / nyeri di dalam' },
  { value: 'other', label: 'Lainnya' },
];

export const ACNE_LOCATIONS = [
  'Dahi',
  'Pipi kiri',
  'Pipi kanan',
  'Hidung',
  'Dagu',
  'Rahang',
  'Lainnya',
] as const;

export const OILINESS_OPTIONS: Array<{ value: OilinessLevel; label: string }> = [
  { value: 'dry', label: 'Kering' },
  { value: 'normal', label: 'Normal' },
  { value: 'oily', label: 'Berminyak' },
  { value: 'very_oily', label: 'Sangat berminyak' },
];

export const SEVERITY_OPTIONS: Array<{ value: SeverityLevel; label: string }> = [
  { value: 'none', label: 'Tidak ada' },
  { value: 'mild', label: 'Ringan' },
  { value: 'moderate', label: 'Sedang' },
  { value: 'severe', label: 'Berat' },
];

export const SCALP_CONDITION_OPTIONS: Array<{ value: ScalpCondition; label: string }> = [
  { value: 'balanced', label: 'Seimbang' },
  { value: 'dry', label: 'Kering' },
  { value: 'oily', label: 'Berminyak' },
  { value: 'sensitive', label: 'Sensitif' },
  { value: 'irritated', label: 'Iritasi' },
];

export const SHEDDING_OPTIONS: Array<{ value: SheddingLevel; label: string }> = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'normal', label: 'Normal' },
  { value: 'elevated', label: 'Meningkat' },
  { value: 'heavy', label: 'Banyak' },
];

export const GENERAL_HAIR_CONDITION_OPTIONS: Array<{ value: GeneralHairCondition; label: string }> = [
  { value: 'healthy', label: 'Sehat & mudah diatur' },
  { value: 'dry_frizzy', label: 'Kering atau mengembang' },
  { value: 'oily_flat', label: 'Berminyak atau lepek' },
  { value: 'brittle', label: 'Rapuh atau mudah kusut' },
  { value: 'recovering', label: 'Berangsur membaik' },
];

export const CONTEXT_FACTOR_OPTIONS = [
  'Tidur cukup',
  'Kurang tidur',
  'Stres ringan',
  'Stres tinggi',
  'Perubahan pola makan',
  'Cuaca lembap',
  'Ruangan ber-AC / kering',
  'Paparan sinar matahari',
  'Siklus hormonal',
  'Perjalanan',
] as const;

export const TIMEZONE_OPTIONS = [
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Singapore',
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
] as const;

export function getOptionLabel<T extends string>(
  options: ReadonlyArray<{ value: T; label: string }>,
  value: T,
): string {
  return options.find((opt) => opt.value === value)?.label ?? value;
}
