import { describe, it, expect } from 'vitest';
import { l1DomRules } from '../src/detectors/l1-dom-rules';
import { l2TextPatterns, scanText, TEXT_PATTERNS } from '../src/detectors/l2-text-patterns';
import { l3Ner } from '../src/detectors/l3-ner';
import { l4Vision } from '../src/detectors/l4-vision';
import { runDetectionPipeline, markSensitiveElements } from '../src/detectors/pipeline';
import type { DetectorInput } from '../src/detectors/types';
import type { ElementInfo } from '../src/shared/schemas';

const box = { x: 0, y: 0, width: 100, height: 30 };

function input(overrides: Partial<DetectorInput> = {}): DetectorInput {
  return {
    id: 've-test',
    tag: 'input',
    boundingBox: box,
    isVisible: true,
    ...overrides,
  };
}

function element(overrides: Partial<ElementInfo> = {}): ElementInfo {
  return {
    id: 've-test',
    tag: 'input',
    boundingBox: box,
    isVisible: true,
    isSensitive: false,
    ...overrides,
  };
}

describe('L1 DOM Rules', () => {
  it('detects password fields with 1.0 confidence', () => {
    const results = l1DomRules.detect([input({ type: 'password' })], { mode: 'strict' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('PASSWORD');
    expect(results[0].confidence).toBe(1.0);
  });

  it('detects email input type', () => {
    const results = l1DomRules.detect([input({ type: 'email' })], { mode: 'strict' });
    expect(results.some((r) => r.type === 'EMAIL')).toBe(true);
  });

  it('detects tel input type', () => {
    const results = l1DomRules.detect([input({ type: 'tel' })], { mode: 'strict' });
    expect(results.some((r) => r.type === 'PHONE')).toBe(true);
  });

  it('detects cc-number autocomplete', () => {
    const results = l1DomRules.detect(
      [input({ autocomplete: 'cc-number' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'CARD')).toBe(true);
  });

  it('detects Aadhaar label', () => {
    const results = l1DomRules.detect(
      [input({ label: 'Aadhaar Number' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'AADHAAR')).toBe(true);
  });

  it('detects PAN label', () => {
    const results = l1DomRules.detect(
      [input({ label: 'PAN Number' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'PAN')).toBe(true);
  });

  it('detects sensitive container by aria-label', () => {
    const results = l1DomRules.detect(
      [input({ id: 've-section', tag: 'section', label: 'Payment Details' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'UNKNOWN_SENSITIVE')).toBe(true);
  });
});

describe('L2 Text Patterns', () => {
  it('detects email in text', () => {
    const results = l2TextPatterns.detect(
      [input({ text: 'Contact: priya.sharma@example.com for details' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'EMAIL' && r.matchedText === 'priya.sharma@example.com')).toBe(true);
  });

  it('detects phone with +91', () => {
    const results = l2TextPatterns.detect(
      [input({ text: 'Call +91 98765 43210' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'PHONE')).toBe(true);
  });

  it('detects PAN', () => {
    const results = l2TextPatterns.detect(
      [input({ text: 'PAN: ABCDE1234F' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'PAN')).toBe(true);
  });

  it('detects credit card with Luhn validation', () => {
    const results = l2TextPatterns.detect(
      [input({ text: 'Card: 4111 1111 1111 1111' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'CARD')).toBe(true);
  });

  it('rejects invalid card number', () => {
    const results = l2TextPatterns.detect(
      [input({ text: 'Number: 1234 5678 9012 3456' })],
      { mode: 'strict' },
    );
    expect(results.filter((r) => r.type === 'CARD')).toHaveLength(0);
  });

  it('detects IFSC code', () => {
    const results = l2TextPatterns.detect(
      [input({ text: 'IFSC: SBIN0001234' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'IFSC')).toBe(true);
  });

  it('detects UPI ID', () => {
    const results = l2TextPatterns.detect(
      [input({ text: 'Pay via priya@upi' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'UPI')).toBe(true);
  });

  it('skips password fields', () => {
    const results = l2TextPatterns.detect(
      [input({ type: 'password', text: 'priya@example.com' })],
      { mode: 'strict' },
    );
    expect(results).toHaveLength(0);
  });

  it('detects obfuscated email', () => {
    const results = l2TextPatterns.detect(
      [input({ text: 'email me at priya [at] example [dot] com' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'EMAIL')).toBe(true);
  });
});

describe('L3 NER (heuristic)', () => {
  it('detects names with capital letters', () => {
    const results = l3Ner.detect(
      [input({ text: 'Account holder: Priya Sharma' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'NAME')).toBe(true);
  });

  it('detects address with Indian city', () => {
    const results = l3Ner.detect(
      [input({ text: '42, MG Road, Bengaluru, Karnataka 560001' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'ADDRESS')).toBe(true);
  });

  it('detects address with keywords', () => {
    const results = l3Ner.detect(
      [input({ text: 'Block C, Sector 62, Noida' })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'ADDRESS')).toBe(true);
  });
});

describe('L4 Vision (heuristic)', () => {
  it('detects profile photo by alt text', () => {
    const results = l4Vision.detect(
      [input({ tag: 'img', alt: 'Profile photo of Amit Kumar', boundingBox: { x: 0, y: 0, width: 100, height: 100 } })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'FACE')).toBe(true);
  });

  it('flags canvas in strict mode', () => {
    const results = l4Vision.detect(
      [input({ tag: 'canvas', boundingBox: { x: 0, y: 0, width: 400, height: 200 } })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'PII_IMAGE')).toBe(true);
  });

  it('does not flag canvas in balanced mode', () => {
    const results = l4Vision.detect(
      [input({ tag: 'canvas', boundingBox: { x: 0, y: 0, width: 400, height: 200 } })],
      { mode: 'balanced' },
    );
    expect(results.filter((r) => r.type === 'PII_IMAGE')).toHaveLength(0);
  });

  it('flags large images in strict mode', () => {
    const results = l4Vision.detect(
      [input({ tag: 'img', boundingBox: { x: 0, y: 0, width: 300, height: 200 } })],
      { mode: 'strict' },
    );
    expect(results.some((r) => r.type === 'PII_IMAGE')).toBe(true);
  });
});

describe('Detection Pipeline', () => {
  it('merges detections from multiple layers', () => {
    const elements: ElementInfo[] = [
      element({ id: 've-1', type: 'password' }),
      element({ id: 've-2', type: 'email', text: 'priya.sharma@example.com' }),
      element({ id: 've-3', tag: 'p', text: 'PAN: ABCDE1234F' }),
    ];

    const result = runDetectionPipeline(elements, 'strict');
    expect(result.detections.length).toBeGreaterThan(0);
    expect(result.summary.totalDetected).toBeGreaterThan(0);

    const types = result.detections.map((d) => d.type);
    expect(types).toContain('PASSWORD');
    expect(types).toContain('EMAIL');
    expect(types).toContain('PAN');
  });

  it('marks elements as sensitive', () => {
    const elements: ElementInfo[] = [
      element({ id: 've-1', type: 'password' }),
      element({ id: 've-2', tag: 'button', text: 'Submit' }),
    ];

    const result = runDetectionPipeline(elements, 'strict');
    const marked = markSensitiveElements(elements, result);

    const pwd = marked.find((e) => e.id === 've-1');
    expect(pwd?.isSensitive).toBe(true);
    expect(pwd?.sensitiveType).toBe('PASSWORD');
    expect(pwd?.confidence).toBe(1.0);

    const btn = marked.find((e) => e.id === 've-2');
    expect(btn?.isSensitive).toBe(false);
  });

  it('reports latency', () => {
    const elements = [element({ text: 'test content' })];
    const result = runDetectionPipeline(elements, 'strict');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.latencyMs).toBeLessThan(1000);
  });

  it('handles banking page with multiple PII types', () => {
    const elements: ElementInfo[] = [
      element({ id: 've-1', tag: 'td', text: 'Priya Sharma' }),
      element({ id: 've-2', tag: 'td', text: 'priya.sharma@example.com' }),
      element({ id: 've-3', tag: 'td', text: '+91 98765 43210' }),
      element({ id: 've-4', tag: 'td', text: 'SBIN0001234' }),
      element({ id: 've-5', tag: 'td', text: 'ABCDE1234F' }),
      element({ id: 've-6', tag: 'span', text: 'UPI Transfer to rahul.gupta@paytm' }),
    ];

    const result = runDetectionPipeline(elements, 'strict');
    const types = new Set(result.detections.map((d) => d.type));

    expect(types.has('EMAIL')).toBe(true);
    expect(types.has('PHONE')).toBe(true);
    expect(types.has('IFSC')).toBe(true);
    expect(types.has('PAN')).toBe(true);
    expect(types.has('NAME')).toBe(true);
  });
});

describe('scanText direct', () => {
  it('finds multiple PII types in a single text block', () => {
    const text = 'Name: Sneha Patel, Email: sneha.patel@fake.co.in, Phone: +91-9123456789, PAN: FGHIJ7890K';
    const results = scanText(text, TEXT_PATTERNS);
    const types = results.map((r) => r.type);

    expect(types).toContain('EMAIL');
    expect(types).toContain('PHONE');
    expect(types).toContain('PAN');
  });

  it('finds card number with dashes', () => {
    const text = 'Card: 4111-1111-1111-1111';
    const results = scanText(text, TEXT_PATTERNS);
    expect(results.some((r) => r.type === 'CARD')).toBe(true);
  });

  it('finds UPI IDs', () => {
    const text = 'Pay to amit@ybl or deepika@oksbi';
    const results = scanText(text, TEXT_PATTERNS);
    const upis = results.filter((r) => r.type === 'UPI');
    expect(upis.length).toBeGreaterThanOrEqual(2);
  });
});
