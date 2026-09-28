import { describe, it, expect, beforeEach } from 'vitest';
import { sanitise } from '../src/redactor/sanitise';
import { resetCounters } from '../src/redactor/placeholder';
import { clearVault, resolveFromVault, getVaultSize } from '../src/vault/vault';
import { runDetectionPipeline, markSensitiveElements } from '../src/detectors/pipeline';
import type { ElementInfo } from '../src/shared/schemas';

import seedData from '../../benchmark/seed_data.json';

function makeElement(overrides: Partial<ElementInfo> & { id: string }): ElementInfo {
  return {
    tag: 'input',
    boundingBox: { x: 0, y: 0, width: 100, height: 20 },
    isVisible: true,
    isSensitive: false,
    ...overrides,
  };
}

describe('Sanitise — Context Builder', () => {
  beforeEach(() => {
    clearVault();
    resetCounters();
  });

  it('redacts email from element text and stores in vault', async () => {
    const elements: ElementInfo[] = [
      makeElement({ id: 'el-1', tag: 'span', text: 'Email: priya.sharma@example.com' }),
    ];
    const result = runDetectionPipeline(elements, 'strict');
    const marked = markSensitiveElements(elements, result);

    const { context, placeholderMap } = await sanitise({
      url: 'https://example.com',
      title: 'Test',
      elements: marked,
      detectionResult: result,
      viewport: { width: 1920, height: 1080 },
      scrollPosition: { x: 0, y: 0 },
      mode: 'strict',
    });

    const el = context.elements[0];
    expect(el.text).not.toContain('priya.sharma@example.com');
    expect(el.text).toContain('[EMAIL_1]');

    expect(placeholderMap.placeholderToValue.get('[EMAIL_1]')).toBe('priya.sharma@example.com');
    expect(resolveFromVault('[EMAIL_1]')).toBe('priya.sharma@example.com');
  });

  it('redacts multiple PII types in a single element', async () => {
    const elements: ElementInfo[] = [
      makeElement({
        id: 'el-1',
        tag: 'div',
        text: 'Email: priya.sharma@example.com Phone: +919876543210 PAN: ABCDE1234F',
      }),
    ];
    const result = runDetectionPipeline(elements, 'strict');
    const marked = markSensitiveElements(elements, result);

    const { context } = await sanitise({
      url: 'https://example.com',
      title: 'Test',
      elements: marked,
      detectionResult: result,
      viewport: { width: 1920, height: 1080 },
      scrollPosition: { x: 0, y: 0 },
      mode: 'strict',
    });

    const text = context.elements[0].text!;
    expect(text).not.toContain('priya.sharma@example.com');
    expect(text).not.toContain('+919876543210');
    expect(text).not.toContain('ABCDE1234F');
    expect(text).toContain('[EMAIL_');
    expect(text).toContain('[PHONE_');
    expect(text).toContain('[PAN_');
  });

  it('strips password field values entirely', async () => {
    const elements: ElementInfo[] = [
      makeElement({ id: 'el-1', tag: 'input', type: 'password', text: 'SuperSecret123!' }),
    ];
    const result = runDetectionPipeline(elements, 'strict');
    const marked = markSensitiveElements(elements, result);

    const { context } = await sanitise({
      url: 'https://example.com',
      title: 'Test',
      elements: marked,
      detectionResult: result,
      viewport: { width: 1920, height: 1080 },
      scrollPosition: { x: 0, y: 0 },
      mode: 'strict',
    });

    const el = context.elements[0];
    expect(el.text).toBeUndefined();
    expect(el.type).toBe('password');
  });

  it('preserves non-sensitive elements unchanged', async () => {
    const elements: ElementInfo[] = [
      makeElement({ id: 'el-1', tag: 'button', text: 'Submit' }),
    ];
    const result = runDetectionPipeline(elements, 'strict');
    const marked = markSensitiveElements(elements, result);

    const { context } = await sanitise({
      url: 'https://example.com',
      title: 'Test',
      elements: marked,
      detectionResult: result,
      viewport: { width: 1920, height: 1080 },
      scrollPosition: { x: 0, y: 0 },
      mode: 'strict',
    });

    expect(context.elements[0].text).toBe('Submit');
  });

  it('provides correct redaction summary', async () => {
    const elements: ElementInfo[] = [
      makeElement({ id: 'el-1', tag: 'span', text: 'priya.sharma@example.com' }),
      makeElement({ id: 'el-2', tag: 'span', text: '+919876543210' }),
      makeElement({ id: 'el-3', tag: 'span', text: 'ABCDE1234F' }),
    ];
    const result = runDetectionPipeline(elements, 'strict');
    const marked = markSensitiveElements(elements, result);

    const { context } = await sanitise({
      url: 'https://example.com',
      title: 'Test',
      elements: marked,
      detectionResult: result,
      viewport: { width: 1920, height: 1080 },
      scrollPosition: { x: 0, y: 0 },
      mode: 'strict',
    });

    expect(context.redactionSummary.totalRedacted).toBeGreaterThanOrEqual(3);
    expect(context.redactionSummary.byType.EMAIL).toBeGreaterThanOrEqual(1);
    expect(context.redactionSummary.byType.PHONE).toBeGreaterThanOrEqual(1);
    expect(context.redactionSummary.byType.PAN).toBeGreaterThanOrEqual(1);
  });

  it('uses consistent placeholders for the same value across elements', async () => {
    const elements: ElementInfo[] = [
      makeElement({ id: 'el-1', tag: 'span', text: 'Email: priya.sharma@example.com' }),
      makeElement({ id: 'el-2', tag: 'span', text: 'Confirm: priya.sharma@example.com' }),
    ];
    const result = runDetectionPipeline(elements, 'strict');
    const marked = markSensitiveElements(elements, result);

    const { context } = await sanitise({
      url: 'https://example.com',
      title: 'Test',
      elements: marked,
      detectionResult: result,
      viewport: { width: 1920, height: 1080 },
      scrollPosition: { x: 0, y: 0 },
      mode: 'strict',
    });

    expect(context.elements[0].text).toContain('[EMAIL_1]');
    expect(context.elements[1].text).toContain('[EMAIL_1]');
    expect(getVaultSize()).toBe(1);
  });
});

describe('Sanitise — Full Seed Data Leak Test', () => {
  beforeEach(() => {
    clearVault();
    resetCounters();
  });

  it('zero seeded PII values appear in sanitised context', async () => {
    const allPii = [
      ...seedData.emails,
      ...seedData.phones,
      ...seedData.pan,
      ...seedData.upi,
      ...seedData.ifsc,
      ...seedData.aadhaar.filter((a) => {
        const d = a.replace(/\D/g, '');
        return d.length === 12 && /^[2-9]/.test(d);
      }),
    ];

    const elements: ElementInfo[] = allPii.map((pii, i) =>
      makeElement({ id: `el-${i}`, tag: 'span', text: pii }),
    );

    const result = runDetectionPipeline(elements, 'strict');
    const marked = markSensitiveElements(elements, result);

    const { context } = await sanitise({
      url: 'https://example.com',
      title: 'Test',
      elements: marked,
      detectionResult: result,
      viewport: { width: 1920, height: 1080 },
      scrollPosition: { x: 0, y: 0 },
      mode: 'strict',
    });

    const contextStr = JSON.stringify(context);

    for (const pii of allPii) {
      expect(contextStr).not.toContain(pii);
    }
  });
});
