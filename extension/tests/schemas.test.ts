import { describe, it, expect } from 'vitest';
import { validateAction, isRiskyAction } from '../src/shared/schemas';
import type { Action, RedactedElement } from '../src/shared/schemas';

describe('validateAction', () => {
  it('accepts a valid click action', () => {
    expect(validateAction({ type: 'click', elementId: 've-1' })).toBe(true);
  });

  it('accepts a valid type action', () => {
    expect(validateAction({ type: 'type', elementId: 've-2', value: 'hello' })).toBe(true);
  });

  it('accepts a valid scroll action', () => {
    expect(validateAction({ type: 'scroll', direction: 'down', amount: 200 })).toBe(true);
  });

  it('accepts a valid select action', () => {
    expect(validateAction({ type: 'select', elementId: 've-3', value: 'option1' })).toBe(true);
  });

  it('accepts a valid wait action', () => {
    expect(validateAction({ type: 'wait', milliseconds: 1000 })).toBe(true);
  });

  it('accepts a valid done action', () => {
    expect(validateAction({ type: 'done', summary: 'Task complete' })).toBe(true);
  });

  it('accepts a valid fail action', () => {
    expect(validateAction({ type: 'fail', reason: 'Element not found' })).toBe(true);
  });

  it('rejects unknown action types', () => {
    expect(validateAction({ type: 'execute', code: 'alert(1)' })).toBe(false);
  });

  it('rejects null', () => {
    expect(validateAction(null)).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(validateAction('click')).toBe(false);
  });

  it('rejects click without elementId', () => {
    expect(validateAction({ type: 'click' })).toBe(false);
  });

  it('rejects type without value', () => {
    expect(validateAction({ type: 'type', elementId: 've-1' })).toBe(false);
  });

  it('rejects scroll with invalid direction', () => {
    expect(validateAction({ type: 'scroll', direction: 'diagonal' })).toBe(false);
  });

  it('rejects wait with 0 milliseconds', () => {
    expect(validateAction({ type: 'wait', milliseconds: 0 })).toBe(false);
  });

  it('rejects wait exceeding 10000ms', () => {
    expect(validateAction({ type: 'wait', milliseconds: 20000 })).toBe(false);
  });
});

describe('isRiskyAction', () => {
  const makeElement = (text: string, label?: string): RedactedElement => ({
    id: 've-1',
    tag: 'button',
    text,
    label,
    isVisible: true,
  });

  it('flags click on submit button', () => {
    const action: Action = { type: 'click', elementId: 've-1' };
    expect(isRiskyAction(action, makeElement('Submit'))).toBe(true);
  });

  it('flags click on delete button', () => {
    const action: Action = { type: 'click', elementId: 've-1' };
    expect(isRiskyAction(action, makeElement('Delete Account'))).toBe(true);
  });

  it('flags click on payment button', () => {
    const action: Action = { type: 'click', elementId: 've-1' };
    expect(isRiskyAction(action, makeElement('Make Payment'))).toBe(true);
  });

  it('does not flag a regular button', () => {
    const action: Action = { type: 'click', elementId: 've-1' };
    expect(isRiskyAction(action, makeElement('Next'))).toBe(false);
  });

  it('does not flag scroll actions', () => {
    const action: Action = { type: 'scroll', direction: 'down' };
    expect(isRiskyAction(action)).toBe(false);
  });
});
