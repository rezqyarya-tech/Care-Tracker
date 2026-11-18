import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCircle2, X } from 'lucide-react';
import { useOwnerProfile } from '../../hooks/useOwnerProfile';
import { useTrackerData } from '../../hooks/useTrackerData';
import { CARE_AREA_LABELS, DEFAULT_TIMEZONE } from '../../lib/utils/constants';
import { getLocalDateString, getLocalTimeHHMM } from '../../lib/utils/date';
import { getDueReminders } from '../../lib/utils/insights';

const DISMISSED_STORAGE_KEY = 'pct_dismissed_reminders_v1';

function readDismissedKeys(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function ReminderBanner() {
  const { profile } = useOwnerProfile();
  const { routines, routineLogs, recordRoutineLog } = useTrackerData();

  const [dismissedKeys, setDismissedKeys] = useState<string[]>(() => readDismissedKeys());
  const [tick, setTick] = useState(0);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const sentNotificationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const now = useMemo(() => {
    void tick;
    return new Date();
  }, [tick]);

  const today = getLocalDateString(now, timeZone);
  const currentTimeHHMM = getLocalTimeHHMM(now, timeZone);

  const dueReminders = useMemo(
    () =>
      getDueReminders({
        routines,
        routineLogs,
        currentDate: today,
        currentTimeHHMM,
        remindersEnabled: profile?.reminders_enabled ?? true,
        dismissedKeys,
      }),
    [routines, routineLogs, today, currentTimeHHMM, profile?.reminders_enabled, dismissedKeys],
  );

  // Prune stale dismissed keys from previous days
  useEffect(() => {
    const todayPrefix = `${today}:`;
    const active = dismissedKeys.filter((k) => k.startsWith(todayPrefix));
    if (active.length !== dismissedKeys.length) {
      setDismissedKeys(active);
      try {
        window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(active));
      } catch {
        // ignore storage quota errors
      }
    }
  }, [today, dismissedKeys]);

  // Optional foreground browser Notification API when Web Push is not yet subscribed on this device
  useEffect(() => {
    if (!profile?.reminders_enabled || !profile?.browser_notifications_enabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    let cancelled = false;
    const notifyForegroundIfNeeded = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          if (sub) {
            // Server VAPID Web Push already delivers system notifications via Service Worker
            return;
          }
        } catch {
          // continue with foreground fallback
        }
      }
      if (cancelled) return;

      for (const item of dueReminders) {
        const notifKey = `${today}:${item.routine.id}`;
        if (sentNotificationsRef.current.has(notifKey)) continue;
        sentNotificationsRef.current.add(notifKey);
        try {
          new Notification(`Pengingat: ${item.routine.name}`, {
            body: `${CARE_AREA_LABELS[item.routine.care_area]} · Jadwal pukul ${item.reminderTime}`,
            icon: '/pwa-192x192.png',
          });
        } catch {
          // Ignore browser notification errors in restricted contexts
        }
      }
    };

    void notifyForegroundIfNeeded();
    return () => {
      cancelled = true;
    };
  }, [dueReminders, profile?.reminders_enabled, profile?.browser_notifications_enabled, today]);

  if (dueReminders.length === 0) return null;

  const dismissForToday = (routineId: string) => {
    const key = `${today}:${routineId}`;
    const next = Array.from(new Set([...dismissedKeys, key]));
    setDismissedKeys(next);
    try {
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const handleCompleteNow = async (routineId: string) => {
    setCompletingId(routineId);
    try {
      await recordRoutineLog({
        routine_id: routineId,
        routine_item_id: null,
        log_date: today,
        status: 'completed',
      });
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <section
      aria-label="Pengingat rutinitas hari ini"
      className="mb-5 bg-white border border-[#C6D5C2] rounded-2xl p-4 space-y-2.5 shadow-xs"
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-[#344A3A]">
        <Bell className="w-4 h-4 text-[#78917A]" />
        <span>Pengingat Rutinitas Hari Ini ({dueReminders.length})</span>
      </div>

      <div className="divide-y divide-[#E2E7DF]">
        {dueReminders.map(({ routine, reminderTime }) => (
          <div
            key={routine.id}
            className="py-2 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#344A3A] truncate">
                {routine.name}{' '}
                <span className="text-xs font-normal text-[#8A918A] tabular-nums">
                  · pukul {reminderTime}
                </span>
              </p>
              <p className="text-xs text-[#616C62]">{CARE_AREA_LABELS[routine.care_area]}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={completingId === routine.id}
                onClick={() => void handleCompleteNow(routine.id)}
                className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#E7EDE5] border border-[#78917A] text-xs font-medium text-[#344A3A] hover:bg-[#DCE6D9] whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#78917A]" />
                Tandai Selesai
              </button>
              <button
                type="button"
                aria-label={`Tutup pengingat ${routine.name} hari ini`}
                onClick={() => dismissForToday(routine.id)}
                className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E2E7DF] text-xs text-[#616C62] hover:bg-[#F8F9F6] whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                Tutup hari ini
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
