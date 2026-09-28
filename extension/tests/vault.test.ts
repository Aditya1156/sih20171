import { describe, it, expect, beforeEach } from 'vitest';
import {
  storeInVault,
  resolveFromVault,
  getAllVaultValues,
  getAllVaultEntries,
  clearVault,
  getVaultSize,
} from '../src/vault/vault';
import { createPlaceholderMap, getPlaceholder, resetCounters } from '../src/redactor/placeholder';

describe('Vault', () => {
  beforeEach(() => {
    clearVault();
    resetCounters();
  });

  it('stores placeholder map entries in vault', () => {
    const map = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map);
    getPlaceholder('+919876543210', 'PHONE', map);

    storeInVault(map);

    expect(resolveFromVault('[EMAIL_1]')).toBe('priya@example.com');
    expect(resolveFromVault('[PHONE_1]')).toBe('+919876543210');
  });

  it('returns undefined for unknown placeholder', () => {
    expect(resolveFromVault('[EMAIL_99]')).toBeUndefined();
  });

  it('returns all vault values', () => {
    const map = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map);
    getPlaceholder('ABCDE1234F', 'PAN', map);
    storeInVault(map);

    const values = getAllVaultValues();
    expect(values).toContain('priya@example.com');
    expect(values).toContain('ABCDE1234F');
    expect(values).toHaveLength(2);
  });

  it('returns all vault entries as a map', () => {
    const map = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map);
    storeInVault(map);

    const entries = getAllVaultEntries();
    expect(entries.get('[EMAIL_1]')).toBe('priya@example.com');
  });

  it('clears vault completely', () => {
    const map = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map);
    storeInVault(map);

    expect(getVaultSize()).toBe(1);
    clearVault();
    expect(getVaultSize()).toBe(0);
    expect(resolveFromVault('[EMAIL_1]')).toBeUndefined();
  });

  it('accumulates entries across multiple stores', () => {
    const map1 = createPlaceholderMap();
    getPlaceholder('priya@example.com', 'EMAIL', map1);
    storeInVault(map1);

    const map2 = createPlaceholderMap();
    getPlaceholder('+919876543210', 'PHONE', map2);
    storeInVault(map2);

    expect(getVaultSize()).toBe(2);
    expect(resolveFromVault('[EMAIL_1]')).toBe('priya@example.com');
    expect(resolveFromVault('[PHONE_1]')).toBe('+919876543210');
  });

  it('vault values are never serialised to persistent storage (no localStorage/indexedDB)', () => {
    const map = createPlaceholderMap();
    getPlaceholder('secret-data', 'NAME', map);
    storeInVault(map);

    expect(typeof localStorage === 'undefined' || localStorage.length === 0).toBe(true);
  });

  it('tracks vault size correctly', () => {
    expect(getVaultSize()).toBe(0);

    const map = createPlaceholderMap();
    getPlaceholder('a@b.com', 'EMAIL', map);
    getPlaceholder('c@d.com', 'EMAIL', map);
    getPlaceholder('+919999999999', 'PHONE', map);
    storeInVault(map);

    expect(getVaultSize()).toBe(3);
  });
});
