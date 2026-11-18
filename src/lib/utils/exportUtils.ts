import { jsPDF } from 'jspdf';
import type {
  HairJournal,
  JournalPhoto,
  Product,
  ProductHistoryEntry,
  Routine,
  RoutineLog,
  SkinJournal,
  UserProfile,
} from '../../types/database';
import {
  ACNE_TYPE_OPTIONS,
  CARE_AREA_LABELS,
  GENERAL_HAIR_CONDITION_OPTIONS,
  OILINESS_OPTIONS,
  PRODUCT_STATUS_LABELS,
  ROUTINE_COMPLETION_LABELS,
  ROUTINE_TYPE_LABELS,
  SCALP_CONDITION_OPTIONS,
  SEVERITY_OPTIONS,
  SHEDDING_OPTIONS,
  getOptionLabel,
} from './constants';
import { formatLongLocalDate, formatShortDate } from './date';

export type ExportDatasetKey =
  | 'products'
  | 'routines'
  | 'skin_journals'
  | 'hair_journals'
  | 'photos';

export function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvString(headers: string[], rows: Array<Array<unknown>>): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
}

export function triggerTextDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildProductsCsv(products: Product[]): string {
  const headers = [
    'Nama Produk',
    'Merek',
    'Area Perawatan',
    'Kategori',
    'Status',
    'Tanggal Mulai',
    'Tanggal Selesai',
    'Frekuensi Pemakaian',
    'Catatan',
  ];
  const rows = products.map((p) => [
    p.name,
    p.brand,
    CARE_AREA_LABELS[p.care_area],
    p.category,
    PRODUCT_STATUS_LABELS[p.status],
    p.start_date,
    p.end_date ?? '',
    p.usage_frequency,
    p.notes,
  ]);
  return buildCsvString(headers, rows);
}

export function buildRoutinesAndLogsCsv(routines: Routine[], logs: RoutineLog[]): string {
  const routineMap = new Map(routines.map((r) => [r.id, r]));
  const headers = [
    'Tanggal Aktivitas',
    'Nama Rutinitas',
    'Area Perawatan',
    'Kategori Rutinitas',
    'Status',
    'Waktu Ditandai Selesai',
    'Catatan',
  ];
  const rows = logs.map((l) => {
    const r = routineMap.get(l.routine_id);
    return [
      l.log_date,
      r?.name ?? 'Rutinitas dihapus',
      r ? CARE_AREA_LABELS[r.care_area] : '',
      r ? ROUTINE_TYPE_LABELS[r.routine_type] : '',
      ROUTINE_COMPLETION_LABELS[l.status],
      l.completed_at ?? '',
      l.note,
    ];
  });
  return buildCsvString(headers, rows);
}

export function buildSkinJournalsCsv(entries: SkinJournal[]): string {
  const headers = [
    'Tanggal',
    'Tingkat Jerawat (0-10)',
    'Jenis Jerawat',
    'Lokasi Jerawat',
    'Kadar Minyak',
    'Iritasi',
    'Kemerahan',
    'Kering/Mengelupas',
    'Faktor Konteks',
    'Catatan',
  ];
  const rows = entries.map((e) => [
    e.entry_date,
    e.acne_severity,
    getOptionLabel(ACNE_TYPE_OPTIONS, e.acne_type),
    e.acne_locations.join('; '),
    getOptionLabel(OILINESS_OPTIONS, e.oiliness),
    getOptionLabel(SEVERITY_OPTIONS, e.irritation),
    getOptionLabel(SEVERITY_OPTIONS, e.redness),
    getOptionLabel(SEVERITY_OPTIONS, e.dryness_peeling),
    e.context_factors.join('; '),
    e.notes,
  ]);
  return buildCsvString(headers, rows);
}

export function buildHairJournalsCsv(entries: HairJournal[]): string {
  const headers = [
    'Tanggal',
    'Kondisi Kulit Kepala',
    'Kadar Minyak',
    'Ketombe',
    'Rasa Gatal',
    'Tingkat Kerontokan',
    'Kondisi Umum',
    'Keramas',
    'Faktor Konteks',
    'Catatan',
  ];
  const rows = entries.map((e) => [
    e.entry_date,
    getOptionLabel(SCALP_CONDITION_OPTIONS, e.scalp_condition),
    getOptionLabel(OILINESS_OPTIONS, e.hair_oiliness),
    getOptionLabel(SEVERITY_OPTIONS, e.dandruff),
    getOptionLabel(SEVERITY_OPTIONS, e.scalp_itching),
    getOptionLabel(SHEDDING_OPTIONS, e.shedding_level),
    getOptionLabel(GENERAL_HAIR_CONDITION_OPTIONS, e.general_condition),
    e.washed_hair ? 'Ya' : 'Tidak',
    e.context_factors.join('; '),
    e.notes,
  ]);
  return buildCsvString(headers, rows);
}

export function buildSummaryPdf(params: {
  profile: UserProfile | null;
  products: Product[];
  productHistory: ProductHistoryEntry[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  skinJournals: SkinJournal[];
  hairJournals: HairJournal[];
  photos: JournalPhoto[];
  selectedDatasets: ExportDatasetKey[];
}): void {
  const {
    profile,
    products,
    routines,
    routineLogs,
    skinJournals,
    hairJournals,
    photos,
    selectedDatasets,
  } = params;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 52;
  const left = 44;
  const maxWidth = 505;

  const ensureSpace = (needed = 24) => {
    if (y + needed > 790) {
      doc.addPage();
      y = 52;
    }
  };

  const addHeading = (text: string) => {
    ensureSpace(32);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(52, 74, 58);
    doc.text(text, left, y);
    y += 18;
  };

  const addLine = (text: string, muted = false) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(muted ? 110 : 40, muted ? 118 : 52, muted ? 110 : 44);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, left, y);
      y += 14;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(52, 74, 58);
  doc.text('Personal Care Tracker — Ringkasan Data', left, y);
  y += 20;

  addLine(
    `Pemilik: ${profile?.full_name ?? 'Pemilik Pribadi'} | Zona waktu: ${profile?.timezone ?? 'Asia/Jakarta'}`,
    true,
  );
  addLine(`Tanggal ekspor: ${formatLongLocalDate(new Date(), profile?.timezone || 'Asia/Jakarta')}`, true);
  y += 10;

  if (selectedDatasets.includes('products')) {
    addHeading(`Produk Terdaftar (${products.length})`);
    if (products.length === 0) {
      addLine('Belum ada produk tercatat.', true);
    } else {
      for (const p of products.slice(0, 30)) {
        addLine(
          `- ${p.name}${p.brand ? ` (${p.brand})` : ''} | ${CARE_AREA_LABELS[p.care_area]} | ${PRODUCT_STATUS_LABELS[p.status]} | Mulai ${formatShortDate(p.start_date)}`,
        );
      }
    }
    y += 8;
  }

  if (selectedDatasets.includes('routines')) {
    const completedCount = routineLogs.filter((l) => l.status === 'completed' && l.routine_item_id === null).length;
    addHeading(`Rutinitas & Aktivitas (${routines.length} rutinitas, ${completedCount} selesai tercatat)`);
    if (routines.length === 0) {
      addLine('Belum ada rutinitas tercatat.', true);
    } else {
      for (const r of routines.slice(0, 25)) {
        addLine(
          `- ${r.name} (${CARE_AREA_LABELS[r.care_area]} · ${ROUTINE_TYPE_LABELS[r.routine_type]} · ${r.scheduled_time.slice(0, 5)})`,
        );
      }
    }
    y += 8;
  }

  if (selectedDatasets.includes('skin_journals')) {
    const avgAcne =
      skinJournals.length > 0
        ? (skinJournals.reduce((s, e) => s + e.acne_severity, 0) / skinJournals.length).toFixed(1)
        : '—';
    addHeading(`Catatan Harian Wajah (${skinJournals.length} entri · Rata-rata jerawat: ${avgAcne}/10)`);
    for (const s of skinJournals.slice(0, 20)) {
      addLine(
        `- ${formatShortDate(s.entry_date)}: Jerawat ${s.acne_severity}/10 (${getOptionLabel(ACNE_TYPE_OPTIONS, s.acne_type)}), Minyak ${getOptionLabel(OILINESS_OPTIONS, s.oiliness)}${s.notes ? ` — ${s.notes}` : ''}`,
      );
    }
    y += 8;
  }

  if (selectedDatasets.includes('hair_journals')) {
    const washCount = hairJournals.filter((h) => h.washed_hair).length;
    addHeading(`Catatan Harian Rambut (${hairJournals.length} entri · ${washCount} hari keramas)`);
    for (const h of hairJournals.slice(0, 20)) {
      addLine(
        `- ${formatShortDate(h.entry_date)}: Kulit kepala ${getOptionLabel(SCALP_CONDITION_OPTIONS, h.scalp_condition)}, Ketombe ${getOptionLabel(SEVERITY_OPTIONS, h.dandruff)}, Rontok ${getOptionLabel(SHEDDING_OPTIONS, h.shedding_level)}${h.washed_hair ? ' [Keramas]' : ''}${h.notes ? ` — ${h.notes}` : ''}`,
      );
    }
    y += 8;
  }

  if (selectedDatasets.includes('photos')) {
    addHeading(`Metadata Foto Progres (${photos.length} foto)`);
    for (const ph of photos.slice(0, 20)) {
      addLine(`- ${formatShortDate(ph.entry_date)} (${ph.journal_type === 'face' ? 'Wajah' : 'Rambut'}): ${ph.caption || 'Foto dokumentasi'}`);
    }
  }

  y += 10;
  addLine(
    'Catatan: Ringkasan ini merupakan dokumentasi pribadi dan bukan diagnosis medis atau kesimpulan sebab-akibat langsung.',
    true,
  );

  doc.save(`personal-care-ringkasan-${new Date().toISOString().slice(0, 10)}.pdf`);
}
