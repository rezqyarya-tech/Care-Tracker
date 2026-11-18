export async function optimizePhotoToDataUrl(
  file: File,
  maxDimension = 1600,
  quality = 0.82,
): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file);
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return rawDataUrl;
  }

  try {
    const img = await loadImage(rawDataUrl);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return rawDataUrl;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const outputMime = file.type === 'image/png' && scale === 1 && file.size < 450_000
      ? 'image/png'
      : 'image/webp';
    const optimized = canvas.toDataURL(outputMime, quality);
    if (!optimized.startsWith('data:image/')) {
      return canvas.toDataURL('image/jpeg', quality);
    }
    return optimized.length < rawDataUrl.length ? optimized : rawDataUrl;
  } catch {
    return rawDataUrl;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memproses gambar.'));
    img.src = src;
  });
}
