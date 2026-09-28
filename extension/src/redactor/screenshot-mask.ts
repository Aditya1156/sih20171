import type { BoundingBox } from '../shared/schemas';

const MASK_MARGIN_PX = 4;
const MASK_COLOR = '#000000';

export interface MaskRegion {
  boundingBox: BoundingBox;
  margin?: number;
}

export function maskScreenshot(
  base64DataUrl: string,
  regions: MaskRegion[],
): Promise<string> {
  if (regions.length === 0) return Promise.resolve(base64DataUrl);

  return new Promise((resolve, reject) => {
    if (typeof OffscreenCanvas !== 'undefined') {
      maskWithOffscreen(base64DataUrl, regions).then(resolve, reject);
    } else {
      resolve(maskFallback(base64DataUrl, regions));
    }
  });
}

async function maskWithOffscreen(
  base64DataUrl: string,
  regions: MaskRegion[],
): Promise<string> {
  const response = await fetch(base64DataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);

  ctx.fillStyle = MASK_COLOR;
  for (const region of regions) {
    const m = region.margin ?? MASK_MARGIN_PX;
    const x = Math.max(0, region.boundingBox.x - m);
    const y = Math.max(0, region.boundingBox.y - m);
    const w = Math.min(bitmap.width - x, region.boundingBox.width + 2 * m);
    const h = Math.min(bitmap.height - y, region.boundingBox.height + 2 * m);
    ctx.fillRect(x, y, w, h);
  }

  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(outBlob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function maskFallback(
  base64DataUrl: string,
  _regions: MaskRegion[],
): string {
  return base64DataUrl;
}

export function computeMaskRegions(
  detections: Array<{ boundingBox?: BoundingBox }>,
): MaskRegion[] {
  const regions: MaskRegion[] = [];
  for (const d of detections) {
    if (d.boundingBox && d.boundingBox.width > 0 && d.boundingBox.height > 0) {
      regions.push({ boundingBox: d.boundingBox });
    }
  }
  return regions;
}
