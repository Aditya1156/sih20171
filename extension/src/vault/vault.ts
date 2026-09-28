import type { PlaceholderMap } from '../redactor/placeholder';

const VAULT_KEY = 'veilagent_vault';

let memoryVault: Map<string, string> = new Map();

export function storeInVault(map: PlaceholderMap): void {
  for (const [placeholder, value] of map.placeholderToValue) {
    memoryVault.set(placeholder, value);
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    const obj = Object.fromEntries(memoryVault);
    chrome.storage.session.set({ [VAULT_KEY]: obj });
  }
}

export async function loadVault(): Promise<Map<string, string>> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    return new Promise((resolve) => {
      chrome.storage.session.get(VAULT_KEY, (result) => {
        if (result[VAULT_KEY]) {
          memoryVault = new Map(Object.entries(result[VAULT_KEY] as Record<string, string>));
        }
        resolve(memoryVault);
      });
    });
  }
  return memoryVault;
}

export function resolveFromVault(placeholder: string): string | undefined {
  return memoryVault.get(placeholder);
}

export function getAllVaultValues(): string[] {
  return [...memoryVault.values()];
}

export function getAllVaultEntries(): Map<string, string> {
  return new Map(memoryVault);
}

export function clearVault(): void {
  memoryVault.clear();
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    chrome.storage.session.remove(VAULT_KEY);
  }
}

export function getVaultSize(): number {
  return memoryVault.size;
}
