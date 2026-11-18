import { useMemo, useState, type FormEvent } from 'react';
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  SkipForward,
  Trash2,
  XCircle,
} from 'lucide-react';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { Modal } from '../components/shared/Modal';
import { useOwnerProfile } from '../hooks/useOwnerProfile';
import { useTrackerData } from '../hooks/useTrackerData';
import {
  DAYS_OF_WEEK,
  DEFAULT_TIMEZONE,
  FACE_ROUTINE_TYPES,
  FREQUENCY_LABELS,
  HAIR_ROUTINE_TYPES,
  PRODUCT_STATUS_LABELS,
  ROUTINE_COMPLETION_LABELS,
  ROUTINE_TYPE_LABELS,
} from '../lib/utils/constants';
import { formatShortDate, formatTime12h, getLocalDateString } from '../lib/utils/date';
import {
  calculateRoutineProgressForDate,
  findLatestLogForRoutine,
  isRoutineScheduledOnDate,
} from '../lib/utils/insights';
import {
  hasValidationErrors,
  validateRoutineForm,
  type ValidationErrors,
} from '../lib/validations/forms';
import type {
  CareArea,
  FrequencyType,
  Routine,
  RoutineCompletionStatus,
  RoutineInput,
  RoutineType,
} from '../types/database';

const HISTORY_PAGE_SIZE = 20;

export function RoutinePage() {
  const { profile } = useOwnerProfile();
  const {
    routines,
    routineLogs,
    products,
    loading,
    addRoutine,
    editRoutine,
    removeRoutine,
    recordRoutineLog,
  } = useTrackerData();

  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const today = getLocalDateString(new Date(), timeZone);

  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<'schedule' | 'history'>('schedule');
  const [areaFilter, setAreaFilter] = useState<'all' | CareArea>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | RoutineCompletionStatus>('all');
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  // Routine Form state
  const [name, setName] = useState('');
  const [careArea, setCareArea] = useState<CareArea>('face');
  const [routineType, setRoutineType] = useState<RoutineType>('morning');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [intervalDays, setIntervalDays] = useState(2);
  const [intervalStartDate, setIntervalStartDate] = useState(today);
  const [scheduledTime, setScheduledTime] = useState('07:30');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('07:30');
  const [isEnabled, setIsEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<
    Array<{ product_id: string | null; title: string; instructions: string }>
  >([{ product_id: null, title: '', instructions: '' }]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const openCreateModal = (defaultArea: CareArea = 'face') => {
    setEditingRoutine(null);
    setCareArea(defaultArea);
    setRoutineType(defaultArea === 'face' ? 'morning' : 'shampoo');
    setName('');
    setFrequencyType(defaultArea === 'face' ? 'daily' : 'interval');
    setDaysOfWeek(defaultArea === 'face' ? [0, 1, 2, 3, 4, 5, 6] : [1, 4]);
    setIntervalDays(defaultArea === 'face' ? 2 : 3);
    setIntervalStartDate(today);
    const defaultTime = defaultArea === 'face' ? '07:30' : '20:00';
    setScheduledTime(defaultTime);
    setReminderEnabled(true);
    setReminderTime(defaultTime);
    setIsEnabled(true);
    setNotes('');
    setItems([{ product_id: null, title: '', instructions: '' }]);
    setErrors({});
    setModalOpen(true);
  };

  const openEditModal = (routine: Routine) => {
    setEditingRoutine(routine);
    setCareArea(routine.care_area);
    setRoutineType(routine.routine_type);
    setName(routine.name);
    setFrequencyType(routine.frequency_type);
    setDaysOfWeek(routine.days_of_week);
    setIntervalDays(routine.interval_days ?? 2);
    setIntervalStartDate(routine.interval_start_date ?? routine.created_at.slice(0, 10));
    const time = routine.scheduled_time.slice(0, 5);
    setScheduledTime(time);
    setReminderEnabled(routine.reminder_enabled ?? false);
    setReminderTime((routine.reminder_time || time).slice(0, 5));
    setIsEnabled(routine.is_enabled);
    setNotes(routine.notes);
    setItems(
      routine.items && routine.items.length > 0
        ? routine.items.map((item) => ({
            product_id: item.product_id,
            title: item.title,
            instructions: item.instructions,
          }))
        : [{ product_id: null, title: '', instructions: '' }],
    );
    setErrors({});
    setModalOpen(true);
  };

  const handleSaveRoutine = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const payload: RoutineInput = {
      name: name.trim(),
      care_area: careArea,
      routine_type: routineType,
      frequency_type: frequencyType,
      days_of_week: frequencyType === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : daysOfWeek,
      interval_days: frequencyType === 'interval' ? intervalDays : undefined,
      interval_start_date: frequencyType === 'interval' ? intervalStartDate : null,
      scheduled_time: scheduledTime,
      reminder_enabled: reminderEnabled,
      reminder_time: reminderEnabled ? reminderTime || scheduledTime : null,
      is_enabled: isEnabled,
      notes: notes.trim(),
      items: items.map((item) => ({
        product_id: item.product_id || null,
        title: item.title.trim(),
        instructions: item.instructions.trim(),
      })),
    };

    const val = validateRoutineForm(payload);
    setErrors(val);
    if (hasValidationErrors(val)) return;

    setSubmitting(true);
    try {
      if (editingRoutine) {
        await editRoutine(editingRoutine.id, payload);
      } else {
        await addRoutine(payload);
      }
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogStatus = async (
    routineId: string,
    status: RoutineCompletionStatus,
    routineItemId: string | null = null,
  ) => {
    const key = `${routineId}:${routineItemId ?? 'root'}`;
    setLoggingId(key);
    try {
      await recordRoutineLog({
        routine_id: routineId,
        routine_item_id: routineItemId,
        log_date: selectedDate,
        status,
      });
    } finally {
      setLoggingId(null);
    }
  };

  const toggleDay = (dayVal: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(dayVal) ? prev.filter((d) => d !== dayVal) : [...prev, dayVal].sort(),
    );
  };

  const filteredRoutines = useMemo(
    () => routines.filter((r) => (areaFilter === 'all' ? true : r.care_area === areaFilter)),
    [routines, areaFilter],
  );

  const faceRoutines = filteredRoutines.filter((r) => r.care_area === 'face');
  const hairRoutines = filteredRoutines.filter((r) => r.care_area === 'hair');

  const selectedDateProgress = useMemo(
    () => calculateRoutineProgressForDate(filteredRoutines, routineLogs, selectedDate),
    [filteredRoutines, routineLogs, selectedDate],
  );

  const logsForSelectedDate = routineLogs.filter((l) => l.log_date === selectedDate);
  const routineNameMap = new Map(routines.map((r) => [r.id, r]));
  const productNameMap = new Map(products.map((p) => [p.id, p]));

  const filteredHistoryLogs = useMemo(() => {
    return routineLogs.filter((log) => {
      if (historyStatusFilter !== 'all' && log.status !== historyStatusFilter) return false;
      if (areaFilter !== 'all') {
        const r = routineNameMap.get(log.routine_id);
        if (r && r.care_area !== areaFilter) return false;
      }
      return true;
    });
  }, [routineLogs, historyStatusFilter, areaFilter, routineNameMap]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await removeRoutine(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const renderFrequencyDescription = (routine: Routine) => {
    if (routine.frequency_type === 'weekly') {
      return `${FREQUENCY_LABELS.weekly} (${routine.days_of_week
        .map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.short)
        .join(', ')})`;
    }
    if (routine.frequency_type === 'interval') {
      return `Setiap ${routine.interval_days || 2} hari`;
    }
    return FREQUENCY_LABELS[routine.frequency_type];
  };

  const renderRoutineCard = (routine: Routine) => {
    const rootLog = findLatestLogForRoutine(
      logsForSelectedDate.filter((l) => l.routine_item_id === null),
      routine.id,
    );
    const scheduledForDate = isRoutineScheduledOnDate(routine, selectedDate);
    const rootBusy = loggingId === `${routine.id}:root`;

    return (
      <div
        key={routine.id}
        className={`bg-white border border-[#E2E7DF] rounded-2xl p-5 space-y-4 ${
          routine.is_enabled ? '' : 'opacity-70'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-display text-base font-semibold text-[#344A3A]">
                {routine.name}
              </h4>
              <span className="text-xs text-[#8A918A]">
                · {ROUTINE_TYPE_LABELS[routine.routine_type]}
              </span>
              {routine.reminder_enabled && routine.is_enabled && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#344A3A] bg-[#E7EDE5] px-2 py-0.5 rounded-md tabular-nums">
                  <Bell className="w-3 h-3 text-[#78917A]" />
                  {(routine.reminder_time || routine.scheduled_time).slice(0, 5)}
                </span>
              )}
            </div>
            <p className="text-xs text-[#8A918A] mt-1 tabular-nums">
              {formatTime12h(routine.scheduled_time)} · {renderFrequencyDescription(routine)}
              {!routine.is_enabled && ' · Nonaktif'}
              {routine.is_enabled && !scheduledForDate && ' · Tidak dijadwalkan pada tanggal ini'}
            </p>
            {routine.notes && <p className="text-xs text-[#616C62] mt-1">{routine.notes}</p>}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void editRoutine(routine.id, { is_enabled: !routine.is_enabled })}
              className="px-2.5 py-1.5 rounded-lg border border-[#E2E7DF] text-xs font-medium text-[#616C62] hover:text-[#344A3A] hover:bg-[#F8F9F6] whitespace-nowrap"
            >
              {routine.is_enabled ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
            <button
              type="button"
              aria-label={`Ubah ${routine.name}`}
              onClick={() => openEditModal(routine)}
              className="p-2 rounded-lg border border-[#E2E7DF] text-[#616C62] hover:text-[#344A3A] hover:bg-[#F8F9F6]"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Hapus ${routine.name}`}
              onClick={() => setDeleteTarget(routine)}
              className="p-2 rounded-lg border border-[#E2E7DF] text-[#A94438] hover:bg-[#FDF2F1]"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Steps & Linked Products */}
        {routine.items && routine.items.length > 0 && (
          <div className="divide-y divide-[#E2E7DF] border-t border-[#E2E7DF]">
            {routine.items.map((item, idx) => {
              const linkedProduct = item.product_id
                ? productNameMap.get(item.product_id)
                : undefined;
              const itemLog = logsForSelectedDate.find(
                (l) => l.routine_id === routine.id && l.routine_item_id === item.id,
              );
              return (
                <div
                  key={item.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#344A3A]">
                      <span className="text-xs text-[#8A918A] tabular-nums mr-1.5">
                        {idx + 1}.
                      </span>
                      {item.title}
                    </p>
                    <p className="text-xs text-[#8A918A] truncate">
                      {linkedProduct
                        ? `Produk: ${linkedProduct.name}`
                        : 'Tanpa produk terhubung'}
                      {item.instructions ? ` · ${item.instructions}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(['completed', 'skipped', 'missed'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void handleLogStatus(routine.id, status, item.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                          itemLog?.status === status
                            ? status === 'completed'
                              ? 'bg-[#E7EDE5] border-[#78917A] text-[#344A3A]'
                              : status === 'skipped'
                                ? 'bg-[#F3EFE6] border-[#B7791F] text-[#744E12]'
                                : 'bg-[#FDF2F1] border-[#A94438] text-[#A94438]'
                            : 'bg-white border-[#E2E7DF] text-[#616C62] hover:text-[#344A3A]'
                        }`}
                      >
                        {ROUTINE_COMPLETION_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Routine-level manual completion bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E2E7DF]">
          <p className="text-xs text-[#616C62] tabular-nums">
            Status pada {formatShortDate(selectedDate)}:{' '}
            <span className="font-medium text-[#344A3A]">
              {rootLog ? ROUTINE_COMPLETION_LABELS[rootLog.status] : 'Menunggu catatan manual'}
            </span>
            {rootLog?.completed_at && (
              <span className="text-[#8A918A]">
                {' '}
                · Dicatat{' '}
                {new Date(rootLog.completed_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={rootBusy}
              onClick={() => void handleLogStatus(routine.id, 'completed')}
              className={`min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                rootLog?.status === 'completed'
                  ? 'bg-[#E7EDE5] border-[#78917A] text-[#344A3A]'
                  : 'bg-white border-[#E2E7DF] text-[#344A3A] hover:bg-[#F8F9F6]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#78917A]" />
              Selesai
            </button>
            <button
              type="button"
              disabled={rootBusy}
              onClick={() => void handleLogStatus(routine.id, 'skipped')}
              className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                rootLog?.status === 'skipped'
                  ? 'bg-[#F3EFE6] border-[#B7791F] text-[#744E12]'
                  : 'bg-white border-[#E2E7DF] text-[#616C62] hover:bg-[#F8F9F6]'
              }`}
            >
              <SkipForward className="w-3.5 h-3.5" />
              Dilewati
            </button>
            <button
              type="button"
              disabled={rootBusy}
              onClick={() => void handleLogStatus(routine.id, 'missed')}
              className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                rootLog?.status === 'missed'
                  ? 'bg-[#FDF2F1] border-[#A94438] text-[#A94438]'
                  : 'bg-white border-[#E2E7DF] text-[#616C62] hover:bg-[#F8F9F6]'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Terlewat
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-[#E2E7DF]">
            <button
              type="button"
              onClick={() => setViewMode('schedule')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'schedule'
                  ? 'bg-[#E7EDE5] text-[#344A3A]'
                  : 'text-[#616C62] hover:text-[#344A3A]'
              }`}
            >
              Rutinitas &amp; Cek Harian
            </button>
            <button
              type="button"
              onClick={() => setViewMode('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'history'
                  ? 'bg-[#E7EDE5] text-[#344A3A]'
                  : 'text-[#616C62] hover:text-[#344A3A]'
              }`}
            >
              Riwayat Penyelesaian ({routineLogs.length})
            </button>
          </div>

          {viewMode === 'schedule' && (
            <div className="flex items-center gap-2">
              <label htmlFor="routine-log-date" className="text-xs text-[#8A918A]">
                Tanggal catatan:
              </label>
              <input
                id="routine-log-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E2E7DF] bg-white text-xs text-[#344A3A] tabular-nums"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-[#E2E7DF]">
            {(['all', 'face', 'hair'] as const).map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setAreaFilter(area)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  areaFilter === area
                    ? 'bg-[#E7EDE5] text-[#344A3A]'
                    : 'text-[#616C62] hover:text-[#344A3A]'
                }`}
              >
                {area === 'all' ? 'Semua' : area === 'face' ? 'Wajah' : 'Rambut'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openCreateModal(areaFilter === 'hair' ? 'hair' : 'face')}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Rutinitas Baru
          </button>
        </div>
      </div>

      {/* Daily Progress Summary Bar */}
      {viewMode === 'schedule' && !loading && routines.length > 0 && (
        <section className="bg-white border border-[#E2E7DF] rounded-2xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#344A3A]">
                Progres {formatShortDate(selectedDate)}
              </h2>
              <p className="text-xs text-[#8A918A] mt-0.5 tabular-nums">
                {selectedDateProgress.scheduledCount > 0
                  ? `${selectedDateProgress.completedCount} selesai · ${selectedDateProgress.skippedCount} dilewati · ${selectedDateProgress.missedCount} terlewat · ${selectedDateProgress.pendingCount} menunggu`
                  : 'Tidak ada rutinitas terjadwal tetap pada tanggal ini (Anda tetap dapat mencatat rutinitas sesuai kebutuhan).'}
              </p>
            </div>
            <p className="font-display text-lg font-semibold text-[#344A3A] tabular-nums">
              {selectedDateProgress.completionRatePercent !== null
                ? `${selectedDateProgress.completionRatePercent}% selesai`
                : '—'}
            </p>
          </div>
          {selectedDateProgress.scheduledCount > 0 && (
            <div className="h-2.5 w-full bg-[#E7EDE5] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#78917A] transition-all duration-300"
                style={{ width: `${selectedDateProgress.completionRatePercent ?? 0}%` }}
              />
            </div>
          )}
        </section>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-32 bg-white border border-[#E2E7DF] rounded-2xl" />
          <div className="h-32 bg-white border border-[#E2E7DF] rounded-2xl" />
        </div>
      ) : viewMode === 'history' ? (
        <div className="bg-white border border-[#E2E7DF] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E7DF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-[#344A3A]">
                Riwayat Penyelesaian Rutinitas
              </h3>
              <p className="text-xs text-[#8A918A]">
                Catatan historis tetap tersimpan meskipun jadwal rutinitas diperbarui di kemudian hari.
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]">
              {(['all', 'completed', 'skipped', 'missed'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setHistoryStatusFilter(status);
                    setHistoryLimit(HISTORY_PAGE_SIZE);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                    historyStatusFilter === status
                      ? 'bg-white text-[#344A3A] shadow-xs'
                      : 'text-[#616C62]'
                  }`}
                >
                  {status === 'all' ? 'Semua' : ROUTINE_COMPLETION_LABELS[status]}
                </button>
              ))}
            </div>
          </div>

          {filteredHistoryLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#8A918A]">
              Belum ada catatan penyelesaian rutinitas yang sesuai dengan filter.
            </div>
          ) : (
            <>
              <div className="divide-y divide-[#E2E7DF]">
                {filteredHistoryLogs.slice(0, historyLimit).map((log) => {
                  const routine = routineNameMap.get(log.routine_id);
                  return (
                    <div
                      key={log.id}
                      className="px-6 py-3 flex items-center justify-between gap-4 text-sm"
                    >
                      <div>
                        <p className="font-medium text-[#344A3A]">
                          {routine?.name ?? 'Rutinitas dihapus'}
                          {log.routine_item_id ? ' · Cek langkah' : ''}
                        </p>
                        <p className="text-xs text-[#8A918A] tabular-nums">
                          Tanggal: {formatShortDate(log.log_date)} · Dicatat{' '}
                          {new Date(log.completed_at || log.created_at).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          log.status === 'completed'
                            ? 'text-[#344A3A]'
                            : log.status === 'skipped'
                              ? 'text-[#8C6219]'
                              : 'text-[#A94438]'
                        }`}
                      >
                        {ROUTINE_COMPLETION_LABELS[log.status]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {filteredHistoryLogs.length > historyLimit && (
                <div className="p-4 border-t border-[#E2E7DF] text-center">
                  <button
                    type="button"
                    onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE_SIZE)}
                    className="px-4 py-2 rounded-xl border border-[#E2E7DF] text-xs font-medium text-[#344A3A] hover:bg-[#F8F9F6]"
                  >
                    Muat lebih banyak ({filteredHistoryLogs.length - historyLimit} tersisa)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : routines.length === 0 ? (
        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-10 text-center">
          <div className="w-11 h-11 rounded-2xl bg-[#E7EDE5] flex items-center justify-center mx-auto mb-3">
            <CalendarCheck className="w-5 h-5 text-[#344A3A]" />
          </div>
          <h3 className="font-display text-base font-semibold text-[#344A3A]">
            Belum ada rutinitas dibuat
          </h3>
          <p className="text-sm text-[#8A918A] mt-1 max-w-md mx-auto">
            Atur jadwal perawatan wajah pagi/malam atau jadwal keramas, kondisioner, hair tonic, dan
            hair mask, lalu hubungkan produk Anda pada setiap langkah.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            <button
              type="button"
              onClick={() => openCreateModal('face')}
              className="px-4 py-2.5 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069]"
            >
              Buat Rutinitas Wajah
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('hair')}
              className="px-4 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm font-medium text-[#344A3A] hover:bg-[#F8F9F6]"
            >
              Buat Rutinitas Rambut
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {(areaFilter === 'all' || areaFilter === 'face') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-[#344A3A]">
                  Rutinitas Perawatan Wajah
                </h3>
                <button
                  type="button"
                  onClick={() => openCreateModal('face')}
                  className="text-xs font-medium text-[#78917A] hover:text-[#344A3A]"
                >
                  + Tambah rutinitas wajah
                </button>
              </div>
              {faceRoutines.length === 0 ? (
                <p className="text-xs text-[#8A918A]">Belum ada rutinitas perawatan wajah.</p>
              ) : (
                <div className="space-y-4">{faceRoutines.map(renderRoutineCard)}</div>
              )}
            </section>
          )}

          {(areaFilter === 'all' || areaFilter === 'hair') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-[#344A3A]">
                  Rutinitas Perawatan Rambut
                </h3>
                <button
                  type="button"
                  onClick={() => openCreateModal('hair')}
                  className="text-xs font-medium text-[#78917A] hover:text-[#344A3A]"
                >
                  + Tambah rutinitas rambut
                </button>
              </div>
              {hairRoutines.length === 0 ? (
                <p className="text-xs text-[#8A918A]">Belum ada rutinitas perawatan rambut.</p>
              ) : (
                <div className="space-y-4">{hairRoutines.map(renderRoutineCard)}</div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Create / Edit Routine Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRoutine ? 'Ubah Rutinitas' : 'Buat Rutinitas'}
        description="Perubahan jadwal tidak akan menghapus catatan penyelesaian masa lalu."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSaveRoutine} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F8F9F6] border border-[#E2E7DF] rounded-xl">
            {(['face', 'hair'] as const).map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => {
                  setCareArea(area);
                  setRoutineType(area === 'face' ? 'morning' : 'shampoo');
                }}
                className={`min-h-[40px] rounded-lg text-sm font-medium transition-colors ${
                  careArea === area
                    ? 'bg-white text-[#344A3A] shadow-xs border border-[#E2E7DF]'
                    : 'text-[#8A918A]'
                }`}
              >
                {area === 'face' ? 'Perawatan Wajah' : 'Perawatan Rambut'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="routine-name" className="block text-xs font-medium text-[#616C62] mb-1.5">
                Nama Rutinitas *
              </label>
              <input
                id="routine-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={careArea === 'face' ? 'cth. Skincare Pagi' : 'cth. Jadwal Keramas'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
              />
              {errors.name && <p className="text-xs text-[#A94438] mt-1">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="routine-type" className="block text-xs font-medium text-[#616C62] mb-1.5">
                Kategori Rutinitas
              </label>
              <select
                id="routine-type"
                value={routineType}
                onChange={(e) => setRoutineType(e.target.value as RoutineType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
              >
                {(careArea === 'face' ? FACE_ROUTINE_TYPES : HAIR_ROUTINE_TYPES).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="routine-freq" className="block text-xs font-medium text-[#616C62] mb-1.5">
                Frekuensi
              </label>
              <select
                id="routine-freq"
                value={frequencyType}
                onChange={(e) => setFrequencyType(e.target.value as FrequencyType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
              >
                <option value="daily">Setiap hari</option>
                <option value="weekly">Hari tertentu dalam seminggu</option>
                <option value="interval">Setiap beberapa hari (interval)</option>
                <option value="as_needed">Sesuai kebutuhan</option>
              </select>
            </div>

            <div>
              <label htmlFor="routine-time" className="block text-xs font-medium text-[#616C62] mb-1.5">
                Waktu Terjadwal *
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-[#8A918A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="routine-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] tabular-nums"
                />
              </div>
              {errors.scheduled_time && (
                <p className="text-xs text-[#A94438] mt-1">{errors.scheduled_time}</p>
              )}
            </div>
          </div>

          {frequencyType === 'weekly' && (
            <div>
              <span className="block text-xs font-medium text-[#616C62] mb-1.5">
                Hari dalam Seminggu *
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((day) => {
                  const selected = daysOfWeek.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-[#E7EDE5] border-[#78917A] text-[#344A3A]'
                          : 'bg-white border-[#E2E7DF] text-[#616C62]'
                      }`}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
              {errors.days_of_week && (
                <p className="text-xs text-[#A94438] mt-1">{errors.days_of_week}</p>
              )}
            </div>
          )}

          {frequencyType === 'interval' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="routine-interval-days"
                  className="block text-xs font-medium text-[#616C62] mb-1.5"
                >
                  Ulangi Setiap (hari) *
                </label>
                <input
                  id="routine-interval-days"
                  type="number"
                  min={1}
                  max={60}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Number(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] tabular-nums"
                />
                {errors.interval_days && (
                  <p className="text-xs text-[#A94438] mt-1">{errors.interval_days}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="routine-interval-start"
                  className="block text-xs font-medium text-[#616C62] mb-1.5"
                >
                  Tanggal Mulai Siklus
                </label>
                <input
                  id="routine-interval-start"
                  type="date"
                  value={intervalStartDate}
                  onChange={(e) => setIntervalStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] tabular-nums"
                />
              </div>
            </div>
          )}

          {/* Reminder Toggle */}
          <div className="p-3.5 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#344A3A]">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#78917A]"
              />
              <span>Aktifkan pengingat otomatis untuk rutinitas ini</span>
            </label>
            {reminderEnabled && (
              <div className="flex items-center gap-2">
                <label htmlFor="routine-reminder-time" className="text-xs text-[#616C62]">
                  Jam pengingat:
                </label>
                <input
                  id="routine-reminder-time"
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E2E7DF] bg-white text-xs text-[#344A3A] tabular-nums"
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="routine-notes" className="block text-xs font-medium text-[#616C62] mb-1.5">
              Catatan Rutinitas (opsional)
            </label>
            <input
              id="routine-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="cth. Bilas sampai bersih sebelum memakai kondisioner"
              className="w-full px-3.5 py-2 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
            />
          </div>

          {/* Steps & Products */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#616C62]">
                Langkah Rutinitas &amp; Produk Terkait *
              </span>
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [...prev, { product_id: null, title: '', instructions: '' }])
                }
                className="text-xs font-medium text-[#78917A] hover:text-[#344A3A]"
              >
                + Tambah langkah
              </button>
            </div>

            {items.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF] space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#8A918A] tabular-nums">
                    Langkah {idx + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-[#A94438] hover:underline"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, title: e.target.value } : row,
                        ),
                      )
                    }
                    placeholder="Aktivitas (cth. Cuci muka)"
                    aria-label={`Judul langkah ${idx + 1}`}
                    className="px-3 py-2 rounded-lg border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                  />

                  <select
                    value={item.product_id ?? ''}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, product_id: e.target.value || null } : row,
                        ),
                      )
                    }
                    aria-label={`Produk langkah ${idx + 1}`}
                    className="px-3 py-2 rounded-lg border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                  >
                    <option value="">Tanpa produk terhubung</option>
                    {products
                      .filter((p) => p.care_area === careArea)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({PRODUCT_STATUS_LABELS[p.status]})
                        </option>
                      ))}
                  </select>
                </div>

                <input
                  type="text"
                  value={item.instructions}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, instructions: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="Instruksi opsional (cth. gunakan saat kulit agak lembap)"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E7DF] bg-white text-xs text-[#344A3A]"
                />
              </div>
            ))}
            {errors.items && <p className="text-xs text-[#A94438]">{errors.items}</p>}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-[#E2E7DF] text-sm font-medium text-[#344A3A]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : editingRoutine ? 'Simpan Rutinitas' : 'Buat Rutinitas'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Hapus rutinitas"
        message={
          deleteTarget
            ? `Hapus "${deleteTarget.name}" beserta catatan penyelesaiannya?`
            : ''
        }
        loading={deleting}
      />
    </div>
  );
}
