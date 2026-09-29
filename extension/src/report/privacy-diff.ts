import type { ElementInfo, RedactedElement } from '../shared/schemas';
import type { DetectionResult } from '../detectors/pipeline';

export interface DiffEntry {
  elementId: string;
  field: string;
  original: string;
  redacted: string;
  piiType: string;
}

export interface PrivacyDiff {
  entries: DiffEntry[];
  stats: {
    totalFields: number;
    redactedFields: number;
    piiTypesFound: string[];
  };
}

const DIFFABLE_FIELDS = ['text', 'label', 'placeholder'] as const;

export function computePrivacyDiff(
  originalElements: ElementInfo[],
  redactedElements: RedactedElement[],
  detectionResult: DetectionResult,
): PrivacyDiff {
  const redactedById = new Map<string, RedactedElement>();
  for (const el of redactedElements) {
    redactedById.set(el.id, el);
  }

  const entries: DiffEntry[] = [];
  const piiTypesSet = new Set<string>();
  let totalFields = 0;

  for (const original of originalElements) {
    const redacted = redactedById.get(original.id);
    if (!redacted) continue;

    const detections = detectionResult.elementDetections.get(original.id) ?? [];
    const primaryType = detections.length > 0
      ? detections.reduce((a, b) => (a.confidence > b.confidence ? a : b)).type
      : 'UNKNOWN_SENSITIVE';

    for (const field of DIFFABLE_FIELDS) {
      const originalValue = original[field];
      const redactedValue = redacted[field];

      if (originalValue === undefined && redactedValue === undefined) continue;
      totalFields += 1;

      const origStr = originalValue ?? '';
      const redStr = redactedValue ?? '';

      if (origStr !== redStr) {
        piiTypesSet.add(primaryType);
        entries.push({
          elementId: original.id,
          field,
          original: origStr,
          redacted: redStr,
          piiType: primaryType,
        });
      }
    }
  }

  return {
    entries,
    stats: {
      totalFields,
      redactedFields: entries.length,
      piiTypesFound: Array.from(piiTypesSet),
    },
  };
}
