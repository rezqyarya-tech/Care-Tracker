import type {
  HairJournalInput,
  ProductInput,
  RoutineInput,
  SkinJournalInput,
} from '../../types/database';

export type ValidationErrors<T extends string = string> = Partial<Record<T, string>>;

export function validateProductForm(
  input: ProductInput,
): ValidationErrors<'name' | 'category' | 'start_date' | 'end_date' | 'usage_frequency'> {
  const errors: ValidationErrors<'name' | 'category' | 'start_date' | 'end_date' | 'usage_frequency'> = {};
  if (!input.name.trim()) {
    errors.name = 'Nama produk wajib diisi.';
  }
  if (!input.category.trim()) {
    errors.category = 'Silakan pilih kategori produk.';
  }
  if (!input.start_date) {
    errors.start_date = 'Tanggal mulai wajib diisi.';
  }
  if (!input.usage_frequency.trim()) {
    errors.usage_frequency = 'Frekuensi penggunaan wajib diisi.';
  }
  if (input.end_date && input.start_date && input.end_date < input.start_date) {
    errors.end_date = 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.';
  }
  if (input.status === 'discontinued' && !input.end_date) {
    errors.end_date = 'Mohon isi tanggal selesai saat menghentikan produk.';
  }
  return errors;
}

export function validateRoutineForm(
  input: RoutineInput,
): ValidationErrors<'name' | 'days_of_week' | 'interval_days' | 'scheduled_time' | 'items'> {
  const errors: ValidationErrors<'name' | 'days_of_week' | 'interval_days' | 'scheduled_time' | 'items'> = {};
  if (!input.name.trim()) {
    errors.name = 'Nama rutinitas wajib diisi.';
  }
  if (input.frequency_type === 'weekly' && input.days_of_week.length === 0) {
    errors.days_of_week = 'Pilih minimal satu hari dalam seminggu.';
  }
  if (
    input.frequency_type === 'interval' &&
    (!input.interval_days || input.interval_days < 1 || input.interval_days > 60)
  ) {
    errors.interval_days = 'Interval hari harus antara 1 sampai 60 hari.';
  }
  if (!input.scheduled_time) {
    errors.scheduled_time = 'Silakan tentukan waktu rutinitas.';
  }
  if (input.items.length === 0 || input.items.some((item) => !item.title.trim())) {
    errors.items = 'Tambahkan minimal satu langkah aktivitas dengan judul.';
  }
  return errors;
}

export function validateSkinJournalForm(
  input: SkinJournalInput,
): ValidationErrors<'entry_date' | 'acne_severity'> {
  const errors: ValidationErrors<'entry_date' | 'acne_severity'> = {};
  if (!input.entry_date) {
    errors.entry_date = 'Tanggal catatan wajib diisi.';
  }
  if (
    Number.isNaN(input.acne_severity) ||
    input.acne_severity < 0 ||
    input.acne_severity > 10
  ) {
    errors.acne_severity = 'Tingkat jerawat harus antara 0 dan 10.';
  }
  return errors;
}

export function validateHairJournalForm(
  input: HairJournalInput,
): ValidationErrors<'entry_date'> {
  const errors: ValidationErrors<'entry_date'> = {};
  if (!input.entry_date) {
    errors.entry_date = 'Tanggal catatan wajib diisi.';
  }
  return errors;
}

export function hasValidationErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some((val) => Boolean(val));
}
