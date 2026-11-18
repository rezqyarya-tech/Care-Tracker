import { useState } from 'react';
import { Calendar, Clock, Edit3, PauseCircle, PlayCircle, StopCircle, Trash2 } from 'lucide-react';
import { Modal } from '../shared/Modal';
import {
  CARE_AREA_LABELS,
  OILINESS_OPTIONS,
  PRODUCT_EVENT_LABELS,
  PRODUCT_STATUS_LABELS,
  SCALP_CONDITION_OPTIONS,
  SEVERITY_OPTIONS,
  SHEDDING_OPTIONS,
  getOptionLabel,
} from '../../lib/utils/constants';
import {
  calculateUsageDays,
  formatShortDate,
  formatTime12h,
  formatUsageDuration,
  getLocalDateString,
} from '../../lib/utils/date';
import type {
  HairJournal,
  Product,
  ProductHistoryEntry,
  ProductStatus,
  Routine,
  SkinJournal,
} from '../../types/database';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  history: ProductHistoryEntry[];
  routines: Routine[];
  skinJournals: SkinJournal[];
  hairJournals: HairJournal[];
  timezone?: string;
  onEdit: (product: Product) => void;
  onChangeStatus: (
    product: Product,
    nextStatus: ProductStatus,
    note: string,
  ) => Promise<void>;
  onRequestDelete: (product: Product) => void;
}

export function ProductDetailModal({
  product,
  onClose,
  history,
  routines,
  skinJournals,
  hairJournals,
  timezone,
  onEdit,
  onChangeStatus,
  onRequestDelete,
}: ProductDetailModalProps) {
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  if (!product) return null;

  const today = getLocalDateString(new Date(), timezone);
  const usageDays = calculateUsageDays(product.start_date, product.end_date, today);
  const productHistory = history
    .filter((h) => h.product_id === product.id)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date) || b.created_at.localeCompare(a.created_at));

  const associatedRoutines = routines.filter((r) =>
    (r.items ?? []).some((item) => item.product_id === product.id),
  );

  const windowEnd = product.end_date ?? today;
  const relatedSkin =
    product.care_area === 'face'
      ? skinJournals
          .filter((j) => j.entry_date >= product.start_date && j.entry_date <= windowEnd)
          .slice(0, 5)
      : [];
  const relatedHair =
    product.care_area === 'hair'
      ? hairJournals
          .filter((j) => j.entry_date >= product.start_date && j.entry_date <= windowEnd)
          .slice(0, 5)
      : [];

  const handleStatusChange = async (nextStatus: ProductStatus) => {
    if (updatingStatus || nextStatus === product.status) return;
    setUpdatingStatus(true);
    try {
      await onChangeStatus(product, nextStatus, statusNote.trim());
      setStatusNote('');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title={product.name}
      description={`${product.brand ? `${product.brand} · ` : ''}${CARE_AREA_LABELS[product.care_area]} · ${product.category}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-[#E2E7DF]">
          <div>
            <p className="text-xs text-[#8A918A]">Status</p>
            <p className="text-sm font-semibold text-[#344A3A] mt-1">
              {PRODUCT_STATUS_LABELS[product.status]}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#8A918A]">Durasi Pemakaian</p>
            <p className="text-sm font-semibold text-[#344A3A] mt-1 tabular-nums">
              {formatUsageDuration(usageDays)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#8A918A]">Tanggal Mulai</p>
            <p className="text-sm font-medium text-[#344A3A] mt-1 tabular-nums">
              {formatShortDate(product.start_date)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#8A918A]">Tanggal Selesai</p>
            <p className="text-sm font-medium text-[#344A3A] mt-1 tabular-nums">
              {product.end_date ? formatShortDate(product.end_date) : 'Masih berjalan'}
            </p>
          </div>
        </div>

        {/* Notes & Frequency */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#8A918A]">
            <Clock className="w-3.5 h-3.5" />
            <span>Frekuensi: {product.usage_frequency}</span>
          </div>
          {product.notes ? (
            <p className="text-sm text-[#344A3A]/90 leading-relaxed bg-[#F8F9F6] p-3.5 rounded-xl border border-[#E2E7DF]">
              {product.notes}
            </p>
          ) : (
            <p className="text-xs text-[#8A918A]">Belum ada catatan untuk produk ini.</p>
          )}
        </div>

        {/* Status Transition (Preserves History) */}
        <div className="p-4 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#344A3A]">Perbarui Status Produk</h3>
              <p className="text-xs text-[#8A918A]">
                Menjeda atau menghentikan produk tetap menyimpan seluruh riwayat penggunaan dan rutinitas.
              </p>
            </div>
          </div>
          <input
            type="text"
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder="Catatan opsional untuk perubahan status (cth. kulit terasa kering, botol habis)"
            className="w-full px-3 py-2 rounded-lg border border-[#E2E7DF] bg-white text-xs text-[#344A3A] placeholder:text-[#8A918A]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={updatingStatus || product.status === 'active'}
              onClick={() => void handleStatusChange('active')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E7DF] bg-white text-xs font-medium text-[#344A3A] hover:bg-[#E7EDE5] disabled:opacity-45 whitespace-nowrap"
            >
              <PlayCircle className="w-3.5 h-3.5 text-[#78917A]" />
              Aktifkan
            </button>
            <button
              type="button"
              disabled={updatingStatus || product.status === 'paused'}
              onClick={() => void handleStatusChange('paused')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E7DF] bg-white text-xs font-medium text-[#344A3A] hover:bg-[#E7EDE5] disabled:opacity-45 whitespace-nowrap"
            >
              <PauseCircle className="w-3.5 h-3.5 text-[#B7791F]" />
              Jeda Produk
            </button>
            <button
              type="button"
              disabled={updatingStatus || product.status === 'discontinued'}
              onClick={() => void handleStatusChange('discontinued')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E7DF] bg-white text-xs font-medium text-[#344A3A] hover:bg-[#FDF2F1] disabled:opacity-45 whitespace-nowrap"
            >
              <StopCircle className="w-3.5 h-3.5 text-[#A94438]" />
              Hentikan
            </button>
          </div>
        </div>

        {/* Associated Routines */}
        <div>
          <h3 className="text-sm font-semibold text-[#344A3A] mb-2">Rutinitas Terkait</h3>
          {associatedRoutines.length === 0 ? (
            <p className="text-xs text-[#8A918A]">
              Belum terhubung ke rutinitas mana pun. Hubungkan dari menu Rutinitas Saya.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E7DF] border border-[#E2E7DF] rounded-xl bg-white">
              {associatedRoutines.map((routine) => (
                <div key={routine.id} className="px-3.5 py-2.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-[#344A3A]">{routine.name}</span>
                  <span className="text-xs text-[#8A918A] tabular-nums">
                    {formatTime12h(routine.scheduled_time)} · {routine.is_enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage History Timeline */}
        <div>
          <h3 className="text-sm font-semibold text-[#344A3A] mb-2">Riwayat Penggunaan</h3>
          {productHistory.length === 0 ? (
            <p className="text-xs text-[#8A918A]">Belum ada riwayat perubahan status.</p>
          ) : (
            <div className="divide-y divide-[#E2E7DF] border border-[#E2E7DF] rounded-xl bg-white">
              {productHistory.map((item) => (
                <div key={item.id} className="px-3.5 py-2.5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#344A3A]">
                      {PRODUCT_EVENT_LABELS[item.event_type]} ({PRODUCT_STATUS_LABELS[item.new_status]})
                    </p>
                    {item.note && <p className="text-xs text-[#616C62] mt-0.5">{item.note}</p>}
                  </div>
                  <span className="text-xs text-[#8A918A] tabular-nums shrink-0 inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatShortDate(item.effective_date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related Journal Entries */}
        <div>
          <h3 className="text-sm font-semibold text-[#344A3A] mb-2">
            Catatan Harian {product.care_area === 'face' ? 'Wajah' : 'Rambut'} Terkait
          </h3>
          {relatedSkin.length === 0 && relatedHair.length === 0 ? (
            <p className="text-xs text-[#8A918A]">
              Belum ada catatan harian selama periode pemakaian produk ini.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E7DF] border border-[#E2E7DF] rounded-xl bg-white">
              {relatedSkin.map((entry) => (
                <div key={entry.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-[#344A3A] font-medium tabular-nums">
                    {formatShortDate(entry.entry_date)} · Jerawat {entry.acne_severity}/10 · Minyak:{' '}
                    {getOptionLabel(OILINESS_OPTIONS, entry.oiliness)}
                  </span>
                  <span className="text-[#8A918A]">
                    Iritasi: {getOptionLabel(SEVERITY_OPTIONS, entry.irritation)}
                  </span>
                </div>
              ))}
              {relatedHair.map((entry) => (
                <div key={entry.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-[#344A3A] font-medium tabular-nums">
                    {formatShortDate(entry.entry_date)} · Kulit kepala:{' '}
                    {getOptionLabel(SCALP_CONDITION_OPTIONS, entry.scalp_condition)} · Rontok:{' '}
                    {getOptionLabel(SHEDDING_OPTIONS, entry.shedding_level)}
                  </span>
                  <span className="text-[#8A918A]">
                    {entry.washed_hair ? 'Keramas' : 'Tidak keramas'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E2E7DF]">
          <button
            type="button"
            onClick={() => onRequestDelete(product)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#A94438] hover:bg-[#FDF2F1] transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus Produk
          </button>
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] transition-colors whitespace-nowrap"
          >
            <Edit3 className="w-4 h-4" />
            Ubah Detail
          </button>
        </div>
      </div>
    </Modal>
  );
}
