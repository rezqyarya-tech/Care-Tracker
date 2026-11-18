import { Download, Share, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { canPromptInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <p className="text-xs text-[#616C62] inline-flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5 text-[#78917A]" />
        Aplikasi sudah terpasang di perangkat ini.
      </p>
    );
  }

  if (canPromptInstall) {
    return (
      <button
        type="button"
        onClick={() => void promptInstall()}
        className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] transition-colors whitespace-nowrap"
      >
        <Download className="w-4 h-4" />
        Pasang Aplikasi (PWA)
      </button>
    );
  }

  if (isIOS) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowIOSGuide((v) => !v)}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E2E7DF] bg-white text-sm font-medium text-[#344A3A] hover:bg-[#F8F9F6] whitespace-nowrap"
        >
          <Share className="w-4 h-4 text-[#78917A]" />
          Cara Pasang di iPhone / iPad
        </button>
        {showIOSGuide && (
          <p className="text-xs text-[#616C62] bg-[#F8F9F6] border border-[#E2E7DF] rounded-xl p-3 leading-relaxed">
            Buka halaman ini di Safari, ketuk tombol <strong>Bagikan (Share)</strong> di bagian bawah
            atau atas layar, lalu pilih <strong>Tambahkan ke Layar Utama</strong>.
          </p>
        )}
      </div>
    );
  }

  return (
    <p className="text-xs text-[#8A918A]">
      Di browser Chrome atau Edge versi terbaru, ikon pasang aplikasi akan muncul di bilah alamat
      bila didukung oleh perangkat Anda.
    </p>
  );
}
