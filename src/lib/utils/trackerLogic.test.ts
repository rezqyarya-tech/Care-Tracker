import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateUsageDays,
  formatUsageDuration,
  getDateRangeBounds,
  getGreetingForTimezone,
  getLocalDateString,
  getLocalDayOfWeek,
} from './date';
import { buildProductsCsv, escapeCsvCell } from './exportUtils';
import {
  analyzeProductBeforeAfter,
  calculateFaceAnalysis,
  calculateRangeRoutineCompletion,
  calculateRoutineHighlights,
  calculateRoutineProgressForDate,
  calculateShampooFrequency,
  generateAutomaticSummaries,
  generateCautiousObservations,
  getDueReminders,
  isRoutineScheduledOnDate,
} from './insights';
import {
  hasValidationErrors,
  validateProductForm,
  validateRoutineForm,
  validateSkinJournalForm,
} from '../validations/forms';
import type { HairJournal, Product, Routine, RoutineLog, SkinJournal } from '../../types/database';

test('date helpers calculate Asia/Jakarta dates and usage duration accurately', () => {
  const sampleDate = new Date('2026-11-18T02:00:00.000Z'); // 09:00 WIB in Asia/Jakarta
  assert.equal(getLocalDateString(sampleDate, 'Asia/Jakarta'), '2026-11-18');
  assert.equal(getGreetingForTimezone('Arya Kusuma', sampleDate, 'Asia/Jakarta'), 'Selamat pagi, Arya');

  assert.equal(calculateUsageDays('2026-11-01', null, '2026-11-18'), 18);
  assert.equal(calculateUsageDays('2026-11-01', '2026-11-10', '2026-11-18'), 10);
  assert.equal(formatUsageDuration(1), '1 hari');
  assert.equal(formatUsageDuration(30), '1 bulan');
  assert.equal(getLocalDayOfWeek('2026-11-18'), 3); // Wednesday

  const range = getDateRangeBounds('7d', '2026-11-18');
  assert.deepEqual(range, { startDate: '2026-11-12', endDate: '2026-11-18' });
});

test('form validators reject empty required fields and invalid dates without silent fallbacks', () => {
  const productErrors = validateProductForm({
    name: '',
    brand: 'Brand',
    category: 'Pembersih Wajah',
    care_area: 'face',
    start_date: '2026-11-10',
    end_date: '2026-11-05',
    usage_frequency: 'Sekali sehari',
    status: 'discontinued',
    notes: '',
    image_url: null,
  });
  assert.equal(hasValidationErrors(productErrors), true);
  assert.ok(productErrors.name);
  assert.ok(productErrors.end_date);

  const routineErrors = validateRoutineForm({
    name: 'Perawatan Pagi',
    care_area: 'face',
    routine_type: 'morning',
    frequency_type: 'interval',
    days_of_week: [],
    interval_days: 0,
    scheduled_time: '07:30',
    is_enabled: true,
    notes: '',
    items: [],
  });
  assert.equal(hasValidationErrors(routineErrors), true);
  assert.ok(routineErrors.interval_days);
  assert.ok(routineErrors.items);

  const skinErrors = validateSkinJournalForm({
    entry_date: '2026-11-18',
    acne_severity: 12,
    acne_type: 'small_pimples',
    acne_locations: ['Dahi'],
    oiliness: 'normal',
    irritation: 'none',
    redness: 'none',
    dryness_peeling: 'none',
    context_factors: [],
    notes: '',
  });
  assert.equal(hasValidationErrors(skinErrors), true);
  assert.ok(skinErrors.acne_severity);
});

test('interval scheduling and manual routine completion work without auto-completing unlogged items', () => {
  const intervalRoutine: Routine = {
    id: 'r-interval',
    user_id: 'u1',
    name: 'Keramas & Hair Tonic',
    care_area: 'hair',
    routine_type: 'shampoo',
    frequency_type: 'interval',
    days_of_week: [],
    interval_days: 3,
    interval_start_date: '2026-11-12',
    scheduled_time: '19:00',
    reminder_enabled: true,
    reminder_time: '19:00',
    is_enabled: true,
    notes: '',
    created_at: '2026-11-12T00:00:00Z',
    updated_at: '2026-11-12T00:00:00Z',
    items: [
      {
        id: 'ri-1',
        routine_id: 'r-interval',
        user_id: 'u1',
        product_id: 'p-shampoo',
        step_order: 1,
        title: 'Keramas bersih',
        instructions: '',
        created_at: '2026-11-12T00:00:00Z',
      },
    ],
  };

  assert.equal(isRoutineScheduledOnDate(intervalRoutine, '2026-11-12'), true);
  assert.equal(isRoutineScheduledOnDate(intervalRoutine, '2026-11-13'), false);
  assert.equal(isRoutineScheduledOnDate(intervalRoutine, '2026-11-15'), true);
  assert.equal(isRoutineScheduledOnDate(intervalRoutine, '2026-11-18'), true);

  const emptyStats = calculateRoutineProgressForDate([intervalRoutine], [], '2026-11-18');
  assert.equal(emptyStats.scheduledCount, 1);
  assert.equal(emptyStats.completedCount, 0);
  assert.equal(emptyStats.pendingCount, 1);
  assert.equal(emptyStats.completionRatePercent, 0);

  const manualLog: RoutineLog = {
    id: 'l1',
    routine_id: 'r-interval',
    routine_item_id: null,
    user_id: 'u1',
    log_date: '2026-11-18',
    status: 'completed',
    completed_at: '2026-11-18T12:15:00Z',
    note: '',
    created_at: '2026-11-18T12:15:00Z',
  };

  const completedStats = calculateRoutineProgressForDate([intervalRoutine], [manualLog], '2026-11-18');
  assert.equal(completedStats.completedCount, 1);
  assert.equal(completedStats.completionRatePercent, 100);

  const rangeStats = calculateRangeRoutineCompletion(
    [intervalRoutine],
    [manualLog],
    '2026-11-12',
    '2026-11-18',
    'hair',
  );
  // Scheduled on Nov 12, 15, 18 -> 3 scheduled; 1 completed -> 33%
  assert.equal(rangeStats.totalScheduled, 3);
  assert.equal(rangeStats.completed, 1);
  assert.equal(rangeStats.ratePercent, 33);
});

test('reminders never fire for completed/skipped/missed or dismissed routines', () => {
  const routine: Routine = {
    id: 'r1',
    user_id: 'u1',
    name: 'Skincare Pagi',
    care_area: 'face',
    routine_type: 'morning',
    frequency_type: 'daily',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    interval_days: 1,
    interval_start_date: null,
    scheduled_time: '07:30',
    reminder_enabled: true,
    reminder_time: '07:30',
    is_enabled: true,
    notes: '',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };

  assert.equal(
    getDueReminders({
      routines: [routine],
      routineLogs: [],
      currentDate: '2026-11-18',
      currentTimeHHMM: '07:15',
      remindersEnabled: true,
    }).length,
    0,
  );

  assert.equal(
    getDueReminders({
      routines: [routine],
      routineLogs: [],
      currentDate: '2026-11-18',
      currentTimeHHMM: '08:00',
      remindersEnabled: true,
    }).length,
    1,
  );

  assert.equal(
    getDueReminders({
      routines: [routine],
      routineLogs: [],
      currentDate: '2026-11-18',
      currentTimeHHMM: '08:00',
      remindersEnabled: true,
      dismissedKeys: ['2026-11-18:r1'],
    }).length,
    0,
  );

  const loggedToday: RoutineLog = {
    id: 'log-1',
    routine_id: 'r1',
    routine_item_id: null,
    user_id: 'u1',
    log_date: '2026-11-18',
    status: 'completed',
    completed_at: '2026-11-18T00:40:00Z',
    note: '',
    created_at: '2026-11-18T00:40:00Z',
  };

  assert.equal(
    getDueReminders({
      routines: [routine],
      routineLogs: [loggedToday],
      currentDate: '2026-11-18',
      currentTimeHHMM: '08:00',
      remindersEnabled: true,
    }).length,
    0,
  );
});

test('Phase 4 analytics, cautious before/after, and automatic summaries use real recorded data', () => {
  const hairEntries: HairJournal[] = [
    {
      id: 'h1',
      user_id: 'u1',
      entry_date: '2026-11-10',
      scalp_condition: 'balanced',
      hair_oiliness: 'normal',
      dandruff: 'none',
      scalp_itching: 'none',
      shedding_level: 'normal',
      general_condition: 'healthy',
      washed_hair: true,
      context_factors: [],
      notes: '',
      created_at: '2026-11-10T10:00:00Z',
      updated_at: '2026-11-10T10:00:00Z',
    },
    {
      id: 'h2',
      user_id: 'u1',
      entry_date: '2026-11-13',
      scalp_condition: 'oily',
      hair_oiliness: 'oily',
      dandruff: 'mild',
      scalp_itching: 'none',
      shedding_level: 'normal',
      general_condition: 'oily_flat',
      washed_hair: true,
      context_factors: [],
      notes: '',
      created_at: '2026-11-13T10:00:00Z',
      updated_at: '2026-11-13T10:00:00Z',
    },
  ];

  const shampooStats = calculateShampooFrequency(
    hairEntries,
    [],
    [],
    '2026-11-09',
    '2026-11-15',
  );
  assert.equal(shampooStats.washDays, 2);
  assert.equal(shampooStats.averageDaysBetweenWashes, 3);
  assert.equal(shampooStats.weeklyRate, 2);

  const products: Product[] = [
    {
      id: 'p1',
      user_id: 'u1',
      name: 'Serum Niacinamide',
      brand: 'PureLab',
      category: 'Serum',
      care_area: 'face',
      start_date: '2026-11-10',
      end_date: null,
      usage_frequency: 'Sekali sehari',
      status: 'active',
      notes: '',
      image_url: null,
      created_at: '2026-11-10T00:00:00Z',
      updated_at: '2026-11-10T00:00:00Z',
    },
  ];

  const skinJournals: SkinJournal[] = [
    {
      id: 's1',
      user_id: 'u1',
      entry_date: '2026-11-06',
      acne_severity: 2,
      acne_type: 'small_pimples',
      acne_locations: ['Dahi'],
      oiliness: 'normal',
      irritation: 'none',
      redness: 'none',
      dryness_peeling: 'none',
      context_factors: [],
      notes: '',
      created_at: '2026-11-06T00:00:00Z',
      updated_at: '2026-11-06T00:00:00Z',
    },
    {
      id: 's2',
      user_id: 'u1',
      entry_date: '2026-11-08',
      acne_severity: 2,
      acne_type: 'small_pimples',
      acne_locations: ['Dahi'],
      oiliness: 'normal',
      irritation: 'none',
      redness: 'none',
      dryness_peeling: 'none',
      context_factors: [],
      notes: '',
      created_at: '2026-11-08T00:00:00Z',
      updated_at: '2026-11-08T00:00:00Z',
    },
    {
      id: 's3',
      user_id: 'u1',
      entry_date: '2026-11-12',
      acne_severity: 5,
      acne_type: 'inflamed_acne',
      acne_locations: ['Dagu'],
      oiliness: 'oily',
      irritation: 'mild',
      redness: 'mild',
      dryness_peeling: 'none',
      context_factors: ['Stres tinggi'],
      notes: '',
      created_at: '2026-11-12T00:00:00Z',
      updated_at: '2026-11-12T00:00:00Z',
    },
    {
      id: 's4',
      user_id: 'u1',
      entry_date: '2026-11-14',
      acne_severity: 6,
      acne_type: 'inflamed_acne',
      acne_locations: ['Dagu'],
      oiliness: 'oily',
      irritation: 'mild',
      redness: 'mild',
      dryness_peeling: 'none',
      context_factors: ['Stres tinggi'],
      notes: '',
      created_at: '2026-11-14T00:00:00Z',
      updated_at: '2026-11-14T00:00:00Z',
    },
  ];

  const faceAnalysis = calculateFaceAnalysis(skinJournals, '2026-11-01', '2026-11-18');
  assert.equal(faceAnalysis.entriesCount, 4);
  assert.equal(faceAnalysis.acneFrequencyPercent, 100);
  assert.equal(faceAnalysis.averageAcne, 3.8);
  assert.equal(faceAnalysis.oilyEntries, 2);
  assert.equal(faceAnalysis.irritationEntries, 2);

  const beforeAfter = analyzeProductBeforeAfter(products, skinJournals);
  assert.equal(beforeAfter[0].beforeAvgAcne, 2);
  assert.equal(beforeAfter[0].afterAvgAcne, 5.5);
  assert.ok(beforeAfter[0].summary.includes('belum tentu disebabkan'));

  const observations = generateCautiousObservations({
    products,
    productHistory: [],
    skinJournals,
    hairJournals: hairEntries,
    routines: [],
    routineLogs: [],
    startDate: '2026-11-01',
    endDate: '2026-11-18',
  });
  assert.ok(observations.some((o) => o.confidenceLabel === 'Kemungkinan keterkaitan'));
  assert.ok(
    observations.every((o) => !o.detail.toLowerCase().includes('diagnosis')),
  );

  const summaries = generateAutomaticSummaries({
    skinJournals,
    hairJournals: hairEntries,
    routines: [],
    routineLogs: [],
    startDate: '2026-11-09',
    endDate: '2026-11-18',
  });
  assert.ok(summaries.some((s) => s.includes('Keramas tercatat')));

  const highlights = calculateRoutineHighlights([], [], products, '2026-11-01', '2026-11-18');
  assert.equal(highlights.mostConsistent, null);
});

test('CSV export properly escapes quotes, commas, and newlines with UTF-8 BOM', () => {
  assert.equal(escapeCsvCell('Hello, "World"'), '"Hello, ""World"""');
  const csv = buildProductsCsv([
    {
      id: 'p1',
      user_id: 'u1',
      name: 'Serum, A',
      brand: 'Pure "Lab"',
      category: 'Serum',
      care_area: 'face',
      start_date: '2026-11-01',
      end_date: null,
      usage_frequency: 'Sekali sehari',
      status: 'active',
      notes: 'Baris 1\nBaris 2',
      image_url: null,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
  ]);
  assert.ok(csv.startsWith('\uFEFFNama Produk,Merek,'));
  assert.ok(csv.includes('"Serum, A"'));
  assert.ok(csv.includes('"Pure ""Lab"""'));
});

import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../server/authHelpers';
import { findDuePushNotificationsForUser, parseHHMMToMinutes } from './pushSchedulerLogic';

test('authHelpers hash/verify passwords and sign/verify session tokens securely', () => {
  assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com');
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('invalid-email'), false);

  const hashed = hashPassword('rahasia123');
  assert.ok(hashed.startsWith('scrypt:'));
  assert.equal(verifyPassword('rahasia123', hashed), true);
  assert.equal(verifyPassword('salah', hashed), false);

  const secret = 'test-signing-secret-key';
  const token = signSessionToken({ userId: 'u-1', email: 'user@example.com' }, secret, 60_000);
  const verified = verifySessionToken(token, secret);
  assert.deepEqual(verified?.userId, 'u-1');
  assert.deepEqual(verified?.email, 'user@example.com');
  assert.equal(verifySessionToken(token, 'wrong-secret'), null);

  const expired = signSessionToken({ userId: 'u-1', email: 'user@example.com' }, secret, -1000);
  assert.equal(verifySessionToken(expired, secret), null);
});

test('pushSchedulerLogic fires due Web Push once within window and skips completed/already-sent routines', () => {
  assert.equal(parseHHMMToMinutes('07:30'), 450);
  assert.equal(parseHHMMToMinutes('invalid'), null);

  const morningRoutine: Routine = {
    id: 'r-morning',
    user_id: 'u-1',
    name: 'Skincare Pagi',
    care_area: 'face',
    routine_type: 'morning',
    frequency_type: 'daily',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    interval_days: 1,
    interval_start_date: null,
    scheduled_time: '07:30',
    reminder_enabled: true,
    reminder_time: '07:30',
    is_enabled: true,
    notes: '',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };

  // Before reminder time -> 0 due
  assert.equal(
    findDuePushNotificationsForUser({
      userId: 'u-1',
      routines: [morningRoutine],
      routineLogs: [],
      currentDate: '2026-11-18',
      currentTimeHHMM: '07:29',
      remindersEnabled: true,
      sentDispatchKeys: new Set(),
    }).length,
    0,
  );

  // At 07:31 -> 1 due
  const due = findDuePushNotificationsForUser({
    userId: 'u-1',
    routines: [morningRoutine],
    routineLogs: [],
    currentDate: '2026-11-18',
    currentTimeHHMM: '07:31',
    remindersEnabled: true,
    sentDispatchKeys: new Set(),
  });
  assert.equal(due.length, 1);
  assert.equal(due[0].payload.title, 'Pengingat: Skincare Pagi');

  // Same dispatchKey already sent -> 0 due
  assert.equal(
    findDuePushNotificationsForUser({
      userId: 'u-1',
      routines: [morningRoutine],
      routineLogs: [],
      currentDate: '2026-11-18',
      currentTimeHHMM: '07:32',
      remindersEnabled: true,
      sentDispatchKeys: new Set([due[0].dispatchKey]),
    }).length,
    0,
  );

  // Past 15-minute grace window -> 0 due
  assert.equal(
    findDuePushNotificationsForUser({
      userId: 'u-1',
      routines: [morningRoutine],
      routineLogs: [],
      currentDate: '2026-11-18',
      currentTimeHHMM: '08:00',
      remindersEnabled: true,
      sentDispatchKeys: new Set(),
    }).length,
    0,
  );

  // Already logged today -> 0 due
  const doneLog: RoutineLog = {
    id: 'l-done',
    routine_id: 'r-morning',
    routine_item_id: null,
    user_id: 'u-1',
    log_date: '2026-11-18',
    status: 'completed',
    completed_at: '2026-11-18T00:31:00Z',
    note: '',
    created_at: '2026-11-18T00:31:00Z',
  };
  assert.equal(
    findDuePushNotificationsForUser({
      userId: 'u-1',
      routines: [morningRoutine],
      routineLogs: [doneLog],
      currentDate: '2026-11-18',
      currentTimeHHMM: '07:31',
      remindersEnabled: true,
      sentDispatchKeys: new Set(),
    }).length,
    0,
  );
});

