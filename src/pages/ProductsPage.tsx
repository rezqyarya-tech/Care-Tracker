import { useMemo, useState } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import { ProductDetailModal } from '../components/products/ProductDetailModal';
import { ProductFormModal } from '../components/products/ProductFormModal';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useOwnerProfile } from '../hooks/useOwnerProfile';
import { useTrackerData } from '../hooks/useTrackerData';
import {
  CARE_AREA_LABELS,
  DEFAULT_TIMEZONE,
  PRODUCT_STATUS_LABELS,
} from '../lib/utils/constants';
import {
  calculateUsageDays,
  formatShortDate,
  formatUsageDuration,
  getLocalDateString,
} from '../lib/utils/date';
import type { CareArea, Product, ProductInput, ProductStatus } from '../types/database';

const PAGE_SIZE = 15;

export function ProductsPage() {
  const { profile } = useOwnerProfile();
  const {
    products,
    productHistory,
    routines,
    skinJournals,
    hairJournals,
    loading,
    addProduct,
    editProduct,
    removeProduct,
  } = useTrackerData();

  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const today = getLocalDateString(new Date(), timeZone);

  const [search, setSearch] = useState('');
  const [careFilter, setCareFilter] = useState<'all' | CareArea>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductStatus>('all');
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (careFilter !== 'all' && p.care_area !== careFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.brand.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [products, careFilter, statusFilter, search]);

  const visibleProducts = filteredProducts.slice(0, visibleLimit);

  const handleSaveForm = async (input: ProductInput) => {
    if (editingProduct) {
      await editProduct(editingProduct.id, input);
    } else {
      await addProduct(input);
    }
  };

  const handleStatusChange = async (
    product: Product,
    nextStatus: ProductStatus,
    note: string,
  ) => {
    const updates: Partial<ProductInput> & { history_note?: string } = {
      status: nextStatus,
      history_note: note,
    };
    if (nextStatus === 'discontinued' && !product.end_date) {
      updates.end_date = today;
    } else if (nextStatus === 'active') {
      updates.end_date = null;
    }
    await editProduct(product.id, updates);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await removeProduct(deleteTarget.id);
      if (selectedProductId === deleteTarget.id) setSelectedProductId(null);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[#616C62]">
            Catat setiap produk perawatan wajah dan rambut yang Anda gunakan, termasuk tanggal mulai dan riwayat statusnya.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingProduct(null);
            setFormOpen(true);
          }}
          className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Tambah Produk
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-[#E2E7DF] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-[#8A918A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk, merek, atau kategori..."
            aria-label="Cari produk"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#E2E7DF] bg-[#F8F9F6] text-sm text-[#344A3A] placeholder:text-[#8A918A]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]">
            {(['all', 'face', 'hair'] as const).map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setCareFilter(area)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  careFilter === area
                    ? 'bg-white text-[#344A3A] shadow-xs'
                    : 'text-[#616C62] hover:text-[#344A3A]'
                }`}
              >
                {area === 'all' ? 'Semua Area' : area === 'face' ? 'Wajah' : 'Rambut'}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]">
            {(['all', 'active', 'paused', 'discontinued'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-white text-[#344A3A] shadow-xs'
                    : 'text-[#616C62] hover:text-[#344A3A]'
                }`}
              >
                {status === 'all' ? 'Semua Status' : PRODUCT_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products List */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="h-20 bg-white border border-[#E2E7DF] rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-10 text-center">
          <div className="w-11 h-11 rounded-2xl bg-[#E7EDE5] flex items-center justify-center mx-auto mb-3">
            <Package className="w-5 h-5 text-[#344A3A]" />
          </div>
          <h3 className="font-display text-base font-semibold text-[#344A3A]">
            Belum ada produk ditambahkan
          </h3>
          <p className="text-sm text-[#8A918A] mt-1 max-w-md mx-auto">
            Tambahkan pembersih wajah, pelembap, serum, sampo, atau perawatan rambut untuk mencatat
            kapan Anda mulai menggunakannya.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setFormOpen(true);
            }}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Produk Pertama
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-8 text-center">
          <p className="text-sm text-[#616C62]">Tidak ada produk yang sesuai dengan filter saat ini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border border-[#E2E7DF] rounded-2xl divide-y divide-[#E2E7DF] overflow-hidden">
            {visibleProducts.map((product) => {
              const days = calculateUsageDays(product.start_date, product.end_date, today);
              return (
                <div
                  key={product.id}
                  className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8F9F6]/70 transition-colors"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedProductId(product.id)}
                      className="text-left font-medium text-[#344A3A] hover:text-[#78917A] transition-colors block truncate"
                    >
                      {product.name}
                    </button>
                    <p className="text-xs text-[#8A918A] mt-1 truncate">
                      {product.brand ? `${product.brand} · ` : ''}
                      {CARE_AREA_LABELS[product.care_area]} · {product.category} ·{' '}
                      {product.usage_frequency}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-medium text-[#344A3A] tabular-nums">
                        {formatUsageDuration(days)}
                      </p>
                      <p className="text-xs text-[#8A918A] tabular-nums">
                        Mulai {formatShortDate(product.start_date)}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-medium min-w-[82px] text-right ${
                        product.status === 'active'
                          ? 'text-[#344A3A]'
                          : product.status === 'paused'
                            ? 'text-[#8C6219]'
                            : 'text-[#8A918A]'
                      }`}
                    >
                      {PRODUCT_STATUS_LABELS[product.status]}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedProductId(product.id)}
                      className="px-3 py-1.5 rounded-lg border border-[#E2E7DF] bg-white text-xs font-medium text-[#344A3A] hover:bg-[#E7EDE5]/50 transition-colors whitespace-nowrap"
                    >
                      Detail
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {filteredProducts.length > visibleLimit && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleLimit((n) => n + PAGE_SIZE)}
                className="px-4 py-2 rounded-xl border border-[#E2E7DF] bg-white text-xs font-medium text-[#344A3A] hover:bg-[#F8F9F6]"
              >
                Muat lebih banyak ({filteredProducts.length - visibleLimit} tersisa)
              </button>
            </div>
          )}
        </div>
      )}

      <ProductFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={handleSaveForm}
        initialProduct={editingProduct}
        timezone={timeZone}
      />

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProductId(null)}
        history={productHistory}
        routines={routines}
        skinJournals={skinJournals}
        hairJournals={hairJournals}
        timezone={timeZone}
        onEdit={(prod) => {
          setSelectedProductId(null);
          setEditingProduct(prod);
          setFormOpen(true);
        }}
        onChangeStatus={handleStatusChange}
        onRequestDelete={(prod) => setDeleteTarget(prod)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Hapus catatan produk"
        message={
          deleteTarget
            ? `Hapus permanen "${deleteTarget.name}" beserta riwayat statusnya? Jika ingin menyimpan catatan historis, pertimbangkan menandainya sebagai Dihentikan.`
            : ''
        }
        confirmLabel="Hapus permanen"
        loading={deleting}
      />
    </div>
  );
}
