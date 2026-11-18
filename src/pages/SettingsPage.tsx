import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Bell,
  BellOff,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  LogOut,
  Send,
  ShieldCheck,
  Sliders,
  Smartphone,
  User,
} from 'lucide-react';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import { useOwnerProfile } from '../hooks/useOwnerProfile';
import { useTrackerData } from '../hooks/useTrackerData';
import {
  exportAllUserData,
  fetchPushStatus,
  sendTestPushNotification,
} from '../lib/api/repository';
import {
  getCurrentDevicePushSubscription,
  isWebPushSupported,
  subscribeCurrentDeviceToWebPush,
  unsubscribeCurrentDeviceFromWebPush,
} from '../lib/push/webPushClient';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from '../lib/utils/constants';
import {
  buildHairJournalsCsv,
  buildProductsCsv,
  buildRoutinesAndLogsCsv,
  buildSkinJournalsCsv,
  buildSummaryPdf,
  triggerTextDownload,
  type ExportDatasetKey,
} from '../lib/utils/exportUtils';
import type { PushStatusInfo } from '../types/database';

const DATASET_OPTIONS: Array<{ key: ExportDatasetKey; label: string }> = [
  { key: 'products', label: 'Daftar Produk & Status' },
  { key: 'routines', label: 'Rutinitas & Riwayat Penyelesaian' },
  { key: 'skin_journals', label: 'Catatan Harian Wajah' },
  { key: 'hair_journals', label: 'Catatan Harian Rambut' },
  { key: 'photos', label: 'Metadata Foto Progres' },
];

export function SettingsPage() {
  const { user, profile, backendMode, saveProfile, logout } = useOwnerProfile();
  const { products, productHistory, routines, routineLogs, skinJournals, hairJournals, photos } =
    useTrackerData();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [timezone, setTimezone] = useState(profile?.timezone || DEFAULT_TIMEZONE);
  const [skinType, setSkinType] = useState(profile?.skin_type ?? '');
  const [hairType, setHairType] = useState(profile?.hair_type ?? '');
  const [remindersEnabled, setRemindersEnabled] = useState(profile?.reminders_enabled ?? true);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(
    profile?.browser_notifications_enabled ?? false,
  );
  const [compactMode, setCompactMode] = useState(profile?.compact_mode ?? false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Web Push (VAPID) state
  const pushSupported = isWebPushSupported();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied',
  );
  const [pushStatus, setPushStatus] = useState<PushStatusInfo | null>(null);
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [selectedDatasets, setSelectedDatasets] = useState<ExportDatasetKey[]>([
    'products',
    'routines',
    'skin_journals',
    'hair_journals',
    'photos',
  ]);

  const loadPushState = useCallback(async () => {
    try {
      const [status, currentSub] = await Promise.all([
        fetchPushStatus(),
        getCurrentDevicePushSubscription(),
      ]);
      setPushStatus(status);
      setDeviceSubscribed(Boolean(currentSub));
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotifPermission(Notification.permission);
      }
    } catch {
      // Ignore silent push status refresh error
    }
  }, []);

  useEffect(() => {
    void loadPushState();
  }, [loadPushState]);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setTimezone(profile.timezone || DEFAULT_TIMEZONE);
    setSkinType(profile.skin_type ?? '');
    setHairType(profile.hair_type ?? '');
    setRemindersEnabled(profile.reminders_enabled ?? true);
    setBrowserNotificationsEnabled(profile.browser_notifications_enabled ?? false);
    setCompactMode(profile.compact_mode ?? false);
  }, [profile]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Nama tampilan tidak boleh kosong.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await saveProfile({
        full_name: fullName.trim(),
        timezone,
        skin_type: skinType.trim() || null,
        hair_type: hairType.trim() || null,
        reminders_enabled: remindersEnabled,
        browser_notifications_enabled: browserNotificationsEnabled,
        compact_mode: compactMode,
      });
      setMessage('Pengaturan pribadi dan preferensi berhasil disimpan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak dapat memperbarui pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubscribeWebPush = async () => {
    setPushBusy(true);
    setPushFeedback(null);
    setPushError(null);
    try {
      await subscribeCurrentDeviceToWebPush();
      setBrowserNotificationsEnabled(true);
      await saveProfile({ browser_notifications_enabled: true });
      await loadPushState();
      setPushFeedback(
        'Perangkat berhasil didaftarkan ke Web Push (VAPID). Pengingat rutinitas akan dikirim otomatis oleh server sesuai jam yang Anda atur.',
      );
    } catch (err) {
      setPushError(
        err instanceof Error
          ? err.message
          : 'Gagal mengaktifkan langganan Web Push pada perangkat ini.',
      );
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotifPermission(Notification.permission);
      }
    } finally {
      setPushBusy(false);
    }
  };

  const handleUnsubscribeWebPush = async () => {
    setPushBusy(true);
    setPushFeedback(null);
    setPushError(null);
    try {
      await unsubscribeCurrentDeviceFromWebPush();
      setDeviceSubscribed(false);
      await loadPushState();
      setPushFeedback('Langganan Web Push pada perangkat ini telah dinonaktifkan.');
    } catch (err) {
      setPushError(
        err instanceof Error ? err.message : 'Gagal menonaktifkan Web Push pada perangkat ini.',
      );
    } finally {
      setPushBusy(false);
    }
  };

  const handleSendTestPush = async () => {
    setPushBusy(true);
    setPushFeedback(null);
    setPushError(null);
    try {
      const res = await sendTestPushNotification();
      await loadPushState();
      if (res.sent > 0) {
        setPushFeedback(
          `Notifikasi uji Web Push dikirim ke ${res.sent} perangkat terdaftar melalui Service Worker.`,
        );
      } else {
        setPushError(
          res.lastError ||
            'Tidak ada perangkat aktif yang berhasil menerima notifikasi uji coba.',
        );
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Gagal mengirim notifikasi uji coba.');
    } finally {
      setPushBusy(false);
    }
  };

  const toggleDataset = (key: ExportDatasetKey) => {
    setSelectedDatasets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleExportJson = async () => {
    if (selectedDatasets.length === 0) return;
    setExporting(true);
    try {
      const raw = await exportAllUserData();
      const filtered: Record<string, unknown> = {
        exportedAt: raw.exportedAt,
        profile: raw.profile,
      };
      if (selectedDatasets.includes('products')) {
        filtered.products = raw.products;
        filtered.product_history = raw.product_history;
      }
      if (selectedDatasets.includes('routines')) {
        filtered.routines = raw.routines;
        filtered.routine_items = raw.routine_items;
        filtered.routine_logs = raw.routine_logs;
      }
      if (selectedDatasets.includes('skin_journals')) filtered.skin_journals = raw.skin_journals;
      if (selectedDatasets.includes('hair_journals')) filtered.hair_journals = raw.hair_journals;
      if (selectedDatasets.includes('photos')) filtered.journal_photos = raw.journal_photos;

      triggerTextDownload(
        `personal-care-tracker-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(filtered, null, 2),
        'application/json',
      );
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    if (selectedDatasets.includes('products')) {
      triggerTextDownload(
        `caretracker-produk-${dateStamp}.csv`,
        buildProductsCsv(products),
        'text/csv;charset=utf-8',
      );
    }
    if (selectedDatasets.includes('routines')) {
      triggerTextDownload(
        `caretracker-rutinitas-log-${dateStamp}.csv`,
        buildRoutinesAndLogsCsv(routines, routineLogs),
        'text/csv;charset=utf-8',
      );
    }
    if (selectedDatasets.includes('skin_journals')) {
      triggerTextDownload(
        `caretracker-catatan-wajah-${dateStamp}.csv`,
        buildSkinJournalsCsv(skinJournals),
        'text/csv;charset=utf-8',
      );
    }
    if (selectedDatasets.includes('hair_journals')) {
      triggerTextDownload(
        `caretracker-catatan-rambut-${dateStamp}.csv`,
        buildHairJournalsCsv(hairJournals),
        'text/csv;charset=utf-8',
      );
    }
  };

  const handleExportPdf = () => {
    if (selectedDatasets.length === 0) return;
    buildSummaryPdf({
      profile,
      products,
      productHistory,
      routines,
      routineLogs,
      skinJournals,
      hairJournals,
      photos,
      selectedDatasets,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Profile & Display Preferences */}
      <form
        onSubmit={handleSave}
        className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-6"
      >
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#E2E7DF]">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-[#78917A]" />
            <h2 className="font-display text-base font-semibold text-[#344A3A]">
              Profil Pribadi &amp; Zona Waktu
            </h2>
          </div>
          {user?.email && <span className="text-xs text-[#8A918A] truncate">{user.email}</span>}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[#FDF2F1] border border-[#EBCAC6] text-xs text-[#A94438]">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3 rounded-xl bg-[#E7EDE5] border border-[#C6D5C2] text-xs text-[#344A3A]">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-name" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Nama Tampilan
            </label>
            <input
              id="settings-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
            />
          </div>

          <div>
            <label htmlFor="settings-tz" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Zona Waktu Lokal
            </label>
            <select
              id="settings-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-skin" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Profil Kulit (opsional)
            </label>
            <input
              id="settings-skin"
              type="text"
              value={skinType}
              onChange={(e) => setSkinType(e.target.value)}
              placeholder="cth. Kombinasi, rentan berjerawat"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
            />
          </div>

          <div>
            <label htmlFor="settings-hair" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Profil Rambut &amp; Kulit Kepala (opsional)
            </label>
            <input
              id="settings-hair"
              type="text"
              value={hairType}
              onChange={(e) => setHairType(e.target.value)}
              placeholder="cth. Helai halus, kulit kepala berminyak"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
            />
          </div>
        </div>

        {/* Reminders & Display */}
        <div className="pt-4 border-t border-[#E2E7DF] space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#344A3A]">
            <Bell className="w-4 h-4 text-[#78917A]" />
            <span>Preferensi Pengingat Rutinitas</span>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#344A3A]">
            <input
              type="checkbox"
              checked={remindersEnabled}
              onChange={(e) => setRemindersEnabled(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#78917A]"
            />
            <span>
              <strong>Aktifkan pengingat jadwal rutinitas</strong> — berlaku untuk pengingat di dalam
              aplikasi maupun pengiriman Web Push otomatis sesuai jam masing-masing rutinitas.
            </span>
          </label>
        </div>

        {/* Display Mode */}
        <div className="pt-4 border-t border-[#E2E7DF] space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#344A3A]">
            <Sliders className="w-4 h-4 text-[#78917A]" />
            <span>Tampilan Antarmuka</span>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#344A3A]">
            <input
              type="checkbox"
              checked={compactMode}
              onChange={(e) => setCompactMode(e.target.checked)}
              className="w-4 h-4 accent-[#78917A]"
            />
            <span>Mode tata letak ringkas (mengurangi jarak antar bagian di layar)</span>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[40px] px-5 py-2 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>

      {/* Web Push VAPID Notifications */}
      <section className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E2E7DF]">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-[#78917A]" />
            <h2 className="font-display text-base font-semibold text-[#344A3A]">
              Notifikasi Push Ponsel &amp; PWA (Web Push VAPID)
            </h2>
          </div>
          <span className="text-xs text-[#8A918A] tabular-nums">
            {pushStatus ? `${pushStatus.subscriptionCount} perangkat aktif` : 'Memeriksa...'}
          </span>
        </div>

        <p className="text-xs text-[#616C62] leading-relaxed">
          Aktifkan Web Push pada ponsel atau desktop agar server mengirimkan notifikasi pop-up langsung
          ke Service Worker tepat pada jam pengingat rutinitas Anda—meskipun tab browser atau aplikasi
          PWA sedang ditutup.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]">
            <p className="text-[#8A918A]">Dukungan Browser</p>
            <p className="font-medium text-[#344A3A] mt-0.5">
              {pushSupported ? 'Didukung (Service Worker + Push)' : 'Tidak didukung di browser ini'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]">
            <p className="text-[#8A918A]">Izin Notifikasi</p>
            <p className="font-medium text-[#344A3A] mt-0.5">
              {!pushSupported
                ? 'Tidak tersedia'
                : notifPermission === 'granted'
                  ? 'Diizinkan'
                  : notifPermission === 'denied'
                    ? 'Diblokir oleh browser'
                    : 'Belum diminta'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]">
            <p className="text-[#8A918A]">Status Perangkat Ini</p>
            <p className="font-medium text-[#344A3A] mt-0.5">
              {deviceSubscribed ? 'Terdaftar menerima Push' : 'Belum terdaftar'}
            </p>
          </div>
        </div>

        {pushError && (
          <div className="p-3 rounded-xl bg-[#FDF2F1] border border-[#EBCAC6] text-xs text-[#A94438]">
            {pushError}
          </div>
        )}
        {pushFeedback && (
          <div className="p-3 rounded-xl bg-[#E7EDE5] border border-[#C6D5C2] text-xs text-[#344A3A]">
            {pushFeedback}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          {!deviceSubscribed ? (
            <button
              type="button"
              disabled={pushBusy || !pushSupported}
              onClick={() => void handleSubscribeWebPush()}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#78917A] text-white text-xs font-medium hover:bg-[#678069] disabled:opacity-45"
            >
              <Bell className="w-4 h-4" />
              {pushBusy ? 'Memproses...' : 'Aktifkan Notifikasi Push'}
            </button>
          ) : (
            <button
              type="button"
              disabled={pushBusy}
              onClick={() => void handleUnsubscribeWebPush()}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E2E7DF] bg-white text-xs font-medium text-[#344A3A] hover:bg-[#F8F9F6] disabled:opacity-45"
            >
              <BellOff className="w-4 h-4 text-[#A94438]" />
              {pushBusy ? 'Memproses...' : 'Nonaktifkan di Perangkat Ini'}
            </button>
          )}

          <button
            type="button"
            disabled={pushBusy || !pushStatus || pushStatus.subscriptionCount === 0}
            onClick={() => void handleSendTestPush()}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E2E7DF] bg-[#F8F9F6] text-xs font-medium text-[#344A3A] hover:bg-[#E7EDE5] disabled:opacity-45"
          >
            <Send className="w-3.5 h-3.5 text-[#78917A]" />
            Kirim Notifikasi Push Uji Coba
          </button>
        </div>

        {pushStatus && pushStatus.subscriptions.length > 0 && (
          <div className="pt-2 border-t border-[#E2E7DF] space-y-1.5">
            <p className="text-xs font-medium text-[#616C62]">Perangkat Push Terdaftar:</p>
            {pushStatus.subscriptions.map((sub) => (
              <p key={sub.id} className="text-xs text-[#8A918A] font-mono truncate">
                {sub.endpointPreview}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* PWA Install Section */}
      <section className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#E2E7DF]">
          <Smartphone className="w-4 h-4 text-[#78917A]" />
          <h2 className="font-display text-base font-semibold text-[#344A3A]">
            Pasang Sebagai Aplikasi (PWA)
          </h2>
        </div>
        <p className="text-xs text-[#616C62] leading-relaxed">
          Pasang Personal Care Tracker di layar utama ponsel atau desktop agar lebih cepat dibuka
          setiap hari dan siap menerima notifikasi Web Push.
        </p>
        <PWAInstallButton />
      </section>

      {/* Export Data Multi-Format */}
      <section className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-4">
        <div className="pb-3 border-b border-[#E2E7DF]">
          <h2 className="font-display text-base font-semibold text-[#344A3A]">
            Ekspor &amp; Cadangan Data
          </h2>
          <p className="text-xs text-[#8A918A] mt-0.5">
            Pilih jenis data yang ingin diekspor sebagai cadangan JSON, tabel CSV, atau ringkasan PDF.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {DATASET_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[#E2E7DF] bg-[#F8F9F6] cursor-pointer text-xs text-[#344A3A]"
            >
              <input
                type="checkbox"
                checked={selectedDatasets.includes(opt.key)}
                onChange={() => toggleDataset(opt.key)}
                className="w-4 h-4 accent-[#78917A]"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          <button
            type="button"
            disabled={exporting || selectedDatasets.length === 0}
            onClick={() => void handleExportJson()}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E2E7DF] bg-white text-xs font-medium text-[#344A3A] hover:bg-[#F8F9F6] disabled:opacity-45"
          >
            <Download className="w-4 h-4 text-[#78917A]" />
            {exporting ? 'Menyiapkan...' : 'Ekspor JSON'}
          </button>

          <button
            type="button"
            disabled={
              !selectedDatasets.some((k) =>
                ['products', 'routines', 'skin_journals', 'hair_journals'].includes(k),
              )
            }
            onClick={handleExportCsv}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E2E7DF] bg-white text-xs font-medium text-[#344A3A] hover:bg-[#F8F9F6] disabled:opacity-45"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#78917A]" />
            Ekspor CSV (Spreadsheet)
          </button>

          <button
            type="button"
            disabled={selectedDatasets.length === 0}
            onClick={handleExportPdf}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#78917A] text-white text-xs font-medium hover:bg-[#678069] disabled:opacity-45"
          >
            <FileText className="w-4 h-4" />
            Unduh Ringkasan PDF
          </button>
        </div>
      </section>

      {/* Server-Side Storage & Auth Security */}
      <section className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#E2E7DF]">
          <Database className="w-4 h-4 text-[#78917A]" />
          <h2 className="font-display text-base font-semibold text-[#344A3A]">
            Penyimpanan Server, Autentikasi &amp; Keamanan Akun
          </h2>
        </div>

        <div className="text-xs text-[#344A3A] space-y-2 leading-relaxed">
          <p>
            Akun aktif: <span className="font-semibold">{user?.email || '—'}</span> · Penyimpanan:{' '}
            <span className="font-semibold">
              {backendMode === 'supabase'
                ? 'Supabase PostgreSQL & Storage Privat (Server-Side)'
                : 'Brankas Lokal Server (.data/vault.json)'}
            </span>
          </p>
          <p className="text-[#616C62]">
            Seluruh rute data dilindungi oleh sesi login HTTP-only cookie dan terisolasi per akun.
            Kunci layanan Supabase maupun kunci privat VAPID hanya disimpan di server. Apabila memakai
            Supabase di produksi, jalankan migrasi hingga{' '}
            <code className="font-mono text-[11px] bg-[#F8F9F6] px-1 py-0.5 rounded border border-[#E2E7DF]">
              supabase/migrations/0003_auth_and_web_push.sql
            </code>{' '}
            dan atur{' '}
            <code className="font-mono text-[11px] bg-[#F8F9F6] px-1 py-0.5 rounded border border-[#E2E7DF]">
              SESSION_SECRET
            </code>{' '}
            serta pasangan{' '}
            <code className="font-mono text-[11px] bg-[#F8F9F6] px-1 py-0.5 rounded border border-[#E2E7DF]">
              VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
            </code>{' '}
            di Secrets server.
          </p>
          <div className="p-3 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF] flex items-start gap-2 text-[#616C62]">
            <ShieldCheck className="w-4 h-4 text-[#78917A] shrink-0 mt-0.5" />
            <span>
              Status kunci VAPID saat ini:{' '}
              <strong>
                {pushStatus?.vapidSource === 'env'
                  ? 'Dikonfigurasi permanen melalui Secrets lingkungan server'
                  : 'Otomatis lokal (.data/server-secrets.json) — isi Secrets VAPID untuk produksi Cloud Run'}
              </strong>
              .
            </span>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => void logout()}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#EBCAC6] bg-[#FDF2F1] text-xs font-medium text-[#A94438] hover:bg-[#F9E3E0]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar dari Akun
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
