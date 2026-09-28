import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPlaceholderMap,
  getPlaceholder,
  replaceWithPlaceholders,
  resetCounters,
} from '../src/redactor/placeholder';
import { computeMaskRegions } from '../src/redactor/screenshot-mask';
import type { SensitiveType, BoundingBox } from '../src/shared/schemas';

describe('Placeholder Generator', () => {
  beforeEach(() => {
    resetCounters();
  });

  it('generates typed placeholders with incrementing counters', () => {
    const map = createPlaceholderMap();
    const p1 = getPlaceholder('priya@example.com', 'EMAIL', map);
    const p2 = getPlaceholder('rahul@test.in', 'EMAIL', map);
    const p3 = getPlaceholder('+919876543210', 'PHONE', map);

    expect(p1).toBe('[EMAIL_1]');
    expect(p2).toBe('[EMAIL_2]');
    expect(p3).toBe('[PHONE_1]');
  });

  it('returns the same placeholder for the same real value', () => {
    const map = createPlaceholderMap();
    const p1 = getPlaceholder('priya@example.com', 'EMAIL', map);
    const p2 = getPlaceholder('priya@example.com', 'EMAIL', map);

    expect(p1).toBe(p2);
    expect(p1).toBe('[EMAIL_1]');
  });

  it('trims whitespace from values', () => {
    const map = createPlaceholderMap();
    const p1 = getPlaceholder('  priya@example.com  ', 'EMAIL', map);
    const p2 = getPlaceholder('priya@example.com', 'EMAIL', map);

    expect(p1).toBe(p2);
  });

  it('returns empty string for empty value', () => {
    const map = createPlaceholderMap();
    expect(getPlaceholder('', 'EMAIL', map)).toBe('');
    expect(getPlaceholder('   ', 'EMAIL', map)).toBe('');
  });

  it('stores reverse mapping in the map', () => {
    const map = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map);

    expect(map.placeholderToValue.get('[EMAIL_1]')).toBe('priya@example.com');
    expect(map.valueToPlaceholder.get('priya@example.com')).toBe('[EMAIL_1]');
  });

  it('generates placeholders for all PII types', () => {
    const map = createPlaceholderMap();
    const types: SensitiveType[] = ['EMAIL', 'PHONE', 'AADHAAR', 'PAN', 'CARD', 'UPI', 'IFSC', 'NAME', 'ADDRESS'];

    for (const type of types) {
      const p = getPlaceholder(`test-${type}`, type, map);
      expect(p).toBe(`[${type}_1]`);
    }
  });

  it('resets counters correctly', () => {
    const map1 = createPlaceholderMap();
    getPlaceholder('a@b.com', 'EMAIL', map1);
    getPlaceholder('c@d.com', 'EMAIL', map1);

    resetCounters();

    const map2 = createPlaceholderMap();
    const p = getPlaceholder('e@f.com', 'EMAIL', map2);
    expect(p).toBe('[EMAIL_1]');
  });
});

describe('replaceWithPlaceholders', () => {
  beforeEach(() => {
    resetCounters();
  });

  it('replaces matched text with placeholders', () => {
    const map = createPlaceholderMap();
    const text = 'Contact priya@example.com or call +919876543210';
    const matches = [
      { matchedText: 'priya@example.com', type: 'EMAIL' as SensitiveType },
      { matchedText: '+919876543210', type: 'PHONE' as SensitiveType },
    ];

    const result = replaceWithPlaceholders(text, matches, map);
    expect(result).toBe('Contact [EMAIL_1] or call [PHONE_1]');
  });

  it('replaces multiple occurrences of the same value', () => {
    const map = createPlaceholderMap();
    const text = 'Email: priya@example.com, confirm: priya@example.com';
    const matches = [{ matchedText: 'priya@example.com', type: 'EMAIL' as SensitiveType }];

    const result = replaceWithPlaceholders(text, matches, map);
    expect(result).toBe('Email: [EMAIL_1], confirm: [EMAIL_1]');
  });

  it('handles overlapping matches by replacing longest first', () => {
    const map = createPlaceholderMap();
    const text = 'PAN: ABCDE1234F and email: priya@example.com';
    const matches = [
      { matchedText: 'ABCDE1234F', type: 'PAN' as SensitiveType },
      { matchedText: 'priya@example.com', type: 'EMAIL' as SensitiveType },
    ];

    const result = replaceWithPlaceholders(text, matches, map);
    expect(result).toContain('[PAN_1]');
    expect(result).toContain('[EMAIL_1]');
    expect(result).not.toContain('ABCDE1234F');
    expect(result).not.toContain('priya@example.com');
  });

  it('skips matches with empty matchedText', () => {
    const map = createPlaceholderMap();
    const text = 'Hello world';
    const matches = [{ matchedText: '', type: 'EMAIL' as SensitiveType }];

    const result = replaceWithPlaceholders(text, matches, map);
    expect(result).toBe('Hello world');
  });
});

describe('Screenshot Mask Regions', () => {
  it('computes mask regions from detections with bounding boxes', () => {
    const detections = [
      { boundingBox: { x: 10, y: 20, width: 100, height: 30 } },
      { boundingBox: { x: 50, y: 60, width: 200, height: 40 } },
      { boundingBox: undefined },
    ];

    const regions = computeMaskRegions(detections);
    expect(regions).toHaveLength(2);
    expect(regions[0].boundingBox).toEqual({ x: 10, y: 20, width: 100, height: 30 });
  });

  it('skips zero-size bounding boxes', () => {
    const detections = [
      { boundingBox: { x: 0, y: 0, width: 0, height: 0 } as BoundingBox },
      { boundingBox: { x: 10, y: 10, width: 100, height: 20 } as BoundingBox },
    ];

    const regions = computeMaskRegions(detections);
    expect(regions).toHaveLength(1);
  });

  it('returns empty array for no detections', () => {
    expect(computeMaskRegions([])).toEqual([]);
  });
});
