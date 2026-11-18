import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Package,
  Plus,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { useOwnerProfile } from '../hooks/useOwnerProfile';
import { useTrackerData } from '../hooks/useTrackerData';
import {
  formatLongLocalDate,
  formatShortDate,
  formatTime12h,
  getGreetingForTimezone,
  getLocalDateString,
} from '../lib/utils/date';
import {
  calculateRoutineProgressForDate,
  findLatestLogForRoutine,
  isRoutineScheduledOnDate,
} from '../lib/utils/insights';
import {
  ACNE_TYPE_OPTIONS,
  CARE_AREA_LABELS,
  DEFAULT_TIMEZONE,
  ROUTINE_COMPLETION_LABELS,
  SCALP_CONDITION_OPTIONS,
  SHEDDING_OPTIONS,
  getOptionLabel,
} from '../lib/utils/constants';
import type { AppRoute, RoutineCompletionStatus } from '../types/database';

interface DashboardPageProps {
  onNavigate: (route: AppRoute, options?: { journalTab?: 'face' | 'hair' }) => void;
  onOpenAddProduct: () => void;
}

export function DashboardPage({ onNavigate, onOpenAddProduct }: DashboardPageProps) {
  const { profile } = useOwnerProfile();
  const {
    products,
    routines,
    routineLogs,
    skinJournals,
    hairJournals,
    loading,
    recordRoutineLog,
  } = useTrackerData();

  const [loggingId, setLoggingId] = useState<string | null>(null);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const today = getLocalDateString(now, timeZone);

  const activeProducts = products.filter((p) => p.status === 'active');
  const todayScheduledRoutines = routines
    .filter((r) => isRoutineScheduledOnDate(r, today))
    .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

  const todayStats = calculateRoutineProgressForDate(routines, routineLogs, today);
  const todayRootLogs = routineLogs.filter(
    (l) => l.log_date === today && l.routine_item_id === null,
  );

  const pendingRoutines = todayScheduledRoutines.filter(
    (r) => !findLatestLogForRoutine(todayRootLogs, r.id),
  );
  const completedOrLoggedRoutines = todayScheduledRoutines.filter((r) =>
    Boolean(findLatestLogForRoutine(todayRootLogs, r.id)),
  );

  const latestSkin = skinJournals[0] ?? null;
  const latestHair = hairJournals[0] ?? null;

  const isBrandNewUser =
    products.length === 0 &&
    routines.length === 0 &&
    skinJournals.length === 0 &&
    hairJournals.length === 0;

  const handleLogRoutine = async (routineId: string, status: RoutineCompletionStatus) => {
    setLoggingId(routineId);
    try {
      await recordRoutineLog({
        routine_id: routineId,
        routine_item_id: null,
        log_date: today,
        status,
      });
    } finally {
      setLoggingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-white border border-[#E2E7DF] rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="h-28 bg-white border border-[#E2E7DF] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Greeting & Date Header */}
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs text-[#8A918A] tabular-nums">
            {formatLongLocalDate(now, timeZone)} · {timeZone}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#344A3A] mt-1 tracking-tight">
            {getGreetingForTimezone(profile?.full_name || 'Anda', now, timeZone)}
          </h2>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenAddProduct}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Produk
          </button>
          <button
            type="button"
            onClick={() => onNavigate('journal', { journalTab: 'face' })}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E2E7DF] text-sm font-medium text-[#344A3A] hover:bg-[#E7EDE5]/50 transition-colors whitespace-nowrap"
          >
            Catat Kondisi Wajah
          </button>
          <button
            type="button"
            onClick={() => onNavigate('journal', { journalTab: 'hair' })}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E2E7DF] text-sm font-medium text-[#344A3A] hover:bg-[#E7EDE5]/50 transition-colors whitespace-nowrap"
          >
            Catat Kondisi Rambut
          </button>
          <button
            type="button"
            onClick={() => onNavigate('routine')}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E2E7DF] text-sm font-medium text-[#344A3A] hover:bg-[#E7EDE5]/50 transition-colors whitespace-nowrap"
          >
            Selesaikan Rutinitas
          </button>
        </div>
      </section>

      {/* Helpful Empty State for New Users */}
      {isBrandNewUser && (
        <section className="bg-white border border-[#E2E7DF] rounded-2xl p-6 sm:p-8">
          <h3 className="font-display text-lg font-semibold text-[#344A3A]">
            Mulai bangun catatan perawatan pribadi Anda
          </h3>
          <p className="text-sm text-[#616C62] mt-1 max-w-2xl leading-relaxed">
            Ruang kerja Anda dimulai dari kondisi bersih tanpa data buatan. Ikuti tiga langkah
            berikut untuk mencatat dasar kondisi kulit dan rambut Anda secara akurat.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2E7DF] mt-6 border-t border-[#E2E7DF] pt-5">
            <div className="py-4 md:py-0 md:pr-6 flex flex-col justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#78917A]">01. Rak Produk</p>
                <p className="text-sm font-semibold text-[#344A3A] mt-1">
                  Tambahkan produk yang sedang dipakai
                </p>
                <p className="text-xs text-[#616C62] mt-1">
                  Catat kapan Anda mulai menggunakan pembersih wajah, pelembap, serum, atau sampo.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenAddProduct}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#344A3A] hover:text-[#78917A] whitespace-nowrap"
              >
                Tambah produk pertama <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="py-4 md:py-0 md:px-6 flex flex-col justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#78917A]">02. Jadwal Harian</p>
                <p className="text-sm font-semibold text-[#344A3A] mt-1">
                  Atur rutinitas wajah &amp; rambut
                </p>
                <p className="text-xs text-[#616C62] mt-1">
                  Susun rutinitas pagi, malam, dan jadwal keramas dengan pencatatan manual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('routine')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#344A3A] hover:text-[#78917A] whitespace-nowrap"
              >
                Buat rutinitas <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="py-4 md:py-0 md:pl-6 flex flex-col justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#78917A]">03. Catatan Pengamatan</p>
                <p className="text-sm font-semibold text-[#344A3A] mt-1">
                  Catat kondisi awal hari ini
                </p>
                <p className="text-xs text-[#616C62] mt-1">
                  Luangkan 1–2 menit mencatat kondisi kulit dan kulit kepala beserta foto opsional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('journal', { journalTab: 'face' })}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#344A3A] hover:text-[#78917A] whitespace-nowrap"
              >
                Buka Catatan Harian <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 4-Column Summary Strip (Real Data Only) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#8A918A]">
            <span>Progres Rutinitas Hari Ini</span>
            <CalendarCheck className="w-4 h-4 text-[#78917A]" />
          </div>
          <p className="font-display text-2xl font-semibold text-[#344A3A] mt-3 tabular-nums">
            {todayStats.scheduledCount > 0
              ? `${todayStats.completedCount} / ${todayStats.scheduledCount}`
              : '0 terjadwal'}
          </p>
          <p className="text-xs text-[#8A918A] mt-1 tabular-nums">
            {todayStats.scheduledCount > 0
              ? `${todayStats.completionRatePercent}% selesai · ${todayStats.pendingCount} menunggu`
              : 'Belum ada rutinitas terjadwal hari ini'}
          </p>
        </div>

        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#8A918A]">
            <span>Produk Aktif</span>
            <Package className="w-4 h-4 text-[#78917A]" />
          </div>
          <p className="font-display text-2xl font-semibold text-[#344A3A] mt-3 tabular-nums">
            {activeProducts.length}
          </p>
          <p className="text-xs text-[#8A918A] mt-1 tabular-nums">
            {products.length === 0
              ? 'Belum ada produk ditambahkan'
              : `${activeProducts.filter((p) => p.care_area === 'face').length} wajah · ${
                  activeProducts.filter((p) => p.care_area === 'hair').length
                } rambut`}
          </p>
        </div>

        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#8A918A]">
            <span>Kondisi Kulit Terbaru</span>
            <BookOpen className="w-4 h-4 text-[#78917A]" />
          </div>
          {latestSkin ? (
            <>
              <p className="font-display text-2xl font-semibold text-[#344A3A] mt-3 tabular-nums">
                {latestSkin.acne_severity}/10
              </p>
              <p className="text-xs text-[#8A918A] mt-1 truncate">
                {formatShortDate(latestSkin.entry_date)} ·{' '}
                {getOptionLabel(ACNE_TYPE_OPTIONS, latestSkin.acne_type)}
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-medium text-[#344A3A] mt-3">Belum ada catatan</p>
              <p className="text-xs text-[#8A918A] mt-1">Catat pengamatan wajah pertama</p>
            </>
          )}
        </div>

        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#8A918A]">
            <span>Kondisi Rambut Terbaru</span>
            <BookOpen className="w-4 h-4 text-[#78917A]" />
          </div>
          {latestHair ? (
            <>
              <p className="font-display text-xl font-semibold text-[#344A3A] mt-3">
                Kulit kepala {getOptionLabel(SCALP_CONDITION_OPTIONS, latestHair.scalp_condition).toLowerCase()}
              </p>
              <p className="text-xs text-[#8A918A] mt-1 truncate">
                {formatShortDate(latestHair.entry_date)} · Rontok:{' '}
                {getOptionLabel(SHEDDING_OPTIONS, latestHair.shedding_level)}
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-medium text-[#344A3A] mt-3">Belum ada catatan</p>
              <p className="text-xs text-[#8A918A] mt-1">Catat kondisi kulit kepala &amp; rambut</p>
            </>
          )}
        </div>
      </section>

      {/* Today's Routine Activities & Upcoming Reminders */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#E2E7DF] rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E2E7DF]">
            <div>
              <h3 className="font-display text-base font-semibold text-[#344A3A]">
                Rutinitas Hari Ini
              </h3>
              <p className="text-xs text-[#8A918A] mt-0.5">
                Aktivitas tetap berstatus menunggu hingga Anda menandainya selesai, dilewati, atau terlewat secara manual.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('routine')}
              className="text-xs font-medium text-[#78917A] hover:text-[#344A3A] whitespace-nowrap"
            >
              Kelola rutinitas
            </button>
          </div>

          {todayScheduledRoutines.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#616C62]">Belum ada rutinitas yang dijadwalkan hari ini.</p>
              <button
                type="button"
                onClick={() => onNavigate('routine')}
                className="mt-3 px-4 py-2 rounded-xl border border-[#E2E7DF] text-xs font-medium text-[#344A3A] hover:bg-[#F8F9F6]"
              >
                Buat rutinitas
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E7DF]">
              {todayScheduledRoutines.map((routine) => {
                const log = findLatestLogForRoutine(todayRootLogs, routine.id);
                const busy = loggingId === routine.id;
                return (
                  <div
                    key={routine.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-[#344A3A]">
                        <span>{routine.name}</span>
                        <span className="text-xs font-normal text-[#8A918A] tabular-nums">
                          · {formatTime12h(routine.scheduled_time)}
                        </span>
                      </div>
                      <p className="text-xs text-[#8A918A] mt-0.5">
                        {CARE_AREA_LABELS[routine.care_area]} · {routine.items?.length ?? 0} langkah
                        {log
                          ? ` · Ditandai ${ROUTINE_COMPLETION_LABELS[log.status]}`
                          : ' · Menunggu'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleLogRoutine(routine.id, 'completed')}
                        className={`min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                          log?.status === 'completed'
                            ? 'bg-[#E7EDE5] border-[#78917A] text-[#344A3A]'
                            : 'bg-white border-[#E2E7DF] text-[#344A3A] hover:bg-[#F8F9F6]'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#78917A]" />
                        Selesai
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleLogRoutine(routine.id, 'skipped')}
                        className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                          log?.status === 'skipped'
                            ? 'bg-[#F3EFE6] border-[#B7791F] text-[#744E12]'
                            : 'bg-white border-[#E2E7DF] text-[#616C62] hover:bg-[#F8F9F6]'
                        }`}
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        Lewati
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleLogRoutine(routine.id, 'missed')}
                        className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                          log?.status === 'missed'
                            ? 'bg-[#FDF2F1] border-[#A94438] text-[#A94438]'
                            : 'bg-white border-[#E2E7DF] text-[#616C62] hover:bg-[#F8F9F6]'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Terlewat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Reminders & Recent Activity */}
        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-5">
          <div className="pb-4 border-b border-[#E2E7DF]">
            <h3 className="font-display text-base font-semibold text-[#344A3A]">
              Jadwal Menunggu
            </h3>
            <p className="text-xs text-[#8A918A] mt-0.5">
              Rutinitas terjadwal yang belum dicatat hari ini
            </p>
          </div>

          {pendingRoutines.length === 0 ? (
            <p className="text-xs text-[#8A918A] leading-relaxed">
              {todayScheduledRoutines.length > 0
                ? 'Semua rutinitas terjadwal hari ini sudah dicatat.'
                : 'Tidak ada pengingat rutinitas hari ini.'}
            </p>
          ) : (
            <div className="space-y-3">
              {pendingRoutines.map((routine) => (
                <div
                  key={routine.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#344A3A] truncate">{routine.name}</p>
                    <p className="text-xs text-[#8A918A]">{CARE_AREA_LABELS[routine.care_area]}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#344A3A] tabular-nums shrink-0">
                    <Clock className="w-3.5 h-3.5 text-[#78917A]" />
                    {formatTime12h(routine.scheduled_time)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {completedOrLoggedRoutines.length > 0 && (
            <div className="pt-4 border-t border-[#E2E7DF]">
              <p className="text-xs font-medium text-[#8A918A] mb-2">Sudah dicatat hari ini</p>
              <ul className="space-y-1.5">
                {completedOrLoggedRoutines.map((r) => {
                  const log = findLatestLogForRoutine(todayRootLogs, r.id);
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between text-xs text-[#344A3A]"
                    >
                      <span className="truncate">{r.name}</span>
                      <span className="text-[#8A918A] shrink-0">
                        {log ? ROUTINE_COMPLETION_LABELS[log.status] : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
