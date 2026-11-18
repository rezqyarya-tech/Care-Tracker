import type { Routine, RoutineLog } from '../../types/database';
import { findLatestLogForRoutine, isRoutineScheduledOnDate } from './insights';

export interface DuePushNotification {
  dispatchKey: string;
  userId: string;
  routine: Routine;
  logDate: string;
  reminderTime: string;
  payload: {
    title: string;
    body: string;
    tag: string;
    url: string;
    routineId: string;
    careArea: 'face' | 'hair';
    reminderTime: string;
  };
}

export function parseHHMMToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function getCareAreaLabelId(careArea: 'face' | 'hair'): string {
  return careArea === 'face' ? 'Perawatan Wajah' : 'Perawatan Rambut';
}

export function findDuePushNotificationsForUser(params: {
  userId: string;
  routines: Routine[];
  routineLogs: RoutineLog[];
  currentDate: string;
  currentTimeHHMM: string;
  remindersEnabled: boolean;
  sentDispatchKeys: Set<string>;
  windowMinutes?: number;
}): DuePushNotification[] {
  const {
    userId,
    routines,
    routineLogs,
    currentDate,
    currentTimeHHMM,
    remindersEnabled,
    sentDispatchKeys,
    windowMinutes = 15,
  } = params;

  if (!remindersEnabled) return [];

  const nowMinutes = parseHHMMToMinutes(currentTimeHHMM);
  if (nowMinutes === null) return [];

  const todayRootLogs = routineLogs.filter(
    (l) => l.user_id === userId && l.log_date === currentDate && l.routine_item_id === null,
  );

  const due: DuePushNotification[] = [];

  for (const routine of routines) {
    if (routine.user_id !== userId) continue;
    if (!routine.is_enabled || !routine.reminder_enabled) continue;
    if (!isRoutineScheduledOnDate(routine, currentDate)) continue;

    // Never push if already logged (completed, skipped, or missed) today
    if (findLatestLogForRoutine(todayRootLogs, routine.id)) continue;

    const reminderTime = (routine.reminder_time || routine.scheduled_time).slice(0, 5);
    const targetMinutes = parseHHMMToMinutes(reminderTime);
    if (targetMinutes === null) continue;

    const diff = nowMinutes - targetMinutes;
    if (diff < 0 || diff > windowMinutes) continue;

    const dispatchKey = `${userId}:${currentDate}:${routine.id}:${reminderTime}`;
    if (sentDispatchKeys.has(dispatchKey)) continue;

    due.push({
      dispatchKey,
      userId,
      routine,
      logDate: currentDate,
      reminderTime,
      payload: {
        title: `Pengingat: ${routine.name}`,
        body: `${getCareAreaLabelId(routine.care_area)} · Jadwal pukul ${reminderTime}. Ketuk untuk mencatat.`,
        tag: `pct-${routine.id}-${currentDate}`,
        url: '/#/routine',
        routineId: routine.id,
        careArea: routine.care_area,
        reminderTime,
      },
    });
  }

  return due.sort((a, b) => a.reminderTime.localeCompare(b.reminderTime));
}
