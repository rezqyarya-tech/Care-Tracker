import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  createHairJournal,
  createProduct,
  createRoutine,
  createSkinJournal,
  deleteHairJournal,
  deleteJournalPhoto,
  deleteProduct,
  deleteRoutine,
  deleteSkinJournal,
  fetchJournalsAndPhotos,
  fetchProductsAndHistory,
  fetchRoutinesAndLogs,
  logRoutineActivity,
  updateHairJournal,
  updateProduct,
  updateRoutine,
  updateSkinJournal,
  uploadJournalPhoto,
} from '../lib/api/repository';
import { optimizePhotoToDataUrl } from '../lib/utils/image';
import type {
  HairJournal,
  HairJournalInput,
  JournalPhoto,
  Product,
  ProductHistoryEntry,
  ProductInput,
  Routine,
  RoutineCompletionStatus,
  RoutineInput,
  RoutineLog,
  SkinJournal,
  SkinJournalInput,
} from '../types/database';
import { useOwnerProfile } from './useOwnerProfile';

interface TrackerDataContextValue {
  products: Product[];
  productHistory: ProductHistoryEntry[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  skinJournals: SkinJournal[];
  hairJournals: HairJournal[];
  photos: JournalPhoto[];
  loading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  addProduct: (input: ProductInput) => Promise<Product>;
  editProduct: (
    id: string,
    updates: Partial<ProductInput> & { history_note?: string },
  ) => Promise<Product>;
  removeProduct: (id: string) => Promise<void>;
  addRoutine: (input: RoutineInput) => Promise<Routine>;
  editRoutine: (id: string, updates: Partial<RoutineInput>) => Promise<Routine>;
  removeRoutine: (id: string) => Promise<void>;
  recordRoutineLog: (input: {
    routine_id: string;
    routine_item_id?: string | null;
    log_date: string;
    status: RoutineCompletionStatus;
    note?: string;
  }) => Promise<RoutineLog>;
  addSkinJournal: (input: SkinJournalInput) => Promise<SkinJournal>;
  editSkinJournal: (id: string, input: Partial<SkinJournalInput>) => Promise<SkinJournal>;
  removeSkinJournal: (id: string) => Promise<void>;
  addHairJournal: (input: HairJournalInput) => Promise<HairJournal>;
  editHairJournal: (id: string, input: Partial<HairJournalInput>) => Promise<HairJournal>;
  removeHairJournal: (id: string) => Promise<void>;
  addPhoto: (input: {
    journal_type: 'face' | 'hair';
    skin_journal_id?: string | null;
    hair_journal_id?: string | null;
    entry_date: string;
    caption: string;
    file: File;
  }) => Promise<JournalPhoto>;
  removePhoto: (photo: JournalPhoto) => Promise<void>;
}

const TrackerDataContext = createContext<TrackerDataContextValue | null>(null);

export function TrackerDataProvider({ children }: { children: ReactNode }) {
  const { profile } = useOwnerProfile();
  const [products, setProducts] = useState<Product[]>([]);
  const [productHistory, setProductHistory] = useState<ProductHistoryEntry[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineLogs, setRoutineLogs] = useState<RoutineLog[]>([]);
  const [skinJournals, setSkinJournals] = useState<SkinJournal[]>([]);
  const [hairJournals, setHairJournals] = useState<HairJournal[]>([]);
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    setError(null);
    try {
      const [prodRes, routineRes, journalRes] = await Promise.all([
        fetchProductsAndHistory(),
        fetchRoutinesAndLogs(),
        fetchJournalsAndPhotos(),
      ]);
      setProducts(prodRes.products);
      setProductHistory(prodRes.history);
      setRoutines(routineRes.routines);
      setRoutineLogs(routineRes.logs);
      setSkinJournals(journalRes.skin);
      setHairJournals(journalRes.hair);
      setPhotos(journalRes.photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak dapat memuat catatan Anda.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const addProduct = useCallback(async (input: ProductInput) => {
    const res = await createProduct(input);
    setProducts((prev) => [res.product, ...prev]);
    setProductHistory((prev) => [res.historyEntry, ...prev]);
    return res.product;
  }, []);

  const editProduct = useCallback(
    async (
      id: string,
      updates: Partial<ProductInput> & { history_note?: string },
    ) => {
      const updated = await updateProduct(id, updates);
      const refreshed = await fetchProductsAndHistory();
      setProducts(refreshed.products);
      setProductHistory(refreshed.history);
      return updated;
    },
    [],
  );

  const removeProduct = useCallback(async (id: string) => {
    await deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setProductHistory((prev) => prev.filter((h) => h.product_id !== id));
  }, []);

  const addRoutine = useCallback(async (input: RoutineInput) => {
    const created = await createRoutine(input);
    setRoutines((prev) =>
      [...prev, created].sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)),
    );
    return created;
  }, []);

  const editRoutine = useCallback(async (id: string, updates: Partial<RoutineInput>) => {
    const updated = await updateRoutine(id, updates);
    setRoutines((prev) =>
      prev
        .map((r) => (r.id === id ? updated : r))
        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)),
    );
    return updated;
  }, []);

  const removeRoutine = useCallback(async (id: string) => {
    await deleteRoutine(id);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    setRoutineLogs((prev) => prev.filter((l) => l.routine_id !== id));
  }, []);

  const recordRoutineLog = useCallback(
    async (input: {
      routine_id: string;
      routine_item_id?: string | null;
      log_date: string;
      status: RoutineCompletionStatus;
      note?: string;
    }) => {
      const saved = await logRoutineActivity(input);
      setRoutineLogs((prev) => {
        const filtered = prev.filter(
          (l) =>
            !(
              l.routine_id === input.routine_id &&
              l.routine_item_id === (input.routine_item_id ?? null) &&
              l.log_date === input.log_date
            ),
        );
        return [saved, ...filtered];
      });
      return saved;
    },
    [],
  );

  const addSkinJournal = useCallback(async (input: SkinJournalInput) => {
    const created = await createSkinJournal(input);
    setSkinJournals((prev) =>
      [created, ...prev].sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    );
    return created;
  }, []);

  const editSkinJournal = useCallback(async (id: string, input: Partial<SkinJournalInput>) => {
    const updated = await updateSkinJournal(id, input);
    setSkinJournals((prev) =>
      prev
        .map((j) => (j.id === id ? updated : j))
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    );
    return updated;
  }, []);

  const removeSkinJournal = useCallback(async (id: string) => {
    await deleteSkinJournal(id);
    setSkinJournals((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const addHairJournal = useCallback(async (input: HairJournalInput) => {
    const created = await createHairJournal(input);
    setHairJournals((prev) =>
      [created, ...prev].sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    );
    return created;
  }, []);

  const editHairJournal = useCallback(async (id: string, input: Partial<HairJournalInput>) => {
    const updated = await updateHairJournal(id, input);
    setHairJournals((prev) =>
      prev
        .map((j) => (j.id === id ? updated : j))
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    );
    return updated;
  }, []);

  const removeHairJournal = useCallback(async (id: string) => {
    await deleteHairJournal(id);
    setHairJournals((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const addPhoto = useCallback(
    async (input: {
      journal_type: 'face' | 'hair';
      skin_journal_id?: string | null;
      hair_journal_id?: string | null;
      entry_date: string;
      caption: string;
      file: File;
    }) => {
      const dataUrl = await optimizePhotoToDataUrl(input.file);
      const created = await uploadJournalPhoto({
        journal_type: input.journal_type,
        skin_journal_id: input.skin_journal_id,
        hair_journal_id: input.hair_journal_id,
        entry_date: input.entry_date,
        caption: input.caption,
        dataUrl,
      });
      setPhotos((prev) =>
        [created, ...prev].sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
      );
      return created;
    },
    [],
  );

  const removePhoto = useCallback(async (photo: JournalPhoto) => {
    await deleteJournalPhoto(photo);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }, []);

  return (
    <TrackerDataContext.Provider
      value={{
        products,
        productHistory,
        routines,
        routineLogs,
        skinJournals,
        hairJournals,
        photos,
        loading,
        error,
        refreshAll,
        addProduct,
        editProduct,
        removeProduct,
        addRoutine,
        editRoutine,
        removeRoutine,
        recordRoutineLog,
        addSkinJournal,
        editSkinJournal,
        removeSkinJournal,
        addHairJournal,
        editHairJournal,
        removeHairJournal,
        addPhoto,
        removePhoto,
      }}
    >
      {children}
    </TrackerDataContext.Provider>
  );
}

export function useTrackerData(): TrackerDataContextValue {
  const ctx = useContext(TrackerDataContext);
  if (!ctx) throw new Error('useTrackerData harus digunakan di dalam TrackerDataProvider');
  return ctx;
}
