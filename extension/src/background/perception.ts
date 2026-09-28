import type { BoundingBox } from '../shared/schemas';

export interface ScreenshotResult {
  dataUrl: string;
  width: number;
  height: number;
}

export async function captureScreenshot(): Promise<ScreenshotResult> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab({ format: 'png', quality: 90 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!dataUrl) {
        reject(new Error('Screenshot capture returned empty result'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        resolve({ dataUrl, width: img.width, height: img.height });
      };
      img.onerror = () => {
        resolve({ dataUrl, width: 0, height: 0 });
      };
      img.src = dataUrl;
    });
  });
}

export async function requestDomExtraction(tabId: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_DOM' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

export interface PerceptionSnapshot {
  dom: {
    elements: unknown[];
    url: string;
    title: string;
    viewport: { width: number; height: number };
    scrollPosition: { x: number; y: number };
    devicePixelRatio: number;
    timestamp: number;
    pageHeight: number;
    pageWidth: number;
  };
  screenshot: ScreenshotResult;
}

export async function perceiveTab(tabId: number): Promise<PerceptionSnapshot> {
  const [dom, screenshot] = await Promise.all([
    requestDomExtraction(tabId),
    captureScreenshot(),
  ]);

  return {
    dom: dom as PerceptionSnapshot['dom'],
    screenshot,
  };
}

export function mapDomToScreenshot(
  box: BoundingBox,
  scrollPosition: { x: number; y: number },
  devicePixelRatio: number,
): BoundingBox {
  const dpr = devicePixelRatio;
  return {
    x: Math.round((box.x - scrollPosition.x) * dpr),
    y: Math.round((box.y - scrollPosition.y) * dpr),
    width: Math.round(box.width * dpr),
    height: Math.round(box.height * dpr),
  };
}
