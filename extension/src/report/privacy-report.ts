import type { DetectionResult } from '../detectors/pipeline';
import type { SensitiveType } from '../shared/schemas';

export interface PrivacyReport {
  version: string;
  generatedAt: string;
  page: {
    url: string;
    title: string;
  };
  privacyScore: {
    score: number;
    level: string;
  };
  detections: Array<{
    type: string;
    count: number;
    elements: string[];
  }>;
  redactions: Array<{
    placeholder: string;
    type: string;
    context: string;
  }>;
  summary: {
    totalPiiFound: number;
    totalRedacted: number;
    categoriesFound: string[];
    isHttps: boolean;
    hasPasswordFields: boolean;
  };
}

export function generateReport(params: {
  url: string;
  title: string;
  detectionResult: DetectionResult;
  privacyScore: { score: number; level: string };
  redactions?: Array<{ placeholder: string; type: string }>;
}): PrivacyReport {
  const { url, title, detectionResult, privacyScore, redactions } = params;

  const detectionsByType = new Map<SensitiveType, { count: number; elements: Set<string> }>();
  for (const d of detectionResult.detections) {
    const entry = detectionsByType.get(d.type) ?? { count: 0, elements: new Set<string>() };
    entry.count += 1;
    if (d.elementId) {
      entry.elements.add(d.elementId);
    }
    detectionsByType.set(d.type, entry);
  }

  const detections = Array.from(detectionsByType.entries()).map(([type, { count, elements }]) => ({
    type,
    count,
    elements: Array.from(elements),
  }));

  const reportRedactions = (redactions ?? []).map((r) => ({
    placeholder: r.placeholder,
    type: r.type,
    context: `Redacted ${r.type.toLowerCase()} value`,
  }));

  const categoriesFound = Array.from(detectionsByType.keys());
  const hasPasswordFields = detectionResult.detections.some((d) => d.type === 'PASSWORD');

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    page: { url, title },
    privacyScore,
    detections,
    redactions: reportRedactions,
    summary: {
      totalPiiFound: detectionResult.summary.totalDetected,
      totalRedacted: reportRedactions.length,
      categoriesFound,
      isHttps: url.startsWith('https://'),
      hasPasswordFields,
    },
  };
}

export function downloadReport(report: PrivacyReport): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const timestamp = Date.now();
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `veilagent-report-${timestamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadReportBackground(report: PrivacyReport): void {
  const json = JSON.stringify(report, null, 2);
  const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  const filename = `veilagent-report-${Date.now()}.json`;

  chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: true,
  }).catch(() => {
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_REPORT',
      json,
      filename,
    }).catch(() => {});
  });
}
