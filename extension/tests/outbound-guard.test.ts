import { describe, it, expect, beforeEach } from 'vitest';
import { scanForLeaks, guardRequest } from '../src/redactor/outbound-guard';
import { storeInVault, clearVault } from '../src/vault/vault';
import { createPlaceholderMap, getPlaceholder, resetCounters } from '../src/redactor/placeholder';

import seedData from '../../benchmark/seed_data.json';

describe('Outbound Guard', () => {
  beforeEach(() => {
    clearVault();
    resetCounters();
  });

  it('allows a clean payload with only placeholders', () => {
    const payload = JSON.stringify({
      url: 'https://example.com',
      title: 'Test Page',
      elements: [{ id: 'el-1', text: 'Contact [EMAIL_1] for help' }],
    });

    const result = scanForLeaks(payload);
    expect(result.allowed).toBe(true);
    expect(result.blockedReasons).toHaveLength(0);
  });

  it('blocks payload containing vault values', () => {
    const map = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map);
    storeInVault(map);

    const payload = JSON.stringify({
      elements: [{ text: 'Contact priya@example.com' }],
    });

    const result = scanForLeaks(payload);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons.length).toBeGreaterThan(0);
  });

  it('blocks payload with raw email PII pattern', () => {
    const payload = JSON.stringify({
      elements: [{ text: 'Email: rahul.gupta123@testmail.in' }],
    });

    const result = scanForLeaks(payload);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons.some((r) => r.includes('email'))).toBe(true);
  });

  it('blocks payload with raw Aadhaar pattern', () => {
    const payload = 'Aadhaar: 2345 6789 0123';
    const result = scanForLeaks(payload);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons.some((r) => r.includes('aadhaar'))).toBe(true);
  });

  it('blocks payload with raw PAN pattern', () => {
    const payload = 'PAN: ABCDE1234F';
    const result = scanForLeaks(payload);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons.some((r) => r.includes('pan'))).toBe(true);
  });

  it('blocks payload with raw card number pattern', () => {
    const payload = 'Card: 4111 1111 1111 1111';
    const result = scanForLeaks(payload);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons.some((r) => r.includes('card'))).toBe(true);
  });

  it('blocks payload with raw IFSC pattern', () => {
    const payload = 'IFSC: SBIN0001234';
    const result = scanForLeaks(payload);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons.some((r) => r.includes('ifsc'))).toBe(true);
  });

  it('blocks payload with raw UPI pattern', () => {
    const payload = 'UPI: priya@upi';
    const result = scanForLeaks(payload);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons.some((r) => r.includes('upi'))).toBe(true);
  });

  it('blocks payload with raw phone pattern', () => {
    const payload = 'Phone: +91 98765 43210';
    const result = scanForLeaks(payload);
    expect(result.allowed).toBe(false);
  });

  it('allows payload with placeholders that look like PII patterns', () => {
    const payload = JSON.stringify({
      text: 'Email is [EMAIL_1] and phone is [PHONE_1]',
    });

    const result = scanForLeaks(payload);
    expect(result.allowed).toBe(true);
  });

  it('masks leaked values in reason messages', () => {
    const map = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map);
    storeInVault(map);

    const payload = 'Email: priya@example.com';
    const result = scanForLeaks(payload);

    for (const reason of result.blockedReasons) {
      expect(reason).not.toContain('priya@example.com');
    }
  });

  it('guardRequest checks both URL and body', () => {
    const result = guardRequest(
      'https://api.example.com/agent/step',
      { task: 'Fill in priya@example.com' },
    );
    expect(result.allowed).toBe(false);
  });

  it('guardRequest allows clean URL and body', () => {
    const result = guardRequest(
      'https://api.example.com/agent/step',
      { task: 'Fill in [EMAIL_1]', context: {} },
    );
    expect(result.allowed).toBe(true);
  });
});

describe('Outbound Guard — Seed Data Leak Test', () => {
  beforeEach(() => {
    clearVault();
    resetCounters();
  });

  it('blocks every seeded email', () => {
    for (const email of seedData.emails) {
      const result = scanForLeaks(`payload with ${email}`);
      expect(result.allowed).toBe(false);
    }
  });

  it('blocks every seeded phone number', () => {
    for (const phone of seedData.phones) {
      const result = scanForLeaks(`payload with ${phone}`);
      expect(result.allowed).toBe(false);
    }
  });

  it('blocks every seeded Aadhaar number', () => {
    for (const aadhaar of seedData.aadhaar) {
      const digits = aadhaar.replace(/\D/g, '');
      if (digits.length === 12 && /^[2-9]/.test(digits)) {
        const result = scanForLeaks(`payload with ${aadhaar}`);
        expect(result.allowed).toBe(false);
      }
    }
  });

  it('blocks every seeded PAN', () => {
    for (const pan of seedData.pan) {
      const result = scanForLeaks(`payload with ${pan}`);
      expect(result.allowed).toBe(false);
    }
  });

  it('blocks every seeded card number', () => {
    for (const card of seedData.cards) {
      const result = scanForLeaks(`payload with ${card}`);
      expect(result.allowed).toBe(false);
    }
  });

  it('blocks every seeded UPI ID', () => {
    for (const upi of seedData.upi) {
      const result = scanForLeaks(`payload with ${upi}`);
      expect(result.allowed).toBe(false);
    }
  });

  it('blocks every seeded IFSC code', () => {
    for (const ifsc of seedData.ifsc) {
      const result = scanForLeaks(`payload with ${ifsc}`);
      expect(result.allowed).toBe(false);
    }
  });
});
