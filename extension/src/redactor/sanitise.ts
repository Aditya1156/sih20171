import type { ElementInfo, RedactedElement, SanitisedContext, SensitiveType } from '../shared/schemas';
import type { DetectionResult } from '../detectors/pipeline';
import type { Detection } from '../detectors/types';
import type { SensitivityMode } from '../detectors/types';
import { createPlaceholderMap, replaceWithPlaceholders, resetCounters } from './placeholder';
import type { PlaceholderMap } from './placeholder';
import { maskScreenshot, computeMaskRegions } from './screenshot-mask';
import { storeInVault } from '../vault/vault';

export interface SanitiseInput {
  url: string;
  title: string;
  elements: ElementInfo[];
  detectionResult: DetectionResult;
  screenshotBase64?: string;
  viewport: { width: number; height: number };
  scrollPosition: { x: number; y: number };
  mode: SensitivityMode;
}

export interface SanitiseOutput {
  context: SanitisedContext;
  placeholderMap: PlaceholderMap;
}

export async function sanitise(input: SanitiseInput): Promise<SanitiseOutput> {
  resetCounters();
  const map = createPlaceholderMap();

  const redactedElements = redactElements(input.elements, input.detectionResult, map);

  let maskedScreenshot = input.screenshotBase64;
  if (maskedScreenshot) {
    const regions = computeMaskRegions(input.detectionResult.detections);
    maskedScreenshot = await maskScreenshot(maskedScreenshot, regions);
  }

  const sanitisedUrl = redactUrlPii(input.url, map);
  const sanitisedTitle = redactTextFields(input.title, input.detectionResult.detections, map);

  storeInVault(map);

  const byType: Partial<Record<SensitiveType, number>> = {};
  for (const d of input.detectionResult.detections) {
    byType[d.type] = (byType[d.type] ?? 0) + 1;
  }

  const context: SanitisedContext = {
    url: sanitisedUrl,
    title: sanitisedTitle,
    elements: redactedElements,
    screenshotBase64: maskedScreenshot,
    viewport: input.viewport,
    scrollPosition: input.scrollPosition,
    timestamp: Date.now(),
    sensitivityMode: input.mode,
    redactionSummary: {
      totalRedacted: input.detectionResult.detections.length,
      byType,
    },
  };

  return { context, placeholderMap: map };
}

function redactElements(
  elements: ElementInfo[],
  result: DetectionResult,
  map: PlaceholderMap,
): RedactedElement[] {
  return elements.map((el) => {
    const detections = result.elementDetections.get(el.id) ?? [];

    const redacted: RedactedElement = {
      id: el.id,
      tag: el.tag,
      role: el.role,
      type: el.type === 'password' ? 'password' : el.type,
      label: el.label,
      placeholder: el.placeholder,
      text: el.text,
      isVisible: el.isVisible,
    };

    if (el.type === 'password') {
      redacted.text = undefined;
      return redacted;
    }

    if (detections.length > 0) {
      const matches = detections
        .filter((d): d is Detection & { matchedText: string } => !!d.matchedText)
        .map((d) => ({ matchedText: d.matchedText, type: d.type }));

      if (redacted.text) {
        redacted.text = replaceWithPlaceholders(redacted.text, matches, map);
      }
      if (redacted.label) {
        redacted.label = replaceWithPlaceholders(redacted.label, matches, map);
      }
      if (redacted.placeholder) {
        redacted.placeholder = replaceWithPlaceholders(redacted.placeholder, matches, map);
      }
    }

    return redacted;
  });
}

function redactTextFields(
  text: string,
  detections: Detection[],
  map: PlaceholderMap,
): string {
  const matches = detections
    .filter((d): d is Detection & { matchedText: string } => !!d.matchedText)
    .map((d) => ({ matchedText: d.matchedText, type: d.type }));

  return replaceWithPlaceholders(text, matches, map);
}

function redactUrlPii(url: string, map: PlaceholderMap): string {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phonePattern = /(?:\+?91[\s-]?|0)?[6-9]\d[\s-]?\d{2,4}[\s-]?\d{4,5}/g;
  const aadhaarPattern = /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g;

  let result = url;
  for (const pattern of [emailPattern, phonePattern, aadhaarPattern]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(url)) !== null) {
      const type: SensitiveType = pattern === emailPattern
        ? 'EMAIL'
        : pattern === phonePattern
          ? 'PHONE'
          : 'AADHAAR';
      const placeholder = replaceWithPlaceholders(match[0], [{ matchedText: match[0], type }], map);
      result = result.replace(match[0], placeholder);
    }
  }
  return result;
}
