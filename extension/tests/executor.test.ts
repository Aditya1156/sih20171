import { describe, it, expect, beforeEach } from 'vitest';
import { substituteVaultValues, hasPlaceholders } from '../src/executor/vault-substitute';
import { stopLoop, isLoopRunning } from '../src/executor/agent-loop';
import { storeInVault, clearVault, resolveFromVault } from '../src/vault/vault';
import { createPlaceholderMap, getPlaceholder, resetCounters } from '../src/redactor/placeholder';
import type { Action, TypeAction, ClickAction } from '../src/shared/schemas';

describe('Vault Substitution', () => {
  beforeEach(() => {
    clearVault();
    resetCounters();
  });

  it('substitutes placeholders in type action values', () => {
    const map = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map);
    storeInVault(map);

    const action: TypeAction = {
      type: 'type',
      elementId: 'el-1',
      value: '[EMAIL_1]',
    };

    const result = substituteVaultValues(action) as TypeAction;
    expect(result.value).toBe('priya@example.com');
  });

  it('substitutes multiple placeholders in one value', () => {
    const map = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map);
    getPlaceholder('+919876543210', 'PHONE', map);
    storeInVault(map);

    const action: TypeAction = {
      type: 'type',
      elementId: 'el-1',
      value: 'Email: [EMAIL_1], Phone: [PHONE_1]',
    };

    const result = substituteVaultValues(action) as TypeAction;
    expect(result.value).toBe('Email: priya@example.com, Phone: +919876543210');
  });

  it('leaves non-type actions unchanged', () => {
    const action: ClickAction = {
      type: 'click',
      elementId: 'el-1',
    };

    const result = substituteVaultValues(action);
    expect(result).toEqual(action);
  });

  it('leaves unknown placeholders as-is', () => {
    const action: TypeAction = {
      type: 'type',
      elementId: 'el-1',
      value: '[UNKNOWN_99]',
    };

    const result = substituteVaultValues(action) as TypeAction;
    expect(result.value).toBe('[UNKNOWN_99]');
  });

  it('real values never appear in the action sent to backend', () => {
    const map = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map);
    storeInVault(map);

    const backendAction: TypeAction = {
      type: 'type',
      elementId: 'el-1',
      value: '[EMAIL_1]',
    };

    expect(JSON.stringify(backendAction)).not.toContain('priya@example.com');
    expect(JSON.stringify(backendAction)).toContain('[EMAIL_1]');

    const localAction = substituteVaultValues(backendAction) as TypeAction;
    expect(localAction.value).toBe('priya@example.com');
  });
});

describe('hasPlaceholders', () => {
  it('detects placeholder patterns', () => {
    expect(hasPlaceholders('[EMAIL_1]')).toBe(true);
    expect(hasPlaceholders('hello [PHONE_2] world')).toBe(true);
    expect(hasPlaceholders('[AADHAAR_1]')).toBe(true);
  });

  it('returns false for non-placeholder text', () => {
    expect(hasPlaceholders('hello world')).toBe(false);
    expect(hasPlaceholders('')).toBe(false);
    expect(hasPlaceholders('[lowercase_1]')).toBe(false);
  });
});

describe('Agent Loop Control', () => {
  it('stopLoop sets aborted state', () => {
    stopLoop();
    expect(isLoopRunning()).toBe(false);
  });
});

describe('Vault round-trip integrity', () => {
  beforeEach(() => {
    clearVault();
    resetCounters();
  });

  it('stores and resolves all PII types correctly', () => {
    const map = createPlaceholderMap();
    const testData: Array<[string, string]> = [
      ['priya@example.com', 'EMAIL'],
      ['+919876543210', 'PHONE'],
      ['234567890123', 'AADHAAR'],
      ['ABCDE1234F', 'PAN'],
      ['4111111111111111', 'CARD'],
      ['priya@upi', 'UPI'],
      ['SBIN0001234', 'IFSC'],
      ['Priya Sharma', 'NAME'],
      ['42 MG Road Bengaluru', 'ADDRESS'],
    ];

    for (const [value, type] of testData) {
      getPlaceholder(value, type as any, map);
    }
    storeInVault(map);

    for (const [value, type] of testData) {
      const placeholder = `[${type}_1]`;
      expect(resolveFromVault(placeholder)).toBe(value);
    }
  });

  it('vault substitution produces correct values for all types', () => {
    const map = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map);
    getPlaceholder('+919876543210', 'PHONE', map);
    getPlaceholder('ABCDE1234F', 'PAN', map);
    storeInVault(map);

    const action: TypeAction = {
      type: 'type',
      elementId: 'el-1',
      value: 'Email: [EMAIL_1], Phone: [PHONE_1], PAN: [PAN_1]',
    };

    const result = substituteVaultValues(action) as TypeAction;
    expect(result.value).toBe('Email: priya@example.com, Phone: +919876543210, PAN: ABCDE1234F');
  });
});
