import { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ProductFormModal } from './components/products/ProductFormModal';
import { OwnerProfileProvider, useOwnerProfile } from './hooks/useOwnerProfile';
import { TrackerDataProvider, useTrackerData } from './hooks/useTrackerData';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { InsightsPage } from './pages/InsightsPage';
import { JournalPage } from './pages/JournalPage';
import { ProductsPage } from './pages/ProductsPage';
import { RoutinePage } from './pages/RoutinePage';
import { SettingsPage } from './pages/SettingsPage';
import type { AppRoute } from './types/database';

const VALID_ROUTES: AppRoute[] = [
  'dashboard',
  'routine',
  'products',
  'journal',
  'insights',
  'settings',
];

const ROUTE_TITLES: Record<AppRoute, string> = {
  dashboard: 'Ringkasan',
  routine: 'Rutinitas Saya',
  products: 'Produk Saya',
  journal: 'Catatan Harian',
  insights: 'Analisis',
  settings: 'Pengaturan',
};

function parseRouteFromLocation(): AppRoute {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  const path = window.location.pathname.replace(/^\//, '').split('/')[0];
  const candidate = (hash || path) as AppRoute;
  return VALID_ROUTES.includes(candidate) ? candidate : 'dashboard';
}

function WorkspaceContent() {
  const { profile } = useOwnerProfile();
  const { addProduct } = useTrackerData();

  const [route, setRoute] = useState<AppRoute>(() => parseRouteFromLocation());
  const [journalTab, setJournalTab] = useState<'face' | 'hair'>('face');
  const [quickAddProductOpen, setQuickAddProductOpen] = useState(false);

  useEffect(() => {
    const onHashOrPop = () => {
      setRoute(parseRouteFromLocation());
    };
    window.addEventListener('hashchange', onHashOrPop);
    window.addEventListener('popstate', onHashOrPop);
    return () => {
      window.removeEventListener('hashchange', onHashOrPop);
      window.removeEventListener('popstate', onHashOrPop);
    };
  }, []);

  const navigate = (nextRoute: AppRoute, options?: { journalTab?: 'face' | 'hair' }) => {
    if (options?.journalTab) setJournalTab(options.journalTab);
    setRoute(nextRoute);
    window.location.hash = `#/${nextRoute}`;
  };

  return (
    <>
      <AppShell
        activeRoute={route}
        onNavigate={(next) => navigate(next)}
        pageTitle={ROUTE_TITLES[route]}
      >
        {route === 'dashboard' && (
          <DashboardPage
            onNavigate={navigate}
            onOpenAddProduct={() => setQuickAddProductOpen(true)}
          />
        )}
        {route === 'routine' && <RoutinePage />}
        {route === 'products' && <ProductsPage />}
        {route === 'journal' && <JournalPage key={journalTab} initialTab={journalTab} />}
        {route === 'insights' && <InsightsPage />}
        {route === 'settings' && <SettingsPage />}
      </AppShell>

      <ProductFormModal
        open={quickAddProductOpen}
        onClose={() => setQuickAddProductOpen(false)}
        onSubmit={async (input) => {
          await addProduct(input);
        }}
        timezone={profile?.timezone}
      />
    </>
  );
}

function AppRouter() {
  const { loading, error, authenticated, profile, refreshProfile } = useOwnerProfile();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9F6] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-7 h-7 border-2 border-[#78917A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#8A918A]">Memuat Personal Care Tracker...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8F9F6] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E2E7DF] rounded-2xl p-6 text-center space-y-3">
          <h1 className="font-display text-lg font-semibold text-[#344A3A]">
            Gagal Membuka Ruang Kerja
          </h1>
          <p className="text-sm text-[#A94438]">{error}</p>
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="px-4 py-2 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069]"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!authenticated || !profile) {
    return <AuthPage />;
  }

  return (
    <TrackerDataProvider>
      <WorkspaceContent />
    </TrackerDataProvider>
  );
}

export default function App() {
  return (
    <OwnerProfileProvider>
      <AppRouter />
    </OwnerProfileProvider>
  );
}
