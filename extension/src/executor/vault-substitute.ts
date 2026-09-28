import type { Action, TypeAction } from '../shared/schemas';
import { resolveFromVault } from '../vault/vault';

const PLACEHOLDER_PATTERN = /\[[A-Z_]+_\d+\]/g;

export function substituteVaultValues(action: Action): Action {
  if (action.type !== 'type') return action;

  const typeAction = action as TypeAction;
  const substituted = typeAction.value.replace(PLACEHOLDER_PATTERN, (match) => {
    const real = resolveFromVault(match);
    return real ?? match;
  });

  return { ...typeAction, value: substituted };
}

export function hasPlaceholders(text: string): boolean {
  PLACEHOLDER_PATTERN.lastIndex = 0;
  return PLACEHOLDER_PATTERN.test(text);
}
