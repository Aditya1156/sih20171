import type { Detection, DetectorInput, DetectorOptions, SensitivityMode } from './types';
import type { ElementInfo, SensitiveType } from '../shared/schemas';
import { l1DomRules } from './l1-dom-rules';
import { l2TextPatterns } from './l2-text-patterns';
import { l3Ner } from './l3-ner';
import { l4Vision } from './l4-vision';

export interface DetectionResult {
  detections: Detection[];
  elementDetections: Map<string, Detection[]>;
  summary: {
    totalDetected: number;
    byType: Partial<Record<SensitiveType, number>>;
    bySource: Record<string, number>;
  };
  latencyMs: number;
}

function toDetectorInput(el: ElementInfo): DetectorInput {
  return {
    id: el.id,
    tag: el.tag,
    type: el.type,
    role: el.role,
    label: el.label,
    placeholder: el.placeholder,
    text: el.text,
    autocomplete: el.autocomplete,
    alt: el.alt,
    boundingBox: el.boundingBox,
    isVisible: el.isVisible,
  };
}

function mergeDetections(all: Detection[]): Detection[] {
  const byElement = new Map<string, Map<SensitiveType, Detection>>();

  for (const d of all) {
    const key = d.elementId ?? `anon-${d.matchedText ?? Math.random()}`;
    if (!byElement.has(key)) {
      byElement.set(key, new Map());
    }
    const typeMap = byElement.get(key)!;

    const existing = typeMap.get(d.type);
    if (!existing || d.confidence > existing.confidence) {
      typeMap.set(d.type, d);
    }
  }

  const merged: Detection[] = [];
  for (const typeMap of byElement.values()) {
    for (const d of typeMap.values()) {
      merged.push(d);
    }
  }

  return merged;
}

export function runDetectionPipeline(
  elements: ElementInfo[],
  mode: SensitivityMode = 'strict',
): DetectionResult {
  const start = performance.now();
  const inputs = elements.map(toDetectorInput);
  const options: DetectorOptions = { mode };

  const l1 = l1DomRules.detect(inputs, options);
  const l2 = l2TextPatterns.detect(inputs, options);
  const l3 = l3Ner.detect(inputs, options);
  const l4 = l4Vision.detect(inputs, options);

  const all = [...l1, ...l2, ...l3, ...l4];
  const merged = mergeDetections(all);

  const elementDetections = new Map<string, Detection[]>();
  for (const d of merged) {
    if (!d.elementId) continue;
    if (!elementDetections.has(d.elementId)) {
      elementDetections.set(d.elementId, []);
    }
    elementDetections.get(d.elementId)!.push(d);
  }

  const byType: Partial<Record<SensitiveType, number>> = {};
  const bySource: Record<string, number> = {};
  for (const d of merged) {
    byType[d.type] = (byType[d.type] ?? 0) + 1;
    bySource[d.source] = (bySource[d.source] ?? 0) + 1;
  }

  const latencyMs = performance.now() - start;

  return {
    detections: merged,
    elementDetections,
    summary: {
      totalDetected: merged.length,
      byType,
      bySource,
    },
    latencyMs,
  };
}

export function markSensitiveElements(
  elements: ElementInfo[],
  result: DetectionResult,
): ElementInfo[] {
  return elements.map((el) => {
    const detections = result.elementDetections.get(el.id);
    if (!detections || detections.length === 0) return el;

    const best = detections.reduce((a, b) => (a.confidence > b.confidence ? a : b));

    return {
      ...el,
      isSensitive: true,
      sensitiveType: best.type,
      confidence: best.confidence,
    };
  });
}
