import type { Action } from '../shared/schemas';

export interface ExecutionResult {
  success: boolean;
  error?: string;
}

export function executeAction(action: Action): ExecutionResult {
  switch (action.type) {
    case 'click':
      return executeClick(action.elementId);
    case 'type':
      return executeType(action.elementId, action.value);
    case 'scroll':
      return executeScroll(action.direction, action.amount);
    case 'select':
      return executeSelect(action.elementId, action.value);
    case 'wait':
      return { success: true };
    case 'done':
      return { success: true };
    case 'fail':
      return { success: true };
    default:
      return { success: false, error: `Unknown action type` };
  }
}

function findElement(elementId: string): HTMLElement | null {
  return document.querySelector(`[data-veil-id="${elementId}"]`) as HTMLElement | null;
}

function executeClick(elementId: string): ExecutionResult {
  const el = findElement(elementId);
  if (!el) return { success: false, error: `Element not found: ${elementId}` };

  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  el.focus();
  el.click();

  return { success: true };
}

function executeType(elementId: string, value: string): ExecutionResult {
  const el = findElement(elementId);
  if (!el) return { success: false, error: `Element not found: ${elementId}` };

  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return { success: false, error: `Element is not an input or textarea: ${elementId}` };
  }

  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  el.focus();

  const nativeInputValueSetter =
    Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      'value',
    )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  return { success: true };
}

function executeScroll(direction: string, amount?: number): ExecutionResult {
  const px = amount ?? 300;
  const scrollMap: Record<string, [number, number]> = {
    up: [0, -px],
    down: [0, px],
    left: [-px, 0],
    right: [px, 0],
  };

  const [x, y] = scrollMap[direction] ?? [0, 0];
  window.scrollBy({ left: x, top: y, behavior: 'smooth' });

  return { success: true };
}

function executeSelect(elementId: string, value: string): ExecutionResult {
  const el = findElement(elementId);
  if (!el) return { success: false, error: `Element not found: ${elementId}` };

  if (!(el instanceof HTMLSelectElement)) {
    return { success: false, error: `Element is not a select: ${elementId}` };
  }

  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));

  return { success: true };
}
