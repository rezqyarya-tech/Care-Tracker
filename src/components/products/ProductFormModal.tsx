import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../shared/Modal';
import {
  FACE_PRODUCT_CATEGORIES,
  HAIR_PRODUCT_CATEGORIES,
  USAGE_FREQUENCY_OPTIONS,
} from '../../lib/utils/constants';
import { getLocalDateString } from '../../lib/utils/date';
import {
  hasValidationErrors,
  validateProductForm,
  type ValidationErrors,
} from '../../lib/validations/forms';
import type { CareArea, Product, ProductInput, ProductStatus } from '../../types/database';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ProductInput) => Promise<void>;
  initialProduct?: Product | null;
  timezone?: string;
}

export function ProductFormModal({
  open,
  onClose,
  onSubmit,
  initialProduct,
  timezone,
}: ProductFormModalProps) {
  const isEditing = Boolean(initialProduct);
  const today = getLocalDateString(new Date(), timezone);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [careArea, setCareArea] = useState<CareArea>('face');
  const [category, setCategory] = useState<string>(FACE_PRODUCT_CATEGORIES[0]);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [usageFrequency, setUsageFrequency] = useState<string>(USAGE_FREQUENCY_OPTIONS[0]);
  const [status, setStatus] = useState<ProductStatus>('active');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialProduct) {
      setName(initialProduct.name);
      setBrand(initialProduct.brand);
      setCareArea(initialProduct.care_area);
      setCategory(initialProduct.category);
      setStartDate(initialProduct.start_date);
      setEndDate(initialProduct.end_date ?? '');
      setUsageFrequency(initialProduct.usage_frequency);
      setStatus(initialProduct.status);
      setNotes(initialProduct.notes);
    } else {
      setName('');
      setBrand('');
      setCareArea('face');
      setCategory(FACE_PRODUCT_CATEGORIES[0]);
      setStartDate(today);
      setEndDate('');
      setUsageFrequency(USAGE_FREQUENCY_OPTIONS[0]);
      setStatus('active');
      setNotes('');
    }
    setErrors({});
    setSubmitError(null);
  }, [open, initialProduct, today]);

  const categories = careArea === 'face' ? FACE_PRODUCT_CATEGORIES : HAIR_PRODUCT_CATEGORIES;

  const handleCareAreaChange = (nextArea: CareArea) => {
    setCareArea(nextArea);
    const nextList = nextArea === 'face' ? FACE_PRODUCT_CATEGORIES : HAIR_PRODUCT_CATEGORIES;
    if (!nextList.includes(category as never)) {
      setCategory(nextList[0]);
    }
  };

  const handleStatusChange = (nextStatus: ProductStatus) => {
    setStatus(nextStatus);
    if (nextStatus === 'discontinued' && !endDate) {
      setEndDate(today);
    } else if (nextStatus === 'active') {
      setEndDate('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const payload: ProductInput = {
      name: name.trim(),
      brand: brand.trim(),
      category,
      care_area: careArea,
      start_date: startDate,
      end_date: endDate.trim() ? endDate.trim() : null,
      usage_frequency: usageFrequency,
      status,
      notes: notes.trim(),
      image_url: initialProduct?.image_url ?? null,
    };

    const validation = validateProductForm(payload);
    setErrors(validation);
    if (hasValidationErrors(validation)) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal menyimpan produk.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Ubah Produk' : 'Tambah Produk'}
      description="Catat kapan Anda mulai menggunakan produk perawatan wajah atau rambut."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {submitError && (
          <div className="p-3 rounded-xl bg-[#FDF2F1] border border-[#EBCAC6] text-sm text-[#A94438]">
            {submitError}
          </div>
        )}

        <div>
          <span className="block text-xs font-medium text-[#616C62] mb-1.5">Area Perawatan</span>
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F8F9F6] border border-[#E2E7DF] rounded-xl">
            {(['face', 'hair'] as const).map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => handleCareAreaChange(area)}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  careArea === area
                    ? 'bg-white text-[#344A3A] shadow-xs border border-[#E2E7DF]'
                    : 'text-[#8A918A] hover:text-[#344A3A]'
                }`}
              >
                {area === 'face' ? 'Perawatan Wajah' : 'Perawatan Rambut'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="product-name" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Nama Produk *
            </label>
            <input
              id="product-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth. Pembersih Wajah Lembut"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] placeholder:text-[#8A918A]/70"
            />
            {errors.name && <p className="text-xs text-[#A94438] mt-1">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="product-brand" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Merek
            </label>
            <input
              id="product-brand"
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="cth. Wardah, CeraVe"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] placeholder:text-[#8A918A]/70"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="product-category" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Kategori *
            </label>
            <select
              id="product-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-xs text-[#A94438] mt-1">{errors.category}</p>}
          </div>

          <div>
            <label htmlFor="product-frequency" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Frekuensi Penggunaan *
            </label>
            <select
              id="product-frequency"
              value={usageFrequency}
              onChange={(e) => setUsageFrequency(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
            >
              {USAGE_FREQUENCY_OPTIONS.map((freq) => (
                <option key={freq} value={freq}>
                  {freq}
                </option>
              ))}
            </select>
            {errors.usage_frequency && (
              <p className="text-xs text-[#A94438] mt-1">{errors.usage_frequency}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="product-status" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Status
            </label>
            <select
              id="product-status"
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as ProductStatus)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
            >
              <option value="active">Aktif</option>
              <option value="paused">Dijeda</option>
              <option value="discontinued">Dihentikan</option>
            </select>
          </div>

          <div>
            <label htmlFor="product-start-date" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Tanggal Mulai *
            </label>
            <input
              id="product-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] tabular-nums"
            />
            {errors.start_date && <p className="text-xs text-[#A94438] mt-1">{errors.start_date}</p>}
          </div>

          <div>
            <label htmlFor="product-end-date" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Tanggal Selesai {status === 'discontinued' ? '*' : '(opsional)'}
            </label>
            <input
              id="product-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] tabular-nums"
            />
            {errors.end_date && <p className="text-xs text-[#A94438] mt-1">{errors.end_date}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="product-notes" className="block text-xs font-medium text-[#616C62] mb-1.5">
            Catatan
          </label>
          <textarea
            id="product-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Kandungan utama, tekstur, atau alasan mulai atau menjeda produk..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] placeholder:text-[#8A918A]/70"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E2E7DF] text-sm font-medium text-[#344A3A] hover:bg-[#F8F9F6] transition-colors whitespace-nowrap"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Simpan Produk'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
