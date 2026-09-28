export interface ElementInfo {
  id: string;
  tag: string;
  role?: string;
  type?: string;
  label?: string;
  placeholder?: string;
  text?: string;
  autocomplete?: string;
  alt?: string;
  boundingBox: BoundingBox;
  isVisible: boolean;
  isSensitive: boolean;
  sensitiveType?: SensitiveType;
  confidence?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SensitiveType =
  | 'PASSWORD'
  | 'EMAIL'
  | 'PHONE'
  | 'AADHAAR'
  | 'PAN'
  | 'CARD'
  | 'UPI'
  | 'IFSC'
  | 'NAME'
  | 'ADDRESS'
  | 'FACE'
  | 'PII_IMAGE'
  | 'UNKNOWN_SENSITIVE';

export interface RedactedElement {
  id: string;
  tag: string;
  role?: string;
  type?: string;
  label?: string;
  placeholder?: string;
  text?: string;
  isVisible: boolean;
}

export interface SanitisedContext {
  url: string;
  title: string;
  elements: RedactedElement[];
  screenshotBase64?: string;
  viewport: { width: number; height: number };
  scrollPosition: { x: number; y: number };
  timestamp: number;
  sensitivityMode: 'strict' | 'balanced';
  redactionSummary: {
    totalRedacted: number;
    byType: Partial<Record<SensitiveType, number>>;
  };
}

export type ActionType = 'click' | 'type' | 'scroll' | 'select' | 'wait' | 'done' | 'fail';

export interface BaseAction {
  type: ActionType;
  reasoning?: string;
}

export interface ClickAction extends BaseAction {
  type: 'click';
  elementId: string;
}

export interface TypeAction extends BaseAction {
  type: 'type';
  elementId: string;
  value: string;
}

export interface ScrollAction extends BaseAction {
  type: 'scroll';
  direction: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

export interface SelectAction extends BaseAction {
  type: 'select';
  elementId: string;
  value: string;
}

export interface WaitAction extends BaseAction {
  type: 'wait';
  milliseconds: number;
}

export interface DoneAction extends BaseAction {
  type: 'done';
  summary: string;
}

export interface FailAction extends BaseAction {
  type: 'fail';
  reason: string;
}

export type Action =
  | ClickAction
  | TypeAction
  | ScrollAction
  | SelectAction
  | WaitAction
  | DoneAction
  | FailAction;

export interface AgentRequest {
  context: SanitisedContext;
  task: string;
  history?: Action[];
  step: number;
  maxSteps: number;
}

export interface AgentResponse {
  action: Action;
  thought?: string;
}

export const RISKY_ACTIONS = ['submit', 'delete', 'payment', 'send', 'confirm'] as const;

export function isRiskyAction(action: Action, element?: RedactedElement): boolean {
  if (action.type === 'click' && element) {
    const text = (element.text ?? '').toLowerCase();
    const label = (element.label ?? '').toLowerCase();
    return RISKY_ACTIONS.some((r) => text.includes(r) || label.includes(r));
  }
  if (action.type === 'type' && element?.type === 'password') {
    return true;
  }
  return false;
}

export function validateAction(action: unknown): action is Action {
  if (typeof action !== 'object' || action === null) return false;
  const a = action as Record<string, unknown>;
  const validTypes: ActionType[] = ['click', 'type', 'scroll', 'select', 'wait', 'done', 'fail'];
  if (!validTypes.includes(a.type as ActionType)) return false;

  switch (a.type) {
    case 'click':
      return typeof a.elementId === 'string';
    case 'type':
      return typeof a.elementId === 'string' && typeof a.value === 'string';
    case 'scroll':
      return ['up', 'down', 'left', 'right'].includes(a.direction as string);
    case 'select':
      return typeof a.elementId === 'string' && typeof a.value === 'string';
    case 'wait':
      return typeof a.milliseconds === 'number' && a.milliseconds > 0 && a.milliseconds <= 10000;
    case 'done':
      return typeof a.summary === 'string';
    case 'fail':
      return typeof a.reason === 'string';
    default:
      return false;
  }
}
