import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useOwnerProfile } from '../hooks/useOwnerProfile';
import { useTrackerData } from '../hooks/useTrackerData';
import {
  DEFAULT_TIMEZONE,
  PRODUCT_EVENT_LABELS,
  PRODUCT_STATUS_LABELS,
  SCALP_CONDITION_OPTIONS,
  SHEDDING_OPTIONS,
  getOptionLabel,
} from '../lib/utils/constants';
import { formatShortDate, getDateRangeBounds, getLocalDateString } from '../lib/utils/date';
import {
  analyzeProductBeforeAfter,
  calculateFaceAnalysis,
  calculateHairSeries,
  calculateRangeRoutineCompletion,
  calculateRoutineHighlights,
  calculateShampooFrequency,
  generateAutomaticSummaries,
  generateCautiousObservations,
} from '../lib/utils/insights';

type RangePreset = '7d' | '30d' | '90d' | 'custom';

export function InsightsPage() {
  const { profile } = useOwnerProfile();
  const {
    products,
    productHistory,
    routines,
    routineLogs,
    skinJournals,
    hairJournals,
    photos,
  } = useTrackerData();

  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const today = getLocalDateString(new Date(), timeZone);

  const [preset, setPreset] = useState<RangePreset>('30d');
  const [customStart, setCustomStart] = useState(getDateRangeBounds('30d', today).startDate);
  const [customEnd, setCustomEnd] = useState(today);

  const { startDate, endDate } = useMemo(
    () => getDateRangeBounds(preset, today, customStart, customEnd),
    [preset, today, customStart, customEnd],
  );

  const skinSeries = useMemo(
    () =>
      skinJournals
        .filter((j) => j.entry_date >= startDate && j.entry_date <= endDate)
        .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
        .map((j) => ({
          date: j.entry_date.slice(5),
          fullDate: j.entry_date,
          acneSeverity: j.acne_severity,
          oiliness: j.oiliness,
          irritation: j.irritation,
        })),
    [skinJournals, startDate, endDate],
  );

  const faceAnalysis = useMemo(
    () => calculateFaceAnalysis(skinJournals, startDate, endDate),
    [skinJournals, startDate, endDate],
  );

  const hairInRange = useMemo(
    () =>
      hairJournals
        .filter((j) => j.entry_date >= startDate && j.entry_date <= endDate)
        .sort((a, b) => a.entry_date.localeCompare(b.entry_date)),
    [hairJournals, startDate, endDate],
  );

  const hairSeries = useMemo(
    () => calculateHairSeries(hairJournals, startDate, endDate),
    [hairJournals, startDate, endDate],
  );

  const routineRange = useMemo(
    () => calculateRangeRoutineCompletion(routines, routineLogs, startDate, endDate),
    [routines, routineLogs, startDate, endDate],
  );

  const faceRoutineRange = useMemo(
    () => calculateRangeRoutineCompletion(routines, routineLogs, startDate, endDate, 'face'),
    [routines, routineLogs, startDate, endDate],
  );

  const hairRoutineRange = useMemo(
    () => calculateRangeRoutineCompletion(routines, routineLogs, startDate, endDate, 'hair'),
    [routines, routineLogs, startDate, endDate],
  );

  const routineHighlights = useMemo(
    () => calculateRoutineHighlights(routines, routineLogs, products, startDate, endDate),
    [routines, routineLogs, products, startDate, endDate],
  );

  const shampooStats = useMemo(
    () => calculateShampooFrequency(hairJournals, routineLogs, routines, startDate, endDate),
    [hairJournals, routineLogs, routines, startDate, endDate],
  );

  const automaticSummaries = useMemo(
    () =>
      generateAutomaticSummaries({
        skinJournals,
        hairJournals,
        routines,
        routineLogs,
        startDate,
        endDate,
      }),
    [skinJournals, hairJournals, routines, routineLogs, startDate, endDate],
  );

  const productBeforeAfter = useMemo(
    () => analyzeProductBeforeAfter(products, skinJournals),
    [products, skinJournals],
  );

  const observations = useMemo(
    () =>
      generateCautiousObservations({
        products,
        productHistory,
        skinJournals,
        hairJournals,
        routines,
        routineLogs,
        startDate,
        endDate,
      }),
    [products, productHistory, skinJournals, hairJournals, routines, routineLogs, startDate, endDate],
  );

  const productEventsInRange = useMemo(
    () =>
      productHistory
        .filter((h) => h.effective_date >= startDate && h.effective_date <= endDate)
        .sort((a, b) => b.effective_date.localeCompare(a.effective_date)),
    [productHistory, startDate, endDate],
  );

  const photosInRange = useMemo(
    () => photos.filter((p) => p.entry_date >= startDate && p.entry_date <= endDate),
    [photos, startDate, endDate],
  );

  const productById = new Map(products.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      {/* Date Range Controls */}
      <div className="bg-white border border-[#E2E7DF] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]">
          {(
            [
              { id: '7d', label: '7 hari terakhir' },
              { id: '30d', label: '30 hari terakhir' },
              { id: '90d', label: '90 hari terakhir' },
              { id: 'custom', label: 'Rentang khusus' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                preset === item.id
                  ? 'bg-white text-[#344A3A] shadow-xs'
                  : 'text-[#616C62] hover:text-[#344A3A]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {preset === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="date"
              aria-label="Tanggal mulai"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E2E7DF] bg-white text-[#344A3A] tabular-nums"
            />
            <span className="text-[#8A918A]">sampai</span>
            <input
              type="date"
              aria-label="Tanggal selesai"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E2E7DF] bg-white text-[#344A3A] tabular-nums"
            />
          </div>
        ) : (
          <p className="text-xs text-[#8A918A] tabular-nums">
            {formatShortDate(startDate)} – {formatShortDate(endDate)}
          </p>
        )}
      </div>

      {/* Automatic Summary Sentences */}
      {automaticSummaries.length > 0 && (
        <section className="bg-[#E7EDE5]/60 border border-[#C6D5C2] rounded-2xl p-5 space-y-2">
          <h2 className="font-display text-sm font-semibold text-[#344A3A]">
            Ringkasan Periode Ini
          </h2>
          <ul className="space-y-1.5 text-xs text-[#344A3A] list-disc pl-4">
            {automaticSummaries.map((sentence, idx) => (
              <li key={idx}>{sentence}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-5">
          <p className="text-xs text-[#8A918A]">Konsistensi Rutinitas</p>
          <p className="font-display text-2xl font-semibold text-[#344A3A] mt-2 tabular-nums">
            {routineRange.ratePercent !== null ? `${routineRange.ratePercent}%` : '—'}
          </p>
          <p className="text-xs text-[#8A918A] mt-1 tabular-nums">
            Wajah: {faceRoutineRange.ratePercent !== null ? `${faceRoutineRange.ratePercent}%` : '—'} ·
            Rambut: {hairRoutineRange.ratePercent !== null ? `${hairRoutineRange.ratePercent}%` : '—'}
          </p>
        </div>

        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-5">
          <p className="text-xs text-[#8A918A]">Frekuensi Keramas</p>
          <p className="font-display text-2xl font-semibold text-[#344A3A] mt-2 tabular-nums">
            {shampooStats.weeklyRate !== null ? `${shampooStats.weeklyRate}x / mgg` : '—'}
          </p>
          <p className="text-xs text-[#8A918A] mt-1 tabular-nums">
            {shampooStats.washDays > 0
              ? `${shampooStats.washDays} hari keramas${
                  shampooStats.averageDaysBetweenWashes !== null
                    ? ` · Tiap ${shampooStats.averageDaysBetweenWashes} hari`
                    : ''
                }`
              : 'Belum ada catatan keramas di rentang ini'}
          </p>
        </div>

        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-5">
          <p className="text-xs text-[#8A918A]">Analisis Wajah</p>
          <p className="font-display text-2xl font-semibold text-[#344A3A] mt-2 tabular-nums">
            {faceAnalysis.averageAcne !== null ? `${faceAnalysis.averageAcne} / 10` : '—'}
          </p>
          <p className="text-xs text-[#8A918A] mt-1 tabular-nums">
            {faceAnalysis.entriesCount > 0
              ? `${faceAnalysis.entriesCount} catatan · ${faceAnalysis.acneFrequencyPercent}% hari berjerawat`
              : 'Belum ada catatan wajah di rentang ini'}
          </p>
        </div>

        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-5">
          <p className="text-xs text-[#8A918A]">Analisis Rambut</p>
          <p className="font-display text-2xl font-semibold text-[#344A3A] mt-2 tabular-nums">
            {hairInRange.length} catatan
          </p>
          <p className="text-xs text-[#8A918A] mt-1">
            {hairInRange.length > 0
              ? `Terbaru: ${getOptionLabel(
                  SCALP_CONDITION_OPTIONS,
                  hairInRange[hairInRange.length - 1].scalp_condition,
                )} · Rontok ${getOptionLabel(
                  SHEDDING_OPTIONS,
                  hairInRange[hairInRange.length - 1].shedding_level,
                ).toLowerCase()}`
              : 'Belum ada catatan rambut di rentang ini'}
          </p>
        </div>
      </div>

      {/* Charts: Face & Routine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#344A3A]">
              Tren Tingkat Jerawat (0–10)
            </h2>
            <p className="text-xs text-[#8A918A]">
              Berdasarkan entri Catatan Wajah yang Anda catat
            </p>
          </div>
          {skinSeries.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[#8A918A]">
              Catat entri Catatan Wajah untuk melihat tren tingkat jerawat.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={skinSeries}>
                  <CartesianGrid stroke="#E2E7DF" strokeDasharray="3 3" />
                  <XAxis dataKey="date" minTickGap={18} tick={{ fontSize: 11, fill: '#8A918A' }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#8A918A' }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="acneSeverity"
                    name="Tingkat Jerawat"
                    stroke="#78917A"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#344A3A' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {faceAnalysis.entriesCount > 0 && (
            <div className="pt-3 border-t border-[#E2E7DF] grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#8A918A]">Area Sering Muncul</p>
                <p className="font-medium text-[#344A3A] mt-0.5">
                  {faceAnalysis.topLocations.length > 0
                    ? faceAnalysis.topLocations
                        .slice(0, 3)
                        .map((l) => `${l.location} (${l.count}x)`)
                        .join(', ')
                    : 'Belum ada lokasi tercatat'}
                </p>
              </div>
              <div>
                <p className="text-[#8A918A]">Kondisi Lainnya</p>
                <p className="font-medium text-[#344A3A] mt-0.5 tabular-nums">
                  Berminyak: {faceAnalysis.oilyEntries}x · Iritasi: {faceAnalysis.irritationEntries}x
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#344A3A]">
              Penyelesaian Rutinitas Harian (%)
            </h2>
            <p className="text-xs text-[#8A918A]">
              Pencatatan manual terhadap rutinitas terjadwal
            </p>
          </div>
          {routineRange.totalScheduled === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[#8A918A]">
              Jadwalkan rutinitas dan catat penyelesaiannya untuk melihat konsistensi.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={routineRange.dailySeries.slice(-14)}>
                  <CartesianGrid stroke="#E2E7DF" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5)}
                    minTickGap={18}
                    tick={{ fontSize: 11, fill: '#8A918A' }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#8A918A' }} />
                  <Tooltip />
                  <Bar
                    dataKey="rate"
                    name="Penyelesaian %"
                    fill="#78917A"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {(routineHighlights.mostConsistent || routineHighlights.mostSkipped) && (
            <div className="pt-3 border-t border-[#E2E7DF] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#8A918A]">Paling Konsisten</p>
                <p className="font-medium text-[#344A3A] mt-0.5">
                  {routineHighlights.mostConsistent
                    ? `${routineHighlights.mostConsistent.routine.name} (${routineHighlights.mostConsistent.completed}x selesai)`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[#8A918A]">Paling Sering Dilewati / Terlewat</p>
                <p className="font-medium text-[#344A3A] mt-0.5">
                  {routineHighlights.mostSkipped
                    ? `${routineHighlights.mostSkipped.routine.name} (${routineHighlights.mostSkipped.skippedOrMissed}x)`
                    : 'Tidak ada yang dilewati'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hair Condition Trend Chart */}
      <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-[#344A3A]">
            Tren Kondisi Rambut &amp; Kulit Kepala
          </h2>
          <p className="text-xs text-[#8A918A]">
            Skor deskriptif berdasarkan catatan harian rambut (ketombe &amp; gatal 0–3, kerontokan 1–4)
          </p>
        </div>
        {hairSeries.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-xs text-[#8A918A]">
            Catat entri Catatan Rambut untuk melihat tren ketombe, gatal, dan kerontokan.
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hairSeries}>
                <CartesianGrid stroke="#E2E7DF" strokeDasharray="3 3" />
                <XAxis dataKey="date" minTickGap={18} tick={{ fontSize: 11, fill: '#8A918A' }} />
                <YAxis domain={[0, 4]} tick={{ fontSize: 11, fill: '#8A918A' }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="dandruffScore"
                  name="Ketombe (0–3)"
                  stroke="#78917A"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="itchingScore"
                  name="Gatal (0–3)"
                  stroke="#B7791F"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="sheddingScore"
                  name="Kerontokan (1–4)"
                  stroke="#344A3A"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Product Before/After & Usage Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-4">
          <div className="pb-3 border-b border-[#E2E7DF]">
            <h2 className="font-display text-base font-semibold text-[#344A3A]">
              Pengamatan Sebelum &amp; Sesudah Produk Wajah
            </h2>
            <p className="text-xs text-[#8A918A] mt-0.5">
              Perbandingan 14 hari sebelum dan 14 hari sesudah tanggal mulai pemakaian produk.
            </p>
          </div>

          {productBeforeAfter.length === 0 ? (
            <p className="text-xs text-[#8A918A] py-6 text-center">
              Tambahkan produk perawatan wajah dan catatan harian untuk melihat perbandingan ini.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E7DF]">
              {productBeforeAfter.map((item) => (
                <div key={item.product.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#344A3A]">{item.product.name}</p>
                    <span className="text-xs text-[#8A918A] tabular-nums">
                      Mulai {formatShortDate(item.product.start_date)}
                    </span>
                  </div>
                  <p className="text-xs text-[#616C62] tabular-nums">
                    Sebelum ({item.beforeCount} catatan):{' '}
                    {item.beforeAvgAcne !== null ? `${item.beforeAvgAcne}/10` : '—'} · Sesudah (
                    {item.afterCount} catatan):{' '}
                    {item.afterAvgAcne !== null ? `${item.afterAvgAcne}/10` : '—'}
                    {item.postStopCount > 0 && item.postStopAvgAcne !== null
                      ? ` · Setelah dihentikan (${item.postStopCount}): ${item.postStopAvgAcne}/10`
                      : ''}
                  </p>
                  <p className="text-xs text-[#8A918A] leading-relaxed">{item.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-4">
          <div className="pb-3 border-b border-[#E2E7DF]">
            <h2 className="font-display text-base font-semibold text-[#344A3A]">
              Frekuensi Penggunaan Produk dalam Rutinitas
            </h2>
            <p className="text-xs text-[#8A918A] mt-0.5">
              Dihitung dari rutinitas yang ditandai selesai pada rentang tanggal terpilih.
            </p>
          </div>

          {routineHighlights.productUsageCounts.length === 0 ? (
            <p className="text-xs text-[#8A918A] py-6 text-center">
              Hubungkan produk pada langkah rutinitas dan tandai rutinitas selesai untuk melacak frekuensi penggunaan.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E7DF]">
              {routineHighlights.productUsageCounts.map(({ product, uses }) => (
                <div key={product.id} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-[#344A3A] truncate">{product.name}</span>
                  <span className="text-xs text-[#616C62] tabular-nums shrink-0">
                    {uses}x digunakan
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cautious Observations */}
      <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-4">
        <div className="pb-3 border-b border-[#E2E7DF]">
          <h2 className="font-display text-base font-semibold text-[#344A3A]">
            Pengamatan Deskriptif &amp; Catatan Kehati-hatian
          </h2>
          <p className="text-xs text-[#8A918A] mt-0.5">
            Pola yang teramati dari riwayat catatan Anda. Ringkasan ini bersifat informatif, bukan
            diagnosis medis atau bukti sebab-akibat.
          </p>
        </div>

        <div className="divide-y divide-[#E2E7DF]">
          {observations.map((obs) => (
            <div key={obs.id} className="py-3.5 first:pt-0 last:pb-0">
              <p className="text-xs font-medium text-[#78917A]">{obs.confidenceLabel}</p>
              <p className="text-sm font-semibold text-[#344A3A] mt-0.5">{obs.title}</p>
              <p className="text-xs text-[#616C62] mt-1 leading-relaxed">{obs.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Lifecycle & Photo Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6">
          <h2 className="font-display text-base font-semibold text-[#344A3A] pb-3 border-b border-[#E2E7DF]">
            Linimasa Pengenalan &amp; Status Produk
          </h2>
          {productEventsInRange.length === 0 ? (
            <p className="text-xs text-[#8A918A] py-8 text-center">
              Belum ada perubahan status produk pada rentang tanggal ini.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E7DF]">
              {productEventsInRange.map((evt) => {
                const prod = productById.get(evt.product_id);
                return (
                  <div key={evt.id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#344A3A]">
                        {prod?.name ?? 'Produk'} · {PRODUCT_EVENT_LABELS[evt.event_type]} (
                        {PRODUCT_STATUS_LABELS[evt.new_status]})
                      </p>
                      {evt.note && <p className="text-xs text-[#616C62] mt-0.5">{evt.note}</p>}
                    </div>
                    <span className="text-xs text-[#8A918A] tabular-nums shrink-0">
                      {formatShortDate(evt.effective_date)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6">
          <h2 className="font-display text-base font-semibold text-[#344A3A] pb-3 border-b border-[#E2E7DF]">
            Foto dalam Rentang Terpilih
          </h2>
          {photosInRange.length === 0 ? (
            <p className="text-xs text-[#8A918A] py-8 text-center">
              Tidak ada foto dalam rentang tanggal ini.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
              {photosInRange.slice(0, 6).map((photo) => (
                <div key={photo.id} className="space-y-1">
                  <div className="aspect-square rounded-xl overflow-hidden border border-[#E2E7DF] bg-[#F8F9F6]">
                    {photo.signed_url && (
                      <img
                        src={photo.signed_url}
                        alt={photo.caption}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-[#8A918A] tabular-nums">
                    {formatShortDate(photo.entry_date)} ·{' '}
                    {photo.journal_type === 'face' ? 'Wajah' : 'Rambut'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
