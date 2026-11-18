import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidthClass = 'max-w-xl',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#344A3A]/35 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} bg-white border border-[#E2E7DF] rounded-t-3xl sm:rounded-2xl shadow-lg max-h-[92vh] flex flex-col overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#E2E7DF]">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-[#344A3A]">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-[#8A918A] mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Tutup ${title}`}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#8A918A] hover:text-[#344A3A] hover:bg-[#E7EDE5]/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
