import React, { useState, useCallback } from 'react';
import { PrivacyInspector } from './PrivacyInspector';
import { ConfirmDialog } from './ConfirmDialog';
import type { InspectorData } from './PrivacyInspector';
import type { Action } from '../shared/schemas';
import { stopLoop } from '../executor/agent-loop';

type AgentStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';

interface StepEntry {
  step: number;
  action: Action;
  thought?: string;
}

export function App() {
  const [task, setTask] = useState('');
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [sensitivity, setSensitivity] = useState<'strict' | 'balanced'>('strict');
  const [inspectorData, setInspectorData] = useState<InspectorData | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    action: Action;
    resolve: (value: boolean) => void;
  } | null>(null);

  const handleStart = useCallback(() => {
    if (!task.trim()) return;
    setStatus('running');
    setSteps([]);
    setInspectorData(null);

    chrome.runtime.sendMessage({
      type: 'START_AGENT',
      task: task.trim(),
      sensitivity,
    });
  }, [task, sensitivity]);

  const handleStop = useCallback(() => {
    stopLoop();
    setStatus('idle');
    chrome.runtime.sendMessage({ type: 'STOP_AGENT' });
  }, []);

  React.useEffect(() => {
    const listener = (message: Record<string, unknown>) => {
      if (message.type === 'AGENT_STEP') {
        setSteps((prev) => [
          ...prev,
          {
            step: message.step as number,
            action: message.action as Action,
            thought: message.thought as string | undefined,
          },
        ]);
      }

      if (message.type === 'AGENT_DONE') {
        setStatus('done');
      }

      if (message.type === 'AGENT_ERROR') {
        setStatus('error');
      }

      if (message.type === 'INSPECTOR_UPDATE') {
        setInspectorData(message.data as InspectorData);
      }

      if (message.type === 'CONFIRM_ACTION') {
        const action = message.action as Action;
        setPendingConfirm({
          action,
          resolve: (confirmed) => {
            chrome.runtime.sendMessage({
              type: 'CONFIRM_RESPONSE',
              confirmed,
            });
            setPendingConfirm(null);
          },
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const formatAction = (action: Action): string => {
    switch (action.type) {
      case 'click':
        return `Click ${action.elementId}`;
      case 'type':
        return `Type "${action.value}" into ${action.elementId}`;
      case 'scroll':
        return `Scroll ${action.direction}`;
      case 'select':
        return `Select "${action.value}" in ${action.elementId}`;
      case 'wait':
        return `Wait ${action.milliseconds}ms`;
      case 'done':
        return `Done: ${action.summary}`;
      case 'fail':
        return `Failed: ${action.reason}`;
      default:
        return `Unknown action`;
    }
  };

  const statusColor: Record<AgentStatus, string> = {
    idle: 'bg-gray-500',
    running: 'bg-green-500',
    paused: 'bg-yellow-500',
    done: 'bg-blue-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">VeilAgent</h1>
        <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusColor[status]}`}>
          {status}
        </span>
      </header>

      <div className="px-4 py-2 bg-white border-b flex items-center justify-between">
        <span className="text-sm text-gray-600">Sensitivity</span>
        <button
          onClick={() => setSensitivity((s) => (s === 'strict' ? 'balanced' : 'strict'))}
          className={`text-xs px-3 py-1 rounded-full font-medium ${
            sensitivity === 'strict'
              ? 'bg-red-100 text-red-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}
          disabled={status === 'running'}
        >
          {sensitivity === 'strict' ? 'Strict' : 'Balanced'}
        </button>
      </div>

      <div className="px-4 py-3 bg-white border-b">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe your task..."
          className="w-full border rounded-lg p-2 text-sm resize-none h-20 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          disabled={status === 'running'}
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleStart}
            disabled={status === 'running' || !task.trim()}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700"
          >
            Start
          </button>
          <button
            onClick={handleStop}
            disabled={status !== 'running'}
            className="px-4 bg-red-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-red-600"
          >
            Stop
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Steps</h2>
        {steps.length === 0 ? (
          <p className="text-xs text-gray-400">No steps yet. Enter a task and press Start.</p>
        ) : (
          <ul className="space-y-1">
            {steps.map((entry, i) => (
              <li key={i} className="text-xs bg-white rounded p-2 border">
                <div className="flex items-start gap-1">
                  <span className="text-gray-400 font-mono shrink-0">
                    {entry.step + 1}.
                  </span>
                  <div>
                    <span
                      className={`font-medium ${
                        entry.action.type === 'fail'
                          ? 'text-red-600'
                          : entry.action.type === 'done'
                            ? 'text-green-600'
                            : 'text-gray-700'
                      }`}
                    >
                      {formatAction(entry.action)}
                    </span>
                    {entry.thought && (
                      <p className="text-gray-400 italic mt-0.5">{entry.thought}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PrivacyInspector data={inspectorData} />

      {pendingConfirm && (
        <ConfirmDialog
          action={pendingConfirm.action}
          onConfirm={() => pendingConfirm.resolve(true)}
          onDeny={() => pendingConfirm.resolve(false)}
        />
      )}
    </div>
  );
}
