import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="mb-4 px-4 py-2.5 rounded-xl bg-[#F3EFE6] border border-[#DFCEAD] text-xs text-[#744E12] flex items-center gap-2"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        Anda sedang luring (offline). Perubahan data baru memerlukan koneksi ke server, tetapi tampilan
        aplikasi tetap dapat dibuka.
      </span>
    </div>
  );
}
