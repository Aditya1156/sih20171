import React, { useState, useCallback } from 'react';
import { PrivacyInspector } from './PrivacyInspector';
import { ConfirmDialog } from './ConfirmDialog';
import { PrivacyDiffView } from './PrivacyDiffView';
import type { InspectorData } from './PrivacyInspector';
import type { Action } from '../shared/schemas';
import { stopLoop } from '../executor/agent-loop';

type AgentStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';

interface StepEntry {
  step: number;
  action: Action;
  thought?: string;
}

interface PrivacyScoreData {
  score: number;
  level: 'safe' | 'moderate' | 'high' | 'critical';
  breakdown: Record<string, number>;
}

interface DiffData {
  entries: Array<{
    elementId: string;
    field: string;
    original: string;
    redacted: string;
    piiType: string;
  }>;
  stats: {
    totalFields: number;
    redactedFields: number;
    piiTypesFound: string[];
  };
}

type ActiveTab = 'agent' | 'scanner' | 'tools';

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

  const [activeTab, setActiveTab] = useState<ActiveTab>('agent');
  const [privacyScore, setPrivacyScore] = useState<PrivacyScoreData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [filling, setFilling] = useState(false);
  const [fillResult, setFillResult] = useState<{ filled: number; fields: string[] } | null>(null);
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const handleStart = useCallback(() => {
    if (!task.trim()) return;
    setStatus('running');
    setSteps([]);
    setInspectorData(null);
    setDiffData(null);

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

  const handleScan = useCallback(() => {
    setScanning(true);
    setPrivacyScore(null);
    chrome.runtime.sendMessage({ type: 'SCAN_PAGE', sensitivity });
  }, [sensitivity]);

  const handleToggleOverlay = useCallback(() => {
    const newState = !overlayVisible;
    setOverlayVisible(newState);
    chrome.runtime.sendMessage({ type: 'TOGGLE_OVERLAY', visible: newState });
  }, [overlayVisible]);

  const handleFakeFill = useCallback(() => {
    setFilling(true);
    setFillResult(null);
    chrome.runtime.sendMessage({ type: 'FAKE_FILL' });
  }, []);

  const handleExportReport = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'EXPORT_REPORT' });
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

      if (message.type === 'SCAN_RESULT') {
        setScanning(false);
        setPrivacyScore(message.score as PrivacyScoreData);
      }

      if (message.type === 'FILL_RESULT') {
        setFilling(false);
        setFillResult(message.result as { filled: number; fields: string[] });
      }

      if (message.type === 'DIFF_UPDATE') {
        setDiffData(message.diff as DiffData);
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

  const scoreColor = (level: string) => {
    switch (level) {
      case 'safe': return 'text-green-600 bg-green-50 border-green-200';
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">VeilAgent</h1>
        <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusColor[status]}`}>
          {status}
        </span>
      </header>

      <div className="flex border-b bg-white">
        {(['agent', 'scanner', 'tools'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'agent' ? 'Agent' : tab === 'scanner' ? 'Scanner' : 'Tools'}
          </button>
        ))}
      </div>

      {activeTab === 'agent' && (
        <>
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">Steps</h2>
              {diffData && (
                <button
                  onClick={() => setShowDiff(!showDiff)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {showDiff ? 'Hide Diff' : 'Show Privacy Diff'}
                </button>
              )}
            </div>

            {showDiff && diffData ? (
              <PrivacyDiffView diff={diffData} />
            ) : steps.length === 0 ? (
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
        </>
      )}

      {activeTab === 'scanner' && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handleScan}
                disabled={scanning}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700"
              >
                {scanning ? 'Scanning...' : 'Scan Page for PII'}
              </button>
              <button
                onClick={handleToggleOverlay}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                  overlayVisible
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {overlayVisible ? 'Hide' : 'Show'} Overlay
              </button>
            </div>

            {privacyScore && (
              <div className={`p-3 rounded-lg border ${scoreColor(privacyScore.level)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Privacy Risk Score</span>
                  <span className="text-2xl font-bold">{privacyScore.score}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      privacyScore.level === 'safe' ? 'bg-green-500' :
                      privacyScore.level === 'moderate' ? 'bg-yellow-500' :
                      privacyScore.level === 'high' ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${privacyScore.score}%` }}
                  />
                </div>
                <span className="text-xs font-medium uppercase">{privacyScore.level}</span>

                {Object.keys(privacyScore.breakdown).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(privacyScore.breakdown).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-xs">
                        <span>{type}</span>
                        <span className="font-mono">{count} found</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleExportReport}
              disabled={!privacyScore}
              className="w-full bg-gray-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-900"
            >
              Export Privacy Report
            </button>
          </div>
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-lg border">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Fake Data Fill</h3>
              <p className="text-xs text-gray-500 mb-2">
                Fill form fields with realistic but synthetic Indian identity data.
              </p>
              <button
                onClick={handleFakeFill}
                disabled={filling}
                className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-emerald-700"
              >
                {filling ? 'Filling...' : 'Auto-Fill with Fake Data'}
              </button>
              {fillResult && (
                <div className="mt-2 p-2 bg-emerald-50 rounded text-xs text-emerald-700">
                  Filled {fillResult.filled} fields: {fillResult.fields.join(', ')}
                </div>
              )}
            </div>

            <div className="p-3 bg-white rounded-lg border">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Quick Actions</h3>
              <div className="space-y-2 mt-2">
                <button
                  onClick={() => {
                    setTask('Fill the login form and submit');
                    setActiveTab('agent');
                  }}
                  className="w-full text-left px-3 py-2 text-xs bg-gray-50 rounded border hover:bg-gray-100"
                >
                  Fill & submit login form
                </button>
                <button
                  onClick={() => {
                    setTask('Scroll through the page and identify all sensitive data');
                    setActiveTab('agent');
                  }}
                  className="w-full text-left px-3 py-2 text-xs bg-gray-50 rounded border hover:bg-gray-100"
                >
                  Identify all sensitive data
                </button>
                <button
                  onClick={() => {
                    setTask('Navigate to the next page');
                    setActiveTab('agent');
                  }}
                  className="w-full text-left px-3 py-2 text-xs bg-gray-50 rounded border hover:bg-gray-100"
                >
                  Navigate to next page
                </button>
              </div>
            </div>

            <div className="p-3 bg-white rounded-lg border">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">About</h3>
              <p className="text-xs text-gray-500">
                VeilAgent v0.1.0 — Privacy-first browser agent.
                Nothing sensitive leaves the device. All PII detection
                and redaction runs locally. Only sanitised context is sent
                to the LLM for reasoning.
              </p>
            </div>
          </div>
        </div>
      )}

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
