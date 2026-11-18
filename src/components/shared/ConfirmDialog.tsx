import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Konfirmasi hapus',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidthClass="max-w-md">
      <p className="text-sm text-[#344A3A]/90 leading-relaxed">{message}</p>
      <div className="flex items-center justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2.5 text-sm font-medium rounded-xl border border-[#E2E7DF] text-[#344A3A] hover:bg-[#F8F9F6] transition-colors whitespace-nowrap"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="px-4 py-2.5 text-sm font-medium rounded-xl bg-[#A94438] text-white hover:bg-[#8E382E] transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? 'Memproses...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
