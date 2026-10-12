export const MAX_PHOTO_DIMENSION = 1600;
export const PHOTO_QUALITY = 0.8;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unreadable file')));
    reader.onerror = () => reject(reader.error ?? new Error('Unreadable file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = src;
  });
}

export function scaledSize(width: number, height: number, max = MAX_PHOTO_DIMENSION): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Resizes to ≤1600px on the long side and re-encodes as JPEG 0.8. Falls back to the original on failure. */
export async function compressImage(file: Blob): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    const img = await loadImage(original);
    const { width, height } = scaledSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
    if (!width || !height) return original;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, width, height);
    const out = canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
    return out.startsWith('data:image/jpeg') && out.length < original.length * 1.1 ? out : original;
  } catch {
    return original;
  }
}
