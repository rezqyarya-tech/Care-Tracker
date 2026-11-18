import { useMemo, useState, type FormEvent } from 'react';
import { Camera, Columns2, Download, Edit3, Eye, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { Modal } from '../components/shared/Modal';
import { useOwnerProfile } from '../hooks/useOwnerProfile';
import { useTrackerData } from '../hooks/useTrackerData';
import {
  ACNE_LOCATIONS,
  ACNE_TYPE_OPTIONS,
  CONTEXT_FACTOR_OPTIONS,
  DEFAULT_TIMEZONE,
  GENERAL_HAIR_CONDITION_OPTIONS,
  OILINESS_OPTIONS,
  SCALP_CONDITION_OPTIONS,
  SEVERITY_OPTIONS,
  SHEDDING_OPTIONS,
  getOptionLabel,
} from '../lib/utils/constants';
import { formatShortDate, getLocalDateString } from '../lib/utils/date';
import {
  hasValidationErrors,
  validateHairJournalForm,
  validateSkinJournalForm,
} from '../lib/validations/forms';
import type {
  AcneType,
  GeneralHairCondition,
  HairJournal,
  JournalPhoto,
  OilinessLevel,
  ScalpCondition,
  SeverityLevel,
  SheddingLevel,
  SkinJournal,
} from '../types/database';

interface JournalPageProps {
  initialTab?: 'face' | 'hair' | 'history' | 'photos';
}

const HISTORY_PAGE_SIZE = 15;
const PHOTO_PAGE_SIZE = 12;

export function JournalPage({ initialTab = 'face' }: JournalPageProps) {
  const { profile } = useOwnerProfile();
  const {
    skinJournals,
    hairJournals,
    photos,
    addSkinJournal,
    editSkinJournal,
    removeSkinJournal,
    addHairJournal,
    editHairJournal,
    removeHairJournal,
    addPhoto,
    removePhoto,
  } = useTrackerData();

  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const today = getLocalDateString(new Date(), timeZone);

  const [activeTab, setActiveTab] = useState<'face' | 'hair' | 'history' | 'photos'>(initialTab);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Face Journal State (create or edit)
  const [editingSkinId, setEditingSkinId] = useState<string | null>(null);
  const [faceDate, setFaceDate] = useState(today);
  const [acneSeverity, setAcneSeverity] = useState(0);
  const [acneType, setAcneType] = useState<AcneType>('no_acne');
  const [acneLocations, setAcneLocations] = useState<string[]>([]);
  const [faceOiliness, setFaceOiliness] = useState<OilinessLevel>('normal');
  const [irritation, setIrritation] = useState<SeverityLevel>('none');
  const [redness, setRedness] = useState<SeverityLevel>('none');
  const [drynessPeeling, setDrynessPeeling] = useState<SeverityLevel>('none');
  const [faceContext, setFaceContext] = useState<string[]>([]);
  const [faceNotes, setFaceNotes] = useState('');
  const [facePhotoFile, setFacePhotoFile] = useState<File | null>(null);

  // Hair Journal State (create or edit)
  const [editingHairId, setEditingHairId] = useState<string | null>(null);
  const [hairDate, setHairDate] = useState(today);
  const [scalpCondition, setScalpCondition] = useState<ScalpCondition>('balanced');
  const [hairOiliness, setHairOiliness] = useState<OilinessLevel>('normal');
  const [dandruff, setDandruff] = useState<SeverityLevel>('none');
  const [scalpItching, setScalpItching] = useState<SeverityLevel>('none');
  const [sheddingLevel, setSheddingLevel] = useState<SheddingLevel>('normal');
  const [generalCondition, setGeneralCondition] = useState<GeneralHairCondition>('healthy');
  const [washedHair, setWashedHair] = useState(false);
  const [hairContext, setHairContext] = useState<string[]>([]);
  const [hairNotes, setHairNotes] = useState('');
  const [hairPhotoFile, setHairPhotoFile] = useState<File | null>(null);

  // Unified History Filter & Pagination
  const [historyFilterArea, setHistoryFilterArea] = useState<'all' | 'face' | 'hair'>('all');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);
  const [photoLimit, setPhotoLimit] = useState(PHOTO_PAGE_SIZE);

  // Detail Modal, Compare, Delete State
  const [detailEntry, setDetailEntry] = useState<
    | { kind: 'skin'; item: SkinJournal }
    | { kind: 'hair'; item: HairJournal }
    | null
  >(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<
    | { kind: 'skin'; item: SkinJournal }
    | { kind: 'hair'; item: HairJournal }
    | { kind: 'photo'; item: JournalPhoto }
    | null
  >(null);

  const toggleItem = (list: string[], value: string, setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const resetFaceForm = () => {
    setEditingSkinId(null);
    setFaceDate(today);
    setAcneSeverity(0);
    setAcneType('no_acne');
    setAcneLocations([]);
    setFaceOiliness('normal');
    setIrritation('none');
    setRedness('none');
    setDrynessPeeling('none');
    setFaceContext([]);
    setFaceNotes('');
    setFacePhotoFile(null);
  };

  const startEditSkin = (entry: SkinJournal) => {
    setEditingSkinId(entry.id);
    setFaceDate(entry.entry_date);
    setAcneSeverity(entry.acne_severity);
    setAcneType(entry.acne_type);
    setAcneLocations(entry.acne_locations);
    setFaceOiliness(entry.oiliness);
    setIrritation(entry.irritation);
    setRedness(entry.redness);
    setDrynessPeeling(entry.dryness_peeling);
    setFaceContext(entry.context_factors);
    setFaceNotes(entry.notes);
    setFacePhotoFile(null);
    setDetailEntry(null);
    setActiveTab('face');
    setFormError(null);
    setSavedFeedback(null);
  };

  const resetHairForm = () => {
    setEditingHairId(null);
    setHairDate(today);
    setScalpCondition('balanced');
    setHairOiliness('normal');
    setDandruff('none');
    setScalpItching('none');
    setSheddingLevel('normal');
    setGeneralCondition('healthy');
    setWashedHair(false);
    setHairContext([]);
    setHairNotes('');
    setHairPhotoFile(null);
  };

  const startEditHair = (entry: HairJournal) => {
    setEditingHairId(entry.id);
    setHairDate(entry.entry_date);
    setScalpCondition(entry.scalp_condition);
    setHairOiliness(entry.hair_oiliness);
    setDandruff(entry.dandruff);
    setScalpItching(entry.scalp_itching);
    setSheddingLevel(entry.shedding_level);
    setGeneralCondition(entry.general_condition);
    setWashedHair(entry.washed_hair);
    setHairContext(entry.context_factors);
    setHairNotes(entry.notes);
    setHairPhotoFile(null);
    setDetailEntry(null);
    setActiveTab('hair');
    setFormError(null);
    setSavedFeedback(null);
  };

  const handleFaceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    setSavedFeedback(null);

    const payload = {
      entry_date: faceDate,
      acne_severity: acneSeverity,
      acne_type: acneType,
      acne_locations: acneLocations,
      oiliness: faceOiliness,
      irritation,
      redness,
      dryness_peeling: drynessPeeling,
      context_factors: faceContext,
      notes: faceNotes.trim(),
    };

    const errs = validateSkinJournalForm(payload);
    if (hasValidationErrors(errs)) {
      setFormError(errs.entry_date || errs.acne_severity || 'Silakan periksa kembali isian formulir.');
      return;
    }

    setSaving(true);
    try {
      let entryId = editingSkinId;
      if (editingSkinId) {
        const updated = await editSkinJournal(editingSkinId, payload);
        entryId = updated.id;
      } else {
        const created = await addSkinJournal(payload);
        entryId = created.id;
      }

      if (facePhotoFile && entryId) {
        await addPhoto({
          journal_type: 'face',
          skin_journal_id: entryId,
          entry_date: faceDate,
          caption: `Catatan wajah (${formatShortDate(faceDate)})`,
          file: facePhotoFile,
        });
      }

      const wasEditing = Boolean(editingSkinId);
      resetFaceForm();
      setSavedFeedback(
        wasEditing
          ? 'Perubahan catatan harian wajah berhasil disimpan.'
          : 'Catatan harian wajah berhasil disimpan.',
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tidak dapat menyimpan catatan wajah.');
    } finally {
      setSaving(false);
    }
  };

  const handleHairSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    setSavedFeedback(null);

    const payload = {
      entry_date: hairDate,
      scalp_condition: scalpCondition,
      hair_oiliness: hairOiliness,
      dandruff,
      scalp_itching: scalpItching,
      shedding_level: sheddingLevel,
      general_condition: generalCondition,
      washed_hair: washedHair,
      context_factors: hairContext,
      notes: hairNotes.trim(),
    };

    const errs = validateHairJournalForm(payload);
    if (hasValidationErrors(errs)) {
      setFormError(errs.entry_date || 'Silakan periksa kembali isian formulir.');
      return;
    }

    setSaving(true);
    try {
      let entryId = editingHairId;
      if (editingHairId) {
        const updated = await editHairJournal(editingHairId, payload);
        entryId = updated.id;
      } else {
        const created = await addHairJournal(payload);
        entryId = created.id;
      }

      if (hairPhotoFile && entryId) {
        await addPhoto({
          journal_type: 'hair',
          hair_journal_id: entryId,
          entry_date: hairDate,
          caption: `Catatan rambut (${formatShortDate(hairDate)})`,
          file: hairPhotoFile,
        });
      }

      const wasEditing = Boolean(editingHairId);
      resetHairForm();
      setSavedFeedback(
        wasEditing
          ? 'Perubahan catatan harian rambut berhasil disimpan.'
          : 'Catatan harian rambut berhasil disimpan.',
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tidak dapat menyimpan catatan rambut.');
    } finally {
      setSaving(false);
    }
  };

  const handleStandalonePhotoUpload = async (
    file: File | null,
    journalType: 'face' | 'hair',
  ) => {
    if (!file) return;
    setSaving(true);
    setFormError(null);
    try {
      await addPhoto({
        journal_type: journalType,
        entry_date: today,
        caption: `Foto ${journalType === 'face' ? 'wajah' : 'rambut'} (${formatShortDate(today)})`,
        file,
      });
      setSavedFeedback('Foto progres pribadi berhasil dioptimalkan dan disimpan.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal mengunggah foto.');
    } finally {
      setSaving(false);
    }
  };

  const toggleComparePhoto = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const unifiedHistory = useMemo(() => {
    const combined: Array<
      | { kind: 'skin'; date: string; createdAt: string; item: SkinJournal }
      | { kind: 'hair'; date: string; createdAt: string; item: HairJournal }
    > = [];

    if (historyFilterArea === 'all' || historyFilterArea === 'face') {
      for (const s of skinJournals) {
        combined.push({ kind: 'skin', date: s.entry_date, createdAt: s.created_at, item: s });
      }
    }
    if (historyFilterArea === 'all' || historyFilterArea === 'hair') {
      for (const h of hairJournals) {
        combined.push({ kind: 'hair', date: h.entry_date, createdAt: h.created_at, item: h });
      }
    }

    return combined
      .filter((entry) => {
        if (historyStartDate && entry.date < historyStartDate) return false;
        if (historyEndDate && entry.date > historyEndDate) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [skinJournals, hairJournals, historyFilterArea, historyStartDate, historyEndDate]);

  const selectedComparePhotos = photos.filter((p) => compareIds.includes(p.id));

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white border border-[#E2E7DF]">
          {(
            [
              { id: 'face', label: 'Catatan Wajah' },
              { id: 'hair', label: 'Catatan Rambut' },
              { id: 'history', label: `Riwayat Harian (${skinJournals.length + hairJournals.length})` },
              { id: 'photos', label: `Galeri Foto (${photos.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setFormError(null);
                setSavedFeedback(null);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#E7EDE5] text-[#344A3A]'
                  : 'text-[#616C62] hover:text-[#344A3A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-[#8A918A]">
          Dirancang untuk catatan harian 1–2 menit · Foto dioptimalkan otomatis
        </p>
      </div>

      {formError && (
        <div className="p-3.5 rounded-xl bg-[#FDF2F1] border border-[#EBCAC6] text-xs text-[#A94438]">
          {formError}
        </div>
      )}

      {savedFeedback && (
        <div className="p-3.5 rounded-xl bg-[#E7EDE5] border border-[#C6D5C2] text-xs text-[#344A3A]">
          {savedFeedback}
        </div>
      )}

      {/* FACE JOURNAL TAB */}
      {activeTab === 'face' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <form
            onSubmit={handleFaceSubmit}
            className="lg:col-span-3 bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E2E7DF]">
              <div>
                <h2 className="font-display text-base font-semibold text-[#344A3A]">
                  {editingSkinId ? 'Ubah Catatan Wajah' : 'Catat Kondisi Wajah'}
                </h2>
                {editingSkinId && (
                  <button
                    type="button"
                    onClick={resetFaceForm}
                    className="text-xs text-[#78917A] hover:underline mt-0.5"
                  >
                    Batalkan ubah &amp; buat catatan baru
                  </button>
                )}
              </div>
              <input
                type="date"
                aria-label="Tanggal catatan wajah"
                value={faceDate}
                onChange={(e) => setFaceDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E2E7DF] bg-[#F8F9F6] text-xs text-[#344A3A] tabular-nums"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="acne-severity" className="text-xs font-medium text-[#616C62]">
                  Tingkat Keparahan Jerawat (0–10)
                </label>
                <span className="text-sm font-semibold text-[#344A3A] tabular-nums">
                  {acneSeverity} / 10
                </span>
              </div>
              <input
                id="acne-severity"
                type="range"
                min={0}
                max={10}
                value={acneSeverity}
                onChange={(e) => setAcneSeverity(Number(e.target.value))}
                className="w-full accent-[#78917A]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="acne-type" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Jenis Jerawat
                </label>
                <select
                  id="acne-type"
                  value={acneType}
                  onChange={(e) => setAcneType(e.target.value as AcneType)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                >
                  {ACNE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="face-oiliness" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Kadar Minyak Wajah
                </label>
                <select
                  id="face-oiliness"
                  value={faceOiliness}
                  onChange={(e) => setFaceOiliness(e.target.value as OilinessLevel)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                >
                  {OILINESS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#616C62] mb-1.5">
                Lokasi Jerawat (jika ada)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ACNE_LOCATIONS.map((loc) => {
                  const selected = acneLocations.includes(loc);
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => toggleItem(acneLocations, loc, setAcneLocations)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-[#E7EDE5] border-[#78917A] text-[#344A3A]'
                          : 'bg-white border-[#E2E7DF] text-[#616C62]'
                      }`}
                    >
                      {loc}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="face-irritation" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Iritasi Kulit
                </label>
                <select
                  id="face-irritation"
                  value={irritation}
                  onChange={(e) => setIrritation(e.target.value as SeverityLevel)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                >
                  {SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="face-redness" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Kemerahan
                </label>
                <select
                  id="face-redness"
                  value={redness}
                  onChange={(e) => setRedness(e.target.value as SeverityLevel)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                >
                  {SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="face-dryness" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Kering / Mengelupas
                </label>
                <select
                  id="face-dryness"
                  value={drynessPeeling}
                  onChange={(e) => setDrynessPeeling(e.target.value as SeverityLevel)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                >
                  {SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#616C62] mb-1.5">
                Faktor Konteks Opsional
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CONTEXT_FACTOR_OPTIONS.map((factor) => {
                  const selected = faceContext.includes(factor);
                  return (
                    <button
                      key={factor}
                      type="button"
                      onClick={() => toggleItem(faceContext, factor, setFaceContext)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-[#E7EDE5] border-[#78917A] text-[#344A3A]'
                          : 'bg-white border-[#E2E7DF] text-[#616C62]'
                      }`}
                    >
                      {factor}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="face-notes" className="block text-xs font-medium text-[#616C62] mb-1.5">
                Catatan Tambahan
              </label>
              <textarea
                id="face-notes"
                rows={2}
                value={faceNotes}
                onChange={(e) => setFaceNotes(e.target.value)}
                placeholder="Reaksi yang terasa, perih, atau perkembangan kondisi kulit..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E2E7DF]">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E2E7DF] bg-[#F8F9F6] text-xs font-medium text-[#344A3A] cursor-pointer">
                <Camera className="w-4 h-4 text-[#78917A]" />
                <span>{facePhotoFile ? facePhotoFile.name : 'Lampirkan foto wajah pribadi'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setFacePhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] disabled:opacity-50 whitespace-nowrap"
              >
                {saving
                  ? 'Menyimpan...'
                  : editingSkinId
                    ? 'Simpan Perubahan Wajah'
                    : 'Simpan Catatan Wajah'}
              </button>
            </div>
          </form>

          {/* Recent Face Entries */}
          <div className="lg:col-span-2 bg-white border border-[#E2E7DF] rounded-2xl p-6">
            <h3 className="font-display text-base font-semibold text-[#344A3A] pb-4 border-b border-[#E2E7DF]">
              Catatan Wajah Terbaru
            </h3>
            {skinJournals.length === 0 ? (
              <p className="text-xs text-[#8A918A] py-8 text-center">
                Belum ada catatan harian wajah.
              </p>
            ) : (
              <div className="divide-y divide-[#E2E7DF]">
                {skinJournals.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="py-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#344A3A] tabular-nums">
                        {formatShortDate(entry.entry_date)} · Jerawat {entry.acne_severity}/10
                      </p>
                      <p className="text-xs text-[#8A918A] mt-0.5">
                        {getOptionLabel(ACNE_TYPE_OPTIONS, entry.acne_type)} · Minyak:{' '}
                        {getOptionLabel(OILINESS_OPTIONS, entry.oiliness)} · Iritasi:{' '}
                        {getOptionLabel(SEVERITY_OPTIONS, entry.irritation)}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-[#616C62] mt-1 line-clamp-2">{entry.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Lihat detail catatan wajah ${entry.entry_date}`}
                        onClick={() => setDetailEntry({ kind: 'skin', item: entry })}
                        className="p-1.5 rounded-lg text-[#8A918A] hover:text-[#344A3A]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Ubah catatan wajah ${entry.entry_date}`}
                        onClick={() => startEditSkin(entry)}
                        className="p-1.5 rounded-lg text-[#8A918A] hover:text-[#344A3A]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Hapus catatan wajah tanggal ${entry.entry_date}`}
                        onClick={() => setDeleteConfirm({ kind: 'skin', item: entry })}
                        className="p-1.5 rounded-lg text-[#8A918A] hover:text-[#A94438]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HAIR JOURNAL TAB */}
      {activeTab === 'hair' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <form
            onSubmit={handleHairSubmit}
            className="lg:col-span-3 bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E2E7DF]">
              <div>
                <h2 className="font-display text-base font-semibold text-[#344A3A]">
                  {editingHairId ? 'Ubah Catatan Rambut' : 'Catat Kondisi Rambut & Kulit Kepala'}
                </h2>
                {editingHairId && (
                  <button
                    type="button"
                    onClick={resetHairForm}
                    className="text-xs text-[#78917A] hover:underline mt-0.5"
                  >
                    Batalkan ubah &amp; buat catatan baru
                  </button>
                )}
              </div>
              <input
                type="date"
                aria-label="Tanggal catatan rambut"
                value={hairDate}
                onChange={(e) => setHairDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E2E7DF] bg-[#F8F9F6] text-xs text-[#344A3A] tabular-nums"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="scalp-cond" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Kondisi Kulit Kepala
                </label>
                <select
                  id="scalp-cond"
                  value={scalpCondition}
                  onChange={(e) => setScalpCondition(e.target.value as ScalpCondition)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                >
                  {SCALP_CONDITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="hair-oiliness" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Kadar Minyak Rambut
                </label>
                <select
                  id="hair-oiliness"
                  value={hairOiliness}
                  onChange={(e) => setHairOiliness(e.target.value as OilinessLevel)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                >
                  {OILINESS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="hair-dandruff" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Ketombe
                </label>
                <select
                  id="hair-dandruff"
                  value={dandruff}
                  onChange={(e) => setDandruff(e.target.value as SeverityLevel)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                >
                  {SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="hair-itching" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Gatal Kulit Kepala
                </label>
                <select
                  id="hair-itching"
                  value={scalpItching}
                  onChange={(e) => setScalpItching(e.target.value as SeverityLevel)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                >
                  {SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="hair-shedding" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Tingkat Kerontokan
                </label>
                <select
                  id="hair-shedding"
                  value={sheddingLevel}
                  onChange={(e) => setSheddingLevel(e.target.value as SheddingLevel)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                >
                  {SHEDDING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label htmlFor="hair-general" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Kondisi Rambut Secara Umum
                </label>
                <select
                  id="hair-general"
                  value={generalCondition}
                  onChange={(e) => setGeneralCondition(e.target.value as GeneralHairCondition)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
                >
                  {GENERAL_HAIR_CONDITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2.5 pt-4 cursor-pointer text-sm text-[#344A3A]">
                <input
                  type="checkbox"
                  checked={washedHair}
                  onChange={(e) => setWashedHair(e.target.checked)}
                  className="w-4 h-4 accent-[#78917A]"
                />
                <span>Keramas / memakai sampo pada tanggal ini</span>
              </label>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#616C62] mb-1.5">
                Faktor Konteks Opsional
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CONTEXT_FACTOR_OPTIONS.map((factor) => {
                  const selected = hairContext.includes(factor);
                  return (
                    <button
                      key={factor}
                      type="button"
                      onClick={() => toggleItem(hairContext, factor, setHairContext)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-[#E7EDE5] border-[#78917A] text-[#344A3A]'
                          : 'bg-white border-[#E2E7DF] text-[#616C62]'
                      }`}
                    >
                      {factor}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="hair-notes" className="block text-xs font-medium text-[#616C62] mb-1.5">
                Catatan Tambahan
              </label>
              <textarea
                id="hair-notes"
                rows={2}
                value={hairNotes}
                onChange={(e) => setHairNotes(e.target.value)}
                placeholder="Kenyamanan kulit kepala, tekstur rambut, atau catatan setelah keramas..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A]"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E2E7DF]">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E2E7DF] bg-[#F8F9F6] text-xs font-medium text-[#344A3A] cursor-pointer">
                <Camera className="w-4 h-4 text-[#78917A]" />
                <span>{hairPhotoFile ? hairPhotoFile.name : 'Lampirkan foto rambut pribadi'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setHairPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] disabled:opacity-50 whitespace-nowrap"
              >
                {saving
                  ? 'Menyimpan...'
                  : editingHairId
                    ? 'Simpan Perubahan Rambut'
                    : 'Simpan Catatan Rambut'}
              </button>
            </div>
          </form>

          {/* Recent Hair Entries */}
          <div className="lg:col-span-2 bg-white border border-[#E2E7DF] rounded-2xl p-6">
            <h3 className="font-display text-base font-semibold text-[#344A3A] pb-4 border-b border-[#E2E7DF]">
              Catatan Rambut Terbaru
            </h3>
            {hairJournals.length === 0 ? (
              <p className="text-xs text-[#8A918A] py-8 text-center">
                Belum ada catatan harian rambut.
              </p>
            ) : (
              <div className="divide-y divide-[#E2E7DF]">
                {hairJournals.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="py-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#344A3A] tabular-nums">
                        {formatShortDate(entry.entry_date)} · Kulit kepala{' '}
                        {getOptionLabel(SCALP_CONDITION_OPTIONS, entry.scalp_condition).toLowerCase()}
                      </p>
                      <p className="text-xs text-[#8A918A] mt-0.5">
                        Ketombe: {getOptionLabel(SEVERITY_OPTIONS, entry.dandruff)} · Rontok:{' '}
                        {getOptionLabel(SHEDDING_OPTIONS, entry.shedding_level)} ·{' '}
                        {entry.washed_hair ? 'Keramas' : 'Tidak keramas'}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-[#616C62] mt-1 line-clamp-2">{entry.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Lihat detail catatan rambut ${entry.entry_date}`}
                        onClick={() => setDetailEntry({ kind: 'hair', item: entry })}
                        className="p-1.5 rounded-lg text-[#8A918A] hover:text-[#344A3A]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Ubah catatan rambut ${entry.entry_date}`}
                        onClick={() => startEditHair(entry)}
                        className="p-1.5 rounded-lg text-[#8A918A] hover:text-[#344A3A]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Hapus catatan rambut tanggal ${entry.entry_date}`}
                        onClick={() => setDeleteConfirm({ kind: 'hair', item: entry })}
                        className="p-1.5 rounded-lg text-[#8A918A] hover:text-[#A94438]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* UNIFIED DAILY HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E2E7DF]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#344A3A]">
                Riwayat Catatan Harian
              </h2>
              <p className="text-xs text-[#8A918A]">
                Telusuri, lihat detail, ubah, atau hapus catatan kondisi wajah dan rambut berdasarkan tanggal.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]">
                {(['all', 'face', 'hair'] as const).map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => {
                      setHistoryFilterArea(area);
                      setHistoryLimit(HISTORY_PAGE_SIZE);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${
                      historyFilterArea === area
                        ? 'bg-white text-[#344A3A] shadow-xs'
                        : 'text-[#616C62]'
                    }`}
                  >
                    {area === 'all' ? 'Semua' : area === 'face' ? 'Wajah' : 'Rambut'}
                  </button>
                ))}
              </div>

              <div className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                <input
                  type="date"
                  aria-label="Filter tanggal mulai riwayat"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-[#E2E7DF] bg-white text-xs text-[#344A3A] tabular-nums"
                />
                <span className="text-xs text-[#8A918A]">–</span>
                <input
                  type="date"
                  aria-label="Filter tanggal akhir riwayat"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-[#E2E7DF] bg-white text-xs text-[#344A3A] tabular-nums"
                />
              </div>
              {(historyStartDate || historyEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryStartDate('');
                    setHistoryEndDate('');
                  }}
                  className="text-xs text-[#78917A] hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {unifiedHistory.length === 0 ? (
            <p className="text-sm text-[#8A918A] py-10 text-center">
              Belum ada catatan harian yang sesuai dengan filter saat ini.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="divide-y divide-[#E2E7DF]">
                {unifiedHistory.slice(0, historyLimit).map((row) => {
                  const linkedPhotos = photos.filter((p) =>
                    row.kind === 'skin'
                      ? p.skin_journal_id === row.item.id
                      : p.hair_journal_id === row.item.id,
                  );

                  return (
                    <div
                      key={`${row.kind}:${row.item.id}`}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[#E7EDE5] text-[#344A3A]">
                            {row.kind === 'skin' ? 'Wajah' : 'Rambut'}
                          </span>
                          <span className="text-sm font-semibold text-[#344A3A] tabular-nums">
                            {formatShortDate(row.date)}
                          </span>
                          {linkedPhotos.length > 0 && (
                            <span className="text-xs text-[#8A918A]">
                              · {linkedPhotos.length} foto terlampir
                            </span>
                          )}
                        </div>

                        {row.kind === 'skin' ? (
                          <p className="text-xs text-[#616C62]">
                            Jerawat {row.item.acne_severity}/10 (
                            {getOptionLabel(ACNE_TYPE_OPTIONS, row.item.acne_type)}) · Minyak:{' '}
                            {getOptionLabel(OILINESS_OPTIONS, row.item.oiliness)} · Iritasi:{' '}
                            {getOptionLabel(SEVERITY_OPTIONS, row.item.irritation)}
                          </p>
                        ) : (
                          <p className="text-xs text-[#616C62]">
                            Kulit kepala{' '}
                            {getOptionLabel(
                              SCALP_CONDITION_OPTIONS,
                              row.item.scalp_condition,
                            ).toLowerCase()}{' '}
                            · Ketombe: {getOptionLabel(SEVERITY_OPTIONS, row.item.dandruff)} ·
                            Rontok: {getOptionLabel(SHEDDING_OPTIONS, row.item.shedding_level)} ·{' '}
                            {row.item.washed_hair ? 'Keramas' : 'Tidak keramas'}
                          </p>
                        )}

                        {row.item.notes && (
                          <p className="text-xs text-[#344A3A]/85">{row.item.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setDetailEntry(
                              row.kind === 'skin'
                                ? { kind: 'skin', item: row.item }
                                : { kind: 'hair', item: row.item },
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-[#E2E7DF] text-xs font-medium text-[#344A3A] hover:bg-[#F8F9F6]"
                        >
                          Detail
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            row.kind === 'skin'
                              ? startEditSkin(row.item)
                              : startEditHair(row.item)
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-[#E2E7DF] text-xs font-medium text-[#344A3A] hover:bg-[#F8F9F6]"
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm(
                              row.kind === 'skin'
                                ? { kind: 'skin', item: row.item }
                                : { kind: 'hair', item: row.item },
                            )
                          }
                          className="p-1.5 rounded-lg border border-[#E2E7DF] text-[#A94438] hover:bg-[#FDF2F1]"
                          aria-label={`Hapus catatan ${row.date}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {unifiedHistory.length > historyLimit && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE_SIZE)}
                    className="px-4 py-2 rounded-xl border border-[#E2E7DF] text-xs font-medium text-[#344A3A] hover:bg-[#F8F9F6]"
                  >
                    Muat lebih banyak ({unifiedHistory.length - historyLimit} tersisa)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PHOTO TIMELINE TAB */}
      {activeTab === 'photos' && (
        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E7DF]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#344A3A]">
                Galeri &amp; Perbandingan Foto Pribadi
              </h2>
              <p className="text-xs text-[#8A918A]">
                Foto disimpan di penyimpanan privat, dapat diunduh, dan dibandingkan berdampingan.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {compareIds.length === 2 && (
                <button
                  type="button"
                  onClick={() => setCompareOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E7EDE5] text-[#344A3A] text-xs font-medium"
                >
                  <Columns2 className="w-4 h-4" />
                  Bandingkan 2 Foto
                </button>
              )}
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2E7DF] bg-[#F8F9F6] text-xs font-medium text-[#344A3A] cursor-pointer">
                <Camera className="w-3.5 h-3.5 text-[#78917A]" />
                Unggah Foto Wajah
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    void handleStandalonePhotoUpload(e.target.files?.[0] ?? null, 'face');
                  }}
                />
              </label>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2E7DF] bg-[#F8F9F6] text-xs font-medium text-[#344A3A] cursor-pointer">
                <Camera className="w-3.5 h-3.5 text-[#78917A]" />
                Unggah Foto Rambut
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    void handleStandalonePhotoUpload(e.target.files?.[0] ?? null, 'hair');
                  }}
                />
              </label>
            </div>
          </div>

          {photos.length === 0 ? (
            <p className="text-sm text-[#8A918A] py-10 text-center">
              Belum ada foto progres diunggah. Lampirkan foto saat menyimpan catatan harian atau
              unggah langsung di atas.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {photos.slice(0, photoLimit).map((photo) => {
                  const selected = compareIds.includes(photo.id);
                  return (
                    <div
                      key={photo.id}
                      className={`rounded-xl border overflow-hidden bg-[#F8F9F6] ${
                        selected ? 'border-[#78917A] ring-2 ring-[#78917A]/30' : 'border-[#E2E7DF]'
                      }`}
                    >
                      <div className="aspect-4/3 bg-[#E7EDE5]/40 overflow-hidden">
                        {photo.signed_url ? (
                          <img
                            src={photo.signed_url}
                            alt={
                              photo.caption ||
                              `Foto progres ${photo.journal_type === 'face' ? 'wajah' : 'rambut'}`
                            }
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-[#8A918A]">
                            Foto pribadi
                          </div>
                        )}
                      </div>
                      <div className="p-3 flex items-center justify-between gap-2 bg-white">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#344A3A] tabular-nums">
                            {formatShortDate(photo.entry_date)} ·{' '}
                            {photo.journal_type === 'face' ? 'Wajah' : 'Rambut'}
                          </p>
                          <p className="text-xs text-[#8A918A] truncate">
                            {photo.caption || 'Foto dokumentasi'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleComparePhoto(photo.id)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium border ${
                              selected
                                ? 'bg-[#E7EDE5] border-[#78917A] text-[#344A3A]'
                                : 'bg-white border-[#E2E7DF] text-[#616C62]'
                            }`}
                          >
                            {selected ? 'Dipilih' : 'Bandingkan'}
                          </button>
                          {photo.signed_url && (
                            <a
                              href={photo.signed_url}
                              download={`foto-${photo.journal_type}-${photo.entry_date}.jpg`}
                              aria-label={`Unduh foto tanggal ${photo.entry_date}`}
                              className="p-1.5 rounded-lg text-[#8A918A] hover:text-[#344A3A]"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            aria-label={`Hapus foto tanggal ${photo.entry_date}`}
                            onClick={() => setDeleteConfirm({ kind: 'photo', item: photo })}
                            className="p-1.5 rounded-lg text-[#8A918A] hover:text-[#A94438]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {photos.length > photoLimit && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setPhotoLimit((n) => n + PHOTO_PAGE_SIZE)}
                    className="px-4 py-2 rounded-xl border border-[#E2E7DF] text-xs font-medium text-[#344A3A] hover:bg-[#F8F9F6]"
                  >
                    Muat lebih banyak foto ({photos.length - photoLimit} tersisa)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        open={Boolean(detailEntry)}
        onClose={() => setDetailEntry(null)}
        title={
          detailEntry
            ? `${detailEntry.kind === 'skin' ? 'Detail Catatan Wajah' : 'Detail Catatan Rambut'} · ${formatShortDate(detailEntry.item.entry_date)}`
            : ''
        }
      >
        {detailEntry && (
          <div className="space-y-4 text-sm">
            {detailEntry.kind === 'skin' ? (
              <div className="space-y-2 text-xs text-[#344A3A]">
                <p>
                  <strong>Tingkat Jerawat:</strong> {detailEntry.item.acne_severity}/10 (
                  {getOptionLabel(ACNE_TYPE_OPTIONS, detailEntry.item.acne_type)})
                </p>
                <p>
                  <strong>Lokasi Jerawat:</strong>{' '}
                  {detailEntry.item.acne_locations.length > 0
                    ? detailEntry.item.acne_locations.join(', ')
                    : 'Tidak dicatat'}
                </p>
                <p>
                  <strong>Kadar Minyak:</strong>{' '}
                  {getOptionLabel(OILINESS_OPTIONS, detailEntry.item.oiliness)}
                </p>
                <p>
                  <strong>Iritasi / Kemerahan / Kering:</strong>{' '}
                  {getOptionLabel(SEVERITY_OPTIONS, detailEntry.item.irritation)} /{' '}
                  {getOptionLabel(SEVERITY_OPTIONS, detailEntry.item.redness)} /{' '}
                  {getOptionLabel(SEVERITY_OPTIONS, detailEntry.item.dryness_peeling)}
                </p>
                <p>
                  <strong>Faktor Konteks:</strong>{' '}
                  {detailEntry.item.context_factors.length > 0
                    ? detailEntry.item.context_factors.join(', ')
                    : 'Tidak ada'}
                </p>
                {detailEntry.item.notes && (
                  <p className="p-3 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]">
                    {detailEntry.item.notes}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-xs text-[#344A3A]">
                <p>
                  <strong>Kulit Kepala:</strong>{' '}
                  {getOptionLabel(SCALP_CONDITION_OPTIONS, detailEntry.item.scalp_condition)}
                </p>
                <p>
                  <strong>Kadar Minyak Rambut:</strong>{' '}
                  {getOptionLabel(OILINESS_OPTIONS, detailEntry.item.hair_oiliness)}
                </p>
                <p>
                  <strong>Ketombe / Gatal:</strong>{' '}
                  {getOptionLabel(SEVERITY_OPTIONS, detailEntry.item.dandruff)} /{' '}
                  {getOptionLabel(SEVERITY_OPTIONS, detailEntry.item.scalp_itching)}
                </p>
                <p>
                  <strong>Kerontokan:</strong>{' '}
                  {getOptionLabel(SHEDDING_OPTIONS, detailEntry.item.shedding_level)}
                </p>
                <p>
                  <strong>Kondisi Umum:</strong>{' '}
                  {getOptionLabel(
                    GENERAL_HAIR_CONDITION_OPTIONS,
                    detailEntry.item.general_condition,
                  )}
                </p>
                <p>
                  <strong>Keramas:</strong> {detailEntry.item.washed_hair ? 'Ya' : 'Tidak'}
                </p>
                <p>
                  <strong>Faktor Konteks:</strong>{' '}
                  {detailEntry.item.context_factors.length > 0
                    ? detailEntry.item.context_factors.join(', ')
                    : 'Tidak ada'}
                </p>
                {detailEntry.item.notes && (
                  <p className="p-3 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]">
                    {detailEntry.item.notes}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E7DF]">
              <button
                type="button"
                onClick={() =>
                  detailEntry.kind === 'skin'
                    ? startEditSkin(detailEntry.item)
                    : startEditHair(detailEntry.item)
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#78917A] text-white text-xs font-medium hover:bg-[#678069]"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Ubah Catatan Ini
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Side-by-Side Comparison Modal */}
      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Perbandingan Foto"
        description="Bandingkan dua dokumentasi foto secara berdampingan."
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {selectedComparePhotos.map((photo) => (
              <div key={photo.id} className="space-y-2">
                <div className="aspect-4/3 rounded-xl overflow-hidden border border-[#E2E7DF] bg-[#F8F9F6]">
                  {photo.signed_url && (
                    <img
                      src={photo.signed_url}
                      alt={photo.caption}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <p className="text-xs font-medium text-[#344A3A] tabular-nums">
                  {formatShortDate(photo.entry_date)} ·{' '}
                  {photo.journal_type === 'face' ? 'Wajah' : 'Rambut'}
                </p>
                {photo.caption && <p className="text-xs text-[#616C62]">{photo.caption}</p>}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#8A918A]">
            Catatan: Pencahayaan dan sudut kamera dapat memengaruhi tampilan visual. Gunakan sebagai
            dokumentasi pengamatan pribadi, bukan diagnosis medis.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          if (!deleteConfirm) return;
          if (deleteConfirm.kind === 'skin') await removeSkinJournal(deleteConfirm.item.id);
          else if (deleteConfirm.kind === 'hair') await removeHairJournal(deleteConfirm.item.id);
          else await removePhoto(deleteConfirm.item);
          setDeleteConfirm(null);
        }}
        title="Konfirmasi penghapusan"
        message="Hapus catatan ini secara permanen? Tindakan ini tidak dapat dibatalkan."
      />
    </div>
  );
}
