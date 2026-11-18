import type { ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
} from 'lucide-react';
import { useOwnerProfile } from '../../hooks/useOwnerProfile';
import type { AppRoute } from '../../types/database';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { ReminderBanner } from '../reminders/ReminderBanner';

interface AppShellProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  pageTitle: string;
  primaryAction?: ReactNode;
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  id: AppRoute;
  label: string;
  mobileLabel: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Ringkasan', mobileLabel: 'Ringkasan', icon: LayoutDashboard },
  { id: 'routine', label: 'Rutinitas Saya', mobileLabel: 'Rutinitas', icon: CalendarCheck },
  { id: 'products', label: 'Produk Saya', mobileLabel: 'Produk', icon: Package },
  { id: 'journal', label: 'Catatan Harian', mobileLabel: 'Catatan', icon: BookOpen },
  { id: 'insights', label: 'Analisis', mobileLabel: 'Analisis', icon: BarChart3 },
  { id: 'settings', label: 'Pengaturan', mobileLabel: 'Setelan', icon: Settings },
];

export function AppShell({
  activeRoute,
  onNavigate,
  pageTitle,
  primaryAction,
  children,
}: AppShellProps) {
  const { user, profile, logout } = useOwnerProfile();
  const compact = Boolean(profile?.compact_mode);

  return (
    <div className="min-h-screen bg-[#F8F9F6] text-[#344A3A] flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-white border-r border-[#E2E7DF] z-30">
        <div className="px-6 py-6 border-b border-[#E2E7DF]">
          <a
            href="#/dashboard"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('dashboard');
            }}
            className="block focus-visible:outline-none"
          >
            <span className="font-display text-lg font-semibold tracking-tight text-[#344A3A] block whitespace-nowrap">
              Personal Care Tracker
            </span>
            <span className="text-xs text-[#8A918A] mt-0.5 block">
              Catatan Kulit &amp; Rambut
            </span>
          </a>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="Navigasi utama">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#E7EDE5] text-[#344A3A]'
                    : 'text-[#616C62] hover:bg-[#F8F9F6] hover:text-[#344A3A]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-[#344A3A]' : 'text-[#8A918A]'}`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E2E7DF] space-y-2.5">
          <div className="px-2">
            <p className="text-sm font-medium text-[#344A3A] truncate">
              {profile?.full_name || 'Pengguna Pribadi'}
            </p>
            <p className="text-xs text-[#8A918A] truncate">
              {user?.email || profile?.timezone || 'Asia/Jakarta'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full min-h-[38px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[#E2E7DF] bg-[#F8F9F6] text-xs font-medium text-[#616C62] hover:text-[#344A3A] hover:bg-[#E7EDE5] transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Bar (Desktop & Mobile) */}
        <header className="sticky top-0 z-20 bg-[#F8F9F6]/90 backdrop-blur-md border-b border-[#E2E7DF] px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-display text-base sm:text-lg font-semibold text-[#344A3A] truncate">
              {pageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {primaryAction}
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Keluar dari akun"
              className="md:hidden min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E7DF] bg-white text-xs font-medium text-[#616C62] hover:text-[#344A3A] whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        <main
          className={`flex-1 px-4 sm:px-8 ${
            compact ? 'py-4' : 'py-6'
          } pb-24 md:pb-10 max-w-6xl w-full mx-auto`}
        >
          <OfflineIndicator />
          <ReminderBanner />
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E2E7DF] grid grid-cols-6 items-center h-16 px-1"
        aria-label="Navigasi seluler"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors ${
                active ? 'text-[#344A3A]' : 'text-[#8A918A]'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-[#78917A]' : 'text-[#8A918A]'}`} />
              <span className="text-[10px] font-medium whitespace-nowrap">
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
