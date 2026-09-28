import type { SensitiveType } from '../shared/schemas';

export interface PlaceholderMap {
  valueToPlaceholder: Map<string, string>;
  placeholderToValue: Map<string, string>;
}

export function createPlaceholderMap(): PlaceholderMap {
  return {
    valueToPlaceholder: new Map(),
    placeholderToValue: new Map(),
  };
}

const typeCounters = new Map<SensitiveType, number>();

export function resetCounters(): void {
  typeCounters.clear();
}

function nextCounter(type: SensitiveType): number {
  const current = typeCounters.get(type) ?? 0;
  const next = current + 1;
  typeCounters.set(type, next);
  return next;
}

export function getPlaceholder(
  realValue: string,
  type: SensitiveType,
  map: PlaceholderMap,
): string {
  const normalised = realValue.trim();
  if (!normalised) return '';

  const existing = map.valueToPlaceholder.get(normalised);
  if (existing) return existing;

  const n = nextCounter(type);
  const placeholder = `[${type}_${n}]`;

  map.valueToPlaceholder.set(normalised, placeholder);
  map.placeholderToValue.set(placeholder, normalised);

  return placeholder;
}

export function replaceWithPlaceholders(
  text: string,
  matches: Array<{ matchedText: string; type: SensitiveType }>,
  map: PlaceholderMap,
): string {
  let result = text;
  const sorted = [...matches].sort((a, b) => b.matchedText.length - a.matchedText.length);

  for (const { matchedText, type } of sorted) {
    if (!matchedText) continue;
    const placeholder = getPlaceholder(matchedText, type, map);
    result = result.split(matchedText).join(placeholder);
  }

  return result;
}
