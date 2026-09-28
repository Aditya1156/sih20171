import type { Action, AgentRequest, AgentResponse, SanitisedContext } from '../shared/schemas';
import { isRiskyAction } from '../shared/schemas';
import { substituteVaultValues } from './vault-substitute';
import { guardRequest } from '../redactor/outbound-guard';

export type StepCallback = (step: number, action: Action, thought?: string) => void;
export type ConfirmCallback = (action: Action) => Promise<boolean>;

export interface AgentLoopOptions {
  task: string;
  maxSteps: number;
  backendUrl: string;
  apiToken: string;
  onStep: StepCallback;
  onConfirm: ConfirmCallback;
  getContext: () => Promise<SanitisedContext>;
  executeInTab: (action: Action) => Promise<{ success: boolean; error?: string }>;
}

let aborted = false;

export function stopLoop(): void {
  aborted = true;
}

export function isLoopRunning(): boolean {
  return !aborted;
}

export async function runAgentLoop(opts: AgentLoopOptions): Promise<Action> {
  aborted = false;
  const history: Action[] = [];

  for (let step = 0; step < opts.maxSteps; step++) {
    if (aborted) {
      return { type: 'fail', reason: 'Stopped by user' };
    }

    const context = await opts.getContext();

    const request: AgentRequest = {
      context,
      task: opts.task,
      history,
      step,
      maxSteps: opts.maxSteps,
    };

    const requestBody = JSON.stringify(request);
    const guardResult = guardRequest(opts.backendUrl, requestBody);
    if (!guardResult.allowed) {
      const action: Action = {
        type: 'fail',
        reason: `Outbound guard blocked: ${guardResult.blockedReasons.join('; ')}`,
      };
      opts.onStep(step, action);
      return action;
    }

    let response: AgentResponse;
    try {
      const resp = await fetch(`${opts.backendUrl}/agent/step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${opts.apiToken}`,
        },
        body: requestBody,
      });

      if (!resp.ok) {
        const action: Action = { type: 'fail', reason: `Backend error: ${resp.status}` };
        opts.onStep(step, action);
        return action;
      }

      response = await resp.json();
    } catch (e) {
      const action: Action = { type: 'fail', reason: `Network error: ${(e as Error).message}` };
      opts.onStep(step, action);
      return action;
    }

    const action = response.action;
    opts.onStep(step, action, response.thought);
    history.push(action);

    if (action.type === 'done' || action.type === 'fail') {
      return action;
    }

    if (isRiskyAction(action)) {
      const confirmed = await opts.onConfirm(action);
      if (!confirmed) {
        const failAction: Action = { type: 'fail', reason: 'User declined risky action' };
        opts.onStep(step, failAction);
        return failAction;
      }
    }

    const resolvedAction = substituteVaultValues(action);

    if (action.type === 'wait') {
      await new Promise((r) => setTimeout(r, action.milliseconds));
    } else {
      const execResult = await opts.executeInTab(resolvedAction);
      if (!execResult.success) {
        const failAction: Action = {
          type: 'fail',
          reason: `Execution failed: ${execResult.error}`,
        };
        opts.onStep(step, failAction);
        return failAction;
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return { type: 'fail', reason: 'Maximum steps reached' };
}
