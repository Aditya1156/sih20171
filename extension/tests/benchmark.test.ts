import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { runDetectionPipeline, markSensitiveElements } from '../src/detectors/pipeline';
import { sanitise } from '../src/redactor/sanitise';
import { clearVault } from '../src/vault/vault';
import { resetCounters } from '../src/redactor/placeholder';
import type { ElementInfo } from '../src/shared/schemas';
import seedData from '../../benchmark/seed_data.json';

const PAGES_DIR = join(__dirname, '../../benchmark/pages');

function extractElementsFromHtml(html: string): ElementInfo[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const elements: ElementInfo[] = [];
  let idCounter = 0;

  const selectors = [
    'input', 'textarea', 'select', 'button',
    'a', 'label',
    'p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'li', 'td', 'th',
    'img', 'canvas', 'video',
  ];

  const nodes = doc.querySelectorAll(selectors.join(','));

  for (const node of nodes) {
    const el = node as HTMLElement;
    const id = `bench-${idCounter++}`;
    const tag = el.tagName.toLowerCase();
    const input = el as HTMLInputElement;

    const info: ElementInfo = {
      id,
      tag,
      role: el.getAttribute('role') ?? undefined,
      type: input.type ?? undefined,
      label: el.getAttribute('aria-label') ?? undefined,
      placeholder: input.placeholder ?? undefined,
      text: el.textContent?.trim().substring(0, 500) ?? undefined,
      autocomplete: input.autocomplete ?? undefined,
      alt: (el as HTMLImageElement).alt ?? undefined,
      boundingBox: { x: 0, y: 0, width: 100, height: 20 },
      isVisible: el.style.display !== 'none',
      isSensitive: false,
    };

    if (tag === 'input' || tag === 'textarea') {
      if (input.value) {
        info.text = input.value;
      }
    }

    if (tag === 'a') {
      const href = el.getAttribute('href') ?? '';
      if (href.startsWith('mailto:') || href.startsWith('tel:')) {
        info.text = (info.text ?? '') + ' ' + href;
      }
    }

    const title = el.getAttribute('title');
    if (title) {
      info.text = (info.text ?? '') + ' ' + title;
    }

    if (info.text) {
      info.text = info.text.trim();
    }

    elements.push(info);
  }

  return elements;
}

const pageFiles = readdirSync(PAGES_DIR)
  .filter((f) => f.endsWith('.html'))
  .sort();

describe('Benchmark — Detection Pipeline on All Pages', () => {
  for (const file of pageFiles) {
    it(`detects PII in ${file}`, () => {
      const html = readFileSync(join(PAGES_DIR, file), 'utf-8');
      const elements = extractElementsFromHtml(html);
      const result = runDetectionPipeline(elements, 'strict');

      if (file.includes('login') || file.includes('signup') || file.includes('kyc')) {
        expect(result.detections.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('Benchmark — Zero Leak Test on All Pages', () => {
  beforeEach(() => {
    clearVault();
    resetCounters();
  });

  const textPiiValues = [
    ...seedData.emails,
    ...seedData.pan,
    ...seedData.upi,
    ...seedData.ifsc,
  ];

  const numericPiiValues = seedData.aadhaar
    .filter((a) => {
      const d = a.replace(/\D/g, '');
      return d.length === 12 && /^[2-9]/.test(d);
    });

  for (const file of pageFiles) {
    it(`zero seeded PII leaks in sanitised output for ${file}`, async () => {
      const html = readFileSync(join(PAGES_DIR, file), 'utf-8');
      const elements = extractElementsFromHtml(html);
      const detectionResult = runDetectionPipeline(elements, 'strict');
      const marked = markSensitiveElements(elements, detectionResult);

      const { context } = await sanitise({
        url: 'https://example.com',
        title: 'Benchmark',
        elements: marked,
        detectionResult,
        viewport: { width: 1920, height: 1080 },
        scrollPosition: { x: 0, y: 0 },
        mode: 'strict',
      });

      const contextStr = JSON.stringify(context);

      for (const pii of textPiiValues) {
        expect(contextStr).not.toContain(pii);
      }

      for (const aadhaar of numericPiiValues) {
        const escaped = aadhaar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(?<![0-9])${escaped}(?![0-9])`);
        expect(pattern.test(contextStr)).toBe(false);
      }
    });
  }
});

describe('Benchmark — Detection Recall by Category', () => {
  function detectInText(text: string): string[] {
    const elements: ElementInfo[] = [
      {
        id: 'test-el',
        tag: 'span',
        text,
        boundingBox: { x: 0, y: 0, width: 100, height: 20 },
        isVisible: true,
        isSensitive: false,
      },
    ];
    const result = runDetectionPipeline(elements, 'strict');
    return result.detections.map((d) => d.type);
  }

  it('detects all seeded emails (recall: 100%)', () => {
    let detected = 0;
    for (const email of seedData.emails) {
      const types = detectInText(email);
      if (types.includes('EMAIL')) detected++;
    }
    expect(detected).toBe(seedData.emails.length);
  });

  it('detects all seeded phones (recall: 100%)', () => {
    let detected = 0;
    for (const phone of seedData.phones) {
      const types = detectInText(phone);
      if (types.includes('PHONE')) detected++;
    }
    expect(detected).toBe(seedData.phones.length);
  });

  it('detects all valid seeded Aadhaar numbers', () => {
    let detected = 0;
    let total = 0;
    for (const aadhaar of seedData.aadhaar) {
      const digits = aadhaar.replace(/\D/g, '');
      if (digits.length === 12 && /^[2-9]/.test(digits)) {
        total++;
        const types = detectInText(aadhaar);
        if (types.includes('AADHAAR')) detected++;
      }
    }
    expect(detected).toBe(total);
  });

  it('detects all seeded PAN numbers (recall: 100%)', () => {
    let detected = 0;
    for (const pan of seedData.pan) {
      const types = detectInText(pan);
      if (types.includes('PAN')) detected++;
    }
    expect(detected).toBe(seedData.pan.length);
  });

  it('detects seeded UPI IDs (recall: 100%)', () => {
    let detected = 0;
    for (const upi of seedData.upi) {
      const types = detectInText(upi);
      if (types.includes('UPI')) detected++;
    }
    expect(detected).toBe(seedData.upi.length);
  });

  it('detects all seeded IFSC codes (recall: 100%)', () => {
    let detected = 0;
    for (const ifsc of seedData.ifsc) {
      const types = detectInText(ifsc);
      if (types.includes('IFSC')) detected++;
    }
    expect(detected).toBe(seedData.ifsc.length);
  });

  it('detects password fields via L1 DOM rules', () => {
    const elements: ElementInfo[] = [
      {
        id: 'pw-el',
        tag: 'input',
        type: 'password',
        boundingBox: { x: 0, y: 0, width: 100, height: 20 },
        isVisible: true,
        isSensitive: false,
      },
    ];
    const result = runDetectionPipeline(elements, 'strict');
    expect(result.detections.some((d) => d.type === 'PASSWORD')).toBe(true);
  });

  it('detects seeded card numbers', () => {
    let detected = 0;
    for (const card of seedData.cards) {
      const types = detectInText(card);
      if (types.includes('CARD')) detected++;
    }
    expect(detected).toBeGreaterThanOrEqual(3);
  });

  it('detects seeded names', () => {
    let detected = 0;
    for (const name of seedData.names) {
      const types = detectInText(name);
      if (types.includes('NAME')) detected++;
    }
    expect(detected).toBeGreaterThanOrEqual(3);
  });
});
