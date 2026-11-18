import type {
  CareArea,
  HairJournal,
  Product,
  ProductHistoryEntry,
  Routine,
  RoutineLog,
  SkinJournal,
} from '../../types/database';
import {
  DANDRUFF_SCORE_MAP,
  OILINESS_SCORE_MAP,
  SCALP_CONDITION_OPTIONS,
  SHEDDING_OPTIONS,
  getOptionLabel,
} from './insightScores';
import { addDaysToDateString, formatShortDate, getLocalDayOfWeek } from './date';

export interface RoutineStats {
  scheduledCount: number;
  completedCount: number;
  skippedCount: number;
  missedCount: number;
  pendingCount: number;
  completionRatePercent: number | null;
}

export interface ObservationNote {
  id: string;
  confidenceLabel:
    | 'Perubahan teramati'
    | 'Kemungkinan keterkaitan'
    | 'Perlu pengamatan lanjutan'
    | 'Data belum mencukupi';
  title: string;
  detail: string;
}

export interface ProductBeforeAfterInsight {
  product: Product;
  beforeCount: number;
  afterCount: number;
  beforeAvgAcne: number | null;
  afterAvgAcne: number | null;
  postStopCount: number;
  postStopAvgAcne: number | null;
  summary: string;
}

export interface DueRoutineReminder {
  routine: Routine;
  reminderTime: string;
}

export function isRoutineScheduledOnDate(routine: Routine, dateString: string): boolean {
  if (!routine.is_enabled) return false;
  if (routine.frequency_type === 'as_needed') return false;
  if (routine.frequency_type === 'daily') return true;
  if (routine.frequency_type === 'interval') {
    const interval = Math.max(1, routine.interval_days || 2);
    const anchor = routine.interval_start_date || routine.created_at.slice(0, 10);
    const anchorMs = Date.parse(`${anchor}T00:00:00Z`);
    const targetMs = Date.parse(`${dateString}T00:00:00Z`);
    if (Number.isNaN(anchorMs) || Number.isNaN(targetMs) || targetMs < anchorMs) return false;
    const diffDays = Math.round((targetMs - anchorMs) / (1000 * 60 * 60 * 24));
    return diffDays % interval === 0;
  }
  const day = getLocalDayOfWeek(dateString);
  return routine.days_of_week.includes(day);
}

export function calculateRoutineProgressForDate(
  routines: Routine[],
  logs: RoutineLog[],
  dateString: string,
): RoutineStats {
  const scheduled = routines.filter((r) => isRoutineScheduledOnDate(r, dateString));
  const dateLogs = logs.filter((l) => l.log_date === dateString && l.routine_item_id === null);

  let completedCount = 0;
  let skippedCount = 0;
  let missedCount = 0;

  for (const routine of scheduled) {
    const latest = findLatestLogForRoutine(dateLogs, routine.id);
    if (!latest) continue;
    if (latest.status === 'completed') completedCount += 1;
    else if (latest.status === 'skipped') skippedCount += 1;
    else if (latest.status === 'missed') missedCount += 1;
  }

  const scheduledCount = scheduled.length;
  const pendingCount = Math.max(0, scheduledCount - completedCount - skippedCount - missedCount);
  const completionRatePercent =
    scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : null;

  return {
    scheduledCount,
    completedCount,
    skippedCount,
    missedCount,
    pendingCount,
    completionRatePercent,
  };
}

export function calculateRangeRoutineCompletion(
  routines: Routine[],
  logs: RoutineLog[],
  startDate: string,
  endDate: string,
  areaFilter?: CareArea,
): {
  totalScheduled: number;
  completed: number;
  skipped: number;
  missed: number;
  ratePercent: number | null;
  dailySeries: Array<{ date: string; completed: number; scheduled: number; rate: number }>;
} {
  const enabled = routines.filter(
    (r) =>
      r.is_enabled &&
      r.frequency_type !== 'as_needed' &&
      (areaFilter ? r.care_area === areaFilter : true),
  );

  const routineEarliestDate = new Map<string, string>();
  for (const r of enabled) {
    let earliest = r.created_at.slice(0, 10);
    for (const l of logs) {
      if (l.routine_id === r.id && l.log_date < earliest) {
        earliest = l.log_date;
      }
    }
    routineEarliestDate.set(r.id, earliest);
  }

  const dailySeries: Array<{ date: string; completed: number; scheduled: number; rate: number }> = [];
  let totalScheduled = 0;
  let completed = 0;
  let skipped = 0;
  let missed = 0;

  let cursor = startDate;
  let guard = 0;
  while (cursor <= endDate && guard < 366) {
    const activeOnCursor = enabled.filter(
      (r) => (routineEarliestDate.get(r.id) ?? cursor) <= cursor,
    );
    const stats = calculateRoutineProgressForDate(activeOnCursor, logs, cursor);
    totalScheduled += stats.scheduledCount;
    completed += stats.completedCount;
    skipped += stats.skippedCount;
    missed += stats.missedCount;
    dailySeries.push({
      date: cursor,
      completed: stats.completedCount,
      scheduled: stats.scheduledCount,
      rate: stats.completionRatePercent ?? 0,
    });
    cursor = addDaysToDateString(cursor, 1);
    guard += 1;
  }

  return {
    totalScheduled,
    completed,
    skipped,
    missed,
    ratePercent: totalScheduled > 0 ? Math.round((completed / totalScheduled) * 100) : null,
    dailySeries,
  };
}

export function calculateRoutineHighlights(
  routines: Routine[],
  logs: RoutineLog[],
  products: Product[],
  startDate: string,
  endDate: string,
): {
  mostConsistent: { routine: Routine; completed: number } | null;
  mostSkipped: { routine: Routine; skippedOrMissed: number } | null;
  productUsageCounts: Array<{ product: Product; uses: number }>;
} {
  const logsInRange = logs.filter(
    (l) => l.log_date >= startDate && l.log_date <= endDate && l.routine_item_id === null,
  );
  const completedCountByRoutine = new Map<string, number>();
  const skippedCountByRoutine = new Map<string, number>();

  for (const log of logsInRange) {
    if (log.status === 'completed') {
      completedCountByRoutine.set(
        log.routine_id,
        (completedCountByRoutine.get(log.routine_id) ?? 0) + 1,
      );
    } else {
      skippedCountByRoutine.set(
        log.routine_id,
        (skippedCountByRoutine.get(log.routine_id) ?? 0) + 1,
      );
    }
  }

  let mostConsistent: { routine: Routine; completed: number } | null = null;
  let mostSkipped: { routine: Routine; skippedOrMissed: number } | null = null;

  for (const routine of routines) {
    const comp = completedCountByRoutine.get(routine.id) ?? 0;
    if (comp > 0 && (!mostConsistent || comp > mostConsistent.completed)) {
      mostConsistent = { routine, completed: comp };
    }
    const skip = skippedCountByRoutine.get(routine.id) ?? 0;
    if (skip > 0 && (!mostSkipped || skip > mostSkipped.skippedOrMissed)) {
      mostSkipped = { routine, skippedOrMissed: skip };
    }
  }

  const productUses = new Map<string, number>();
  const routineMap = new Map(routines.map((r) => [r.id, r]));
  for (const log of logsInRange) {
    if (log.status !== 'completed') continue;
    const routine = routineMap.get(log.routine_id);
    if (!routine?.items) continue;
    const uniqueIds = new Set(
      routine.items.map((item) => item.product_id).filter((id): id is string => Boolean(id)),
    );
    for (const pid of uniqueIds) {
      productUses.set(pid, (productUses.get(pid) ?? 0) + 1);
    }
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  const productUsageCounts = Array.from(productUses.entries())
    .map(([pid, uses]) => {
      const product = productMap.get(pid);
      return product ? { product, uses } : null;
    })
    .filter((row): row is { product: Product; uses: number } => Boolean(row))
    .sort((a, b) => b.uses - a.uses);

  return { mostConsistent, mostSkipped, productUsageCounts };
}

export function calculateFaceAnalysis(
  skinJournals: SkinJournal[],
  startDate: string,
  endDate: string,
): {
  entriesCount: number;
  acneDaysCount: number;
  acneFrequencyPercent: number | null;
  averageAcne: number | null;
  topLocations: Array<{ location: string; count: number }>;
  irritationEntries: number;
  oilyEntries: number;
} {
  const inRange = skinJournals.filter(
    (j) => j.entry_date >= startDate && j.entry_date <= endDate,
  );
  if (inRange.length === 0) {
    return {
      entriesCount: 0,
      acneDaysCount: 0,
      acneFrequencyPercent: null,
      averageAcne: null,
      topLocations: [],
      irritationEntries: 0,
      oilyEntries: 0,
    };
  }

  const acneDaysCount = inRange.filter(
    (j) => j.acne_severity > 0 || j.acne_type !== 'no_acne',
  ).length;
  const averageAcne = Number(
    (inRange.reduce((s, e) => s + e.acne_severity, 0) / inRange.length).toFixed(1),
  );
  const locationMap = new Map<string, number>();
  for (const e of inRange) {
    for (const loc of e.acne_locations) {
      locationMap.set(loc, (locationMap.get(loc) ?? 0) + 1);
    }
  }
  const topLocations = Array.from(locationMap.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count);

  const irritationEntries = inRange.filter((e) => e.irritation !== 'none').length;
  const oilyEntries = inRange.filter(
    (e) => e.oiliness === 'oily' || e.oiliness === 'very_oily',
  ).length;

  return {
    entriesCount: inRange.length,
    acneDaysCount,
    acneFrequencyPercent: Math.round((acneDaysCount / inRange.length) * 100),
    averageAcne,
    topLocations,
    irritationEntries,
    oilyEntries,
  };
}

export function calculateShampooFrequency(
  hairJournals: HairJournal[],
  routineLogs: RoutineLog[],
  routines: Routine[],
  startDate: string,
  endDate: string,
): {
  washDays: number;
  averageDaysBetweenWashes: number | null;
  weeklyRate: number | null;
} {
  const shampooRoutineIds = new Set(
    routines.filter((r) => r.routine_type === 'shampoo').map((r) => r.id),
  );

  const washDatesSet = new Set<string>();

  for (const entry of hairJournals) {
    if (entry.entry_date >= startDate && entry.entry_date <= endDate && entry.washed_hair) {
      washDatesSet.add(entry.entry_date);
    }
  }

  for (const log of routineLogs) {
    if (
      log.log_date >= startDate &&
      log.log_date <= endDate &&
      log.status === 'completed' &&
      log.routine_item_id === null &&
      shampooRoutineIds.has(log.routine_id)
    ) {
      washDatesSet.add(log.log_date);
    }
  }

  const sortedDates = Array.from(washDatesSet).sort();
  const washDays = sortedDates.length;

  let averageDaysBetweenWashes: number | null = null;
  if (sortedDates.length >= 2) {
    let totalGap = 0;
    for (let i = 1; i < sortedDates.length; i += 1) {
      const prev = Date.parse(`${sortedDates[i - 1]}T00:00:00Z`);
      const curr = Date.parse(`${sortedDates[i]}T00:00:00Z`);
      totalGap += Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    }
    averageDaysBetweenWashes = Number((totalGap / (sortedDates.length - 1)).toFixed(1));
  }

  const totalRangeDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) /
        (1000 * 60 * 60 * 24),
    ) + 1,
  );

  const weeklyRate =
    washDays > 0 ? Number(((washDays / totalRangeDays) * 7).toFixed(1)) : null;

  return {
    washDays,
    averageDaysBetweenWashes,
    weeklyRate,
  };
}

export function calculateHairSeries(hairJournals: HairJournal[], startDate: string, endDate: string) {
  return hairJournals
    .filter((j) => j.entry_date >= startDate && j.entry_date <= endDate)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    .map((j) => ({
      date: j.entry_date.slice(5),
      fullDate: j.entry_date,
      dandruffScore: DANDRUFF_SCORE_MAP[j.dandruff],
      itchingScore: DANDRUFF_SCORE_MAP[j.scalp_itching],
      oilinessScore: OILINESS_SCORE_MAP[j.hair_oiliness],
      sheddingScore:
        j.shedding_level === 'minimal'
          ? 1
          : j.shedding_level === 'normal'
            ? 2
            : j.shedding_level === 'elevated'
              ? 3
              : 4,
      scalpLabel: getOptionLabel(SCALP_CONDITION_OPTIONS, j.scalp_condition),
      sheddingLabel: getOptionLabel(SHEDDING_OPTIONS, j.shedding_level),
      washedHair: j.washed_hair ? 1 : 0,
    }));
}

export function analyzeProductBeforeAfter(
  products: Product[],
  skinJournals: SkinJournal[],
): ProductBeforeAfterInsight[] {
  return products
    .filter((p) => p.care_area === 'face')
    .map((product) => {
      const beforeStart = addDaysToDateString(product.start_date, -14);
      const afterEnd = addDaysToDateString(product.start_date, 14);

      const beforeEntries = skinJournals.filter(
        (j) => j.entry_date >= beforeStart && j.entry_date < product.start_date,
      );
      const afterEntries = skinJournals.filter(
        (j) => j.entry_date >= product.start_date && j.entry_date <= afterEnd,
      );

      const beforeAvgAcne =
        beforeEntries.length > 0
          ? Number(
              (
                beforeEntries.reduce((s, e) => s + e.acne_severity, 0) / beforeEntries.length
              ).toFixed(1),
            )
          : null;
      const afterAvgAcne =
        afterEntries.length > 0
          ? Number(
              (
                afterEntries.reduce((s, e) => s + e.acne_severity, 0) / afterEntries.length
              ).toFixed(1),
            )
          : null;

      let postStopCount = 0;
      let postStopAvgAcne: number | null = null;
      if (product.status === 'discontinued' && product.end_date) {
        const stopEnd = addDaysToDateString(product.end_date, 14);
        const postStopEntries = skinJournals.filter(
          (j) => j.entry_date > product.end_date! && j.entry_date <= stopEnd,
        );
        postStopCount = postStopEntries.length;
        if (postStopEntries.length > 0) {
          postStopAvgAcne = Number(
            (
              postStopEntries.reduce((s, e) => s + e.acne_severity, 0) / postStopEntries.length
            ).toFixed(1),
          );
        }
      }

      let summary = 'Data yang tersedia belum cukup untuk menarik kesimpulan.';
      if (
        beforeEntries.length >= 2 &&
        afterEntries.length >= 2 &&
        beforeAvgAcne !== null &&
        afterAvgAcne !== null
      ) {
        const diff = Number((afterAvgAcne - beforeAvgAcne).toFixed(1));
        if (Math.abs(diff) >= 1.0) {
          summary =
            'Terlihat adanya perubahan kondisi setelah produk mulai digunakan. Terdapat kemungkinan hubungan, tetapi masih diperlukan pengamatan lebih lanjut dan perubahan ini belum tentu disebabkan oleh produk tersebut.';
        } else {
          summary =
            'Tidak terlihat perubahan tajam antara 14 hari sebelum dan sesudah produk mulai digunakan. Tetap lanjutkan pencatatan secara berkala.';
        }
      }

      return {
        product,
        beforeCount: beforeEntries.length,
        afterCount: afterEntries.length,
        beforeAvgAcne,
        afterAvgAcne,
        postStopCount,
        postStopAvgAcne,
        summary,
      };
    });
}

export function generateAutomaticSummaries(params: {
  skinJournals: SkinJournal[];
  hairJournals: HairJournal[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  startDate: string;
  endDate: string;
}): string[] {
  const { skinJournals, hairJournals, routines, routineLogs, startDate, endDate } = params;
  const summaries: string[] = [];

  const totalRangeDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) /
        (1000 * 60 * 60 * 24),
    ) + 1,
  );
  const prevEndDate = addDaysToDateString(startDate, -1);
  const prevStartDate = addDaysToDateString(prevEndDate, -(totalRangeDays - 1));

  const currentSkin = skinJournals.filter(
    (j) => j.entry_date >= startDate && j.entry_date <= endDate,
  );
  const prevSkin = skinJournals.filter(
    (j) => j.entry_date >= prevStartDate && j.entry_date <= prevEndDate,
  );

  if (currentSkin.length >= 3 && prevSkin.length >= 3) {
    const currAvg = currentSkin.reduce((s, e) => s + e.acne_severity, 0) / currentSkin.length;
    const prevAvg = prevSkin.reduce((s, e) => s + e.acne_severity, 0) / prevSkin.length;
    const diff = Number((currAvg - prevAvg).toFixed(1));
    if (diff <= -0.5) {
      summaries.push(
        `Dalam ${totalRangeDays} hari terakhir, tingkat jerawat rata-rata mengalami penurunan (${currAvg.toFixed(1)} vs ${prevAvg.toFixed(1)}) dibandingkan periode sebelumnya.`,
      );
    } else if (diff >= 0.5) {
      summaries.push(
        `Dalam ${totalRangeDays} hari terakhir, tingkat jerawat rata-rata tercatat lebih tinggi (${currAvg.toFixed(1)} vs ${prevAvg.toFixed(1)}) dibandingkan periode sebelumnya.`,
      );
    } else {
      summaries.push(
        `Dalam ${totalRangeDays} hari terakhir, tingkat jerawat rata-rata cenderung stabil (${currAvg.toFixed(1)}/10) dibandingkan periode sebelumnya.`,
      );
    }
  }

  const faceRoutineStats = calculateRangeRoutineCompletion(
    routines,
    routineLogs,
    startDate,
    endDate,
    'face',
  );
  if (faceRoutineStats.totalScheduled > 0 && faceRoutineStats.ratePercent !== null) {
    summaries.push(
      `Rutinitas perawatan wajah berhasil diselesaikan sebanyak ${faceRoutineStats.ratePercent}% (${faceRoutineStats.completed} dari ${faceRoutineStats.totalScheduled} jadwal).`,
    );
  }

  const hairRoutineStats = calculateRangeRoutineCompletion(
    routines,
    routineLogs,
    startDate,
    endDate,
    'hair',
  );
  if (hairRoutineStats.totalScheduled > 0 && hairRoutineStats.ratePercent !== null) {
    summaries.push(
      `Rutinitas perawatan rambut berhasil diselesaikan sebanyak ${hairRoutineStats.ratePercent}% (${hairRoutineStats.completed} dari ${hairRoutineStats.totalScheduled} jadwal).`,
    );
  }

  const shampoo = calculateShampooFrequency(hairJournals, routineLogs, routines, startDate, endDate);
  if (shampoo.washDays > 0) {
    summaries.push(
      `Keramas tercatat sebanyak ${shampoo.washDays} kali dalam ${totalRangeDays} hari terakhir.`,
    );
  }

  const currentHair = hairJournals
    .filter((j) => j.entry_date >= startDate && j.entry_date <= endDate)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  if (currentHair.length >= 4) {
    const mid = Math.floor(currentHair.length / 2);
    const firstDandruff = currentHair
      .slice(0, mid)
      .filter((e) => e.dandruff !== 'none').length;
    const secondDandruff = currentHair
      .slice(mid)
      .filter((e) => e.dandruff !== 'none').length;
    if (secondDandruff > firstDandruff) {
      summaries.push(
        'Ketombe lebih sering dicatat pada paruh akhir periode ini dibandingkan paruh awal.',
      );
    } else if (firstDandruff > secondDandruff) {
      summaries.push(
        'Catatan ketombe berkurang pada paruh akhir periode ini dibandingkan paruh awal.',
      );
    }
  }

  return summaries;
}

export function generateCautiousObservations(params: {
  products: Product[];
  productHistory: ProductHistoryEntry[];
  skinJournals: SkinJournal[];
  hairJournals: HairJournal[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  startDate: string;
  endDate: string;
}): ObservationNote[] {
  const { products, skinJournals, hairJournals, routines, routineLogs, startDate, endDate } = params;

  const skinInRange = skinJournals
    .filter((j) => j.entry_date >= startDate && j.entry_date <= endDate)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));

  const hairInRange = hairJournals
    .filter((j) => j.entry_date >= startDate && j.entry_date <= endDate)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));

  const observations: ObservationNote[] = [];

  if (skinInRange.length < 3 && hairInRange.length < 3) {
    observations.push({
      id: 'insufficient-data',
      confidenceLabel: 'Data belum mencukupi',
      title: 'Data yang tersedia belum cukup untuk menarik kesimpulan',
      detail:
        'Catat minimal 3 entri catatan harian wajah atau rambut dalam rentang tanggal ini untuk menampilkan pengamatan tren deskriptif.',
    });
    return observations;
  }

  if (skinInRange.length >= 4) {
    const mid = Math.floor(skinInRange.length / 2);
    const firstHalf = skinInRange.slice(0, mid);
    const secondHalf = skinInRange.slice(mid);
    const avgFirst = firstHalf.reduce((sum, e) => sum + e.acne_severity, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, e) => sum + e.acne_severity, 0) / secondHalf.length;
    const delta = Number((avgSecond - avgFirst).toFixed(1));

    if (Math.abs(delta) >= 1) {
      observations.push({
        id: 'acne-trend',
        confidenceLabel: 'Perubahan teramati',
        title:
          delta > 0
            ? `Tingkat jerawat tercatat meningkat (+${delta} poin) di paruh akhir periode`
            : `Tingkat jerawat tercatat menurun (${delta} poin) di paruh akhir periode`,
        detail:
          'Ini mencerminkan perubahan antara paruh awal dan paruh akhir periode terpilih. Perubahan ini belum tentu disebabkan oleh produk tertentu; pertimbangkan juga tidur, stres, lingkungan, atau siklus hormonal.',
      });
    }
  }

  const productInsights = analyzeProductBeforeAfter(products, skinJournals);
  for (const pi of productInsights) {
    if (
      pi.beforeCount >= 2 &&
      pi.afterCount >= 2 &&
      pi.beforeAvgAcne !== null &&
      pi.afterAvgAcne !== null
    ) {
      const diff = Number((pi.afterAvgAcne - pi.beforeAvgAcne).toFixed(1));
      if (Math.abs(diff) >= 1.2) {
        observations.push({
          id: `product-intro-${pi.product.id}`,
          confidenceLabel: 'Kemungkinan keterkaitan',
          title: `Terlihat adanya perubahan kondisi setelah ${pi.product.name} mulai digunakan`,
          detail: `Rata-rata skor jerawat bergeser dari ${pi.beforeAvgAcne.toFixed(1)} menjadi ${pi.afterAvgAcne.toFixed(1)} setelah ${formatShortDate(pi.product.start_date)}. Terdapat kemungkinan hubungan, tetapi masih diperlukan pengamatan lebih lanjut.`,
        });
      }
    }
  }

  const rangeRoutine = calculateRangeRoutineCompletion(routines, routineLogs, startDate, endDate);
  if (rangeRoutine.totalScheduled >= 3 && rangeRoutine.ratePercent !== null) {
    observations.push({
      id: 'routine-consistency',
      confidenceLabel: 'Perlu pengamatan lanjutan',
      title: `Penyelesaian rutinitas tercatat sebesar ${rangeRoutine.ratePercent}% (${rangeRoutine.completed} dari ${rangeRoutine.totalScheduled})`,
      detail:
        'Pencatatan manual yang konsisten membantu membedakan apakah perubahan kulit atau rambut sejalan dengan kedisiplinan rutinitas atau hari yang terlewat.',
    });
  }

  const contextCounts = new Map<string, number>();
  for (const entry of [...skinInRange, ...hairInRange]) {
    for (const factor of entry.context_factors) {
      contextCounts.set(factor, (contextCounts.get(factor) ?? 0) + 1);
    }
  }
  const topContext = Array.from(contextCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topContext && topContext[1] >= 2) {
    observations.push({
      id: 'top-context-factor',
      confidenceLabel: 'Perlu pengamatan lanjutan',
      title: `Faktor "${topContext[0]}" tercatat pada ${topContext[1]} catatan harian`,
      detail:
        'Faktor non-produk seperti tidur, stres, pola makan, dan lingkungan sering kali beriringan dengan fluktuasi kondisi kulit dan kulit kepala.',
    });
  }

  if (observations.length === 0) {
    observations.push({
      id: 'steady-window',
      confidenceLabel: 'Perubahan teramati',
      title: 'Catatan kondisi kulit dan rambut cenderung stabil pada periode ini',
      detail:
        'Tidak terlihat lonjakan tajam pada tingkat jerawat maupun perubahan mencolok setelah penggunaan produk pada rentang tanggal ini.',
    });
  }

  return observations;
}

export function getDueReminders(params: {
  routines: Routine[];
  routineLogs: RoutineLog[];
  currentDate: string;
  currentTimeHHMM: string;
  remindersEnabled: boolean;
  dismissedKeys?: string[];
}): DueRoutineReminder[] {
  const { routines, routineLogs, currentDate, currentTimeHHMM, remindersEnabled, dismissedKeys = [] } =
    params;
  if (!remindersEnabled) return [];

  const todayRootLogs = routineLogs.filter(
    (l) => l.log_date === currentDate && l.routine_item_id === null,
  );
  const dismissedSet = new Set(dismissedKeys);

  return routines
    .filter((routine) => {
      if (!routine.is_enabled || !routine.reminder_enabled) return false;
      if (!isRoutineScheduledOnDate(routine, currentDate)) return false;
      // Never remind if already logged (completed, skipped, or missed) today
      if (findLatestLogForRoutine(todayRootLogs, routine.id)) return false;
      const reminderTime = (routine.reminder_time || routine.scheduled_time).slice(0, 5);
      if (reminderTime > currentTimeHHMM) return false;
      if (dismissedSet.has(`${currentDate}:${routine.id}`)) return false;
      return true;
    })
    .map((routine) => ({
      routine,
      reminderTime: (routine.reminder_time || routine.scheduled_time).slice(0, 5),
    }))
    .sort((a, b) => a.reminderTime.localeCompare(b.reminderTime));
}

export function findLatestLogForRoutine(
  logs: RoutineLog[],
  routineId: string,
): RoutineLog | undefined {
  const matching = logs.filter((l) => l.routine_id === routineId);
  if (matching.length === 0) return undefined;
  return matching.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}
