import { perceiveTab } from './perception';
import { runDetectionPipeline, markSensitiveElements } from '../detectors/pipeline';
import { sanitise } from '../redactor/sanitise';
import { clearVault } from '../vault/vault';
import { resetCounters } from '../redactor/placeholder';
import { guardRequest } from '../redactor/outbound-guard';
import { calculatePrivacyScore } from '../detectors/privacy-score';
import { generateReport, downloadReportBackground } from '../report/privacy-report';
import { computePrivacyDiff } from '../report/privacy-diff';
import type { ElementInfo, Action } from '../shared/schemas';
import type { SensitivityMode } from '../detectors/types';
import type { RedactionEntry } from '../ui/PrivacyInspector';
import type { DetectionResult } from '../detectors/pipeline';

const BACKEND_URL = 'http://localhost:8000';
const API_TOKEN = 'veilagent-local-dev-token-2026';

let running = false;
let lastDetectionResult: DetectionResult | null = null;
let lastUrl = '';
let lastTitle = '';

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
  // eslint-disable-next-line no-console
  console.log('VeilAgent installed');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CAPTURE_SCREENSHOT') {
    chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
      sendResponse({ screenshot: dataUrl });
    });
    return true;
  }

  if (message.type === 'GET_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      sendResponse({ url: tab?.url, title: tab?.title, tabId: tab?.id });
    });
    return true;
  }

  if (message.type === 'PERCEIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ error: 'No active tab' });
        return;
      }
      try {
        const snapshot = await perceiveTab(tab.id);
        sendResponse(snapshot);
      } catch (err) {
        sendResponse({ error: (err as Error).message });
      }
    });
    return true;
  }

  if (message.type === 'START_AGENT') {
    const task = message.task as string;
    const sensitivity = (message.sensitivity ?? 'strict') as SensitivityMode;
    running = true;
    runAgent(task, sensitivity);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'STOP_AGENT') {
    running = false;
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'SCAN_PAGE') {
    const sensitivity = (message.sensitivity ?? 'strict') as SensitivityMode;
    scanPage(sensitivity);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'TOGGLE_OVERLAY') {
    toggleOverlay(message.visible as boolean);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'FAKE_FILL') {
    fakeFill();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'EXPORT_REPORT') {
    exportReport();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'CONFIRM_RESPONSE') {
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'DOM_CHANGED') {
    return false;
  }

  return false;
});

function notify(msg: Record<string, unknown>) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function scanPage(mode: SensitivityMode) {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      notify({ type: 'SCAN_RESULT', score: { score: 0, level: 'safe', breakdown: {} } });
      return;
    }

    const snapshot = await perceiveTab(tab.id);
    const elements = snapshot.dom.elements as ElementInfo[];
    const detectionResult = runDetectionPipeline(elements, mode);

    lastDetectionResult = detectionResult;
    lastUrl = snapshot.dom.url;
    lastTitle = snapshot.dom.title;

    const score = calculatePrivacyScore(detectionResult, snapshot.dom.url);
    notify({ type: 'SCAN_RESULT', score });

    await chrome.tabs.sendMessage(tab.id, {
      type: 'SCAN_PII',
      detections: serializeDetections(detectionResult),
    }).catch(() => {});
  } catch {
    notify({ type: 'SCAN_RESULT', score: { score: 0, level: 'safe', breakdown: {} } });
  }
}

function serializeDetections(result: DetectionResult) {
  const entries: Array<{ elementId: string; type: string; confidence: number }> = [];
  for (const [elementId, detections] of result.elementDetections) {
    for (const d of detections) {
      entries.push({ elementId, type: d.type, confidence: d.confidence });
    }
  }
  return entries;
}

async function toggleOverlay(visible: boolean) {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PII_OVERLAY', visible }).catch(() => {});
  } catch {
    // Tab not available
  }
}

async function fakeFill() {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      notify({ type: 'FILL_RESULT', result: { filled: 0, fields: [] } });
      return;
    }
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'AUTO_FILL_FAKE' });
    notify({ type: 'FILL_RESULT', result });
  } catch {
    notify({ type: 'FILL_RESULT', result: { filled: 0, fields: [] } });
  }
}

async function exportReport() {
  if (!lastDetectionResult) return;

  const score = calculatePrivacyScore(lastDetectionResult, lastUrl);
  const report = generateReport({
    url: lastUrl,
    title: lastTitle,
    detectionResult: lastDetectionResult,
    privacyScore: score,
  });

  downloadReportBackground(report);
}

async function runAgent(task: string, mode: SensitivityMode) {
  const maxSteps = 15;
  const history: Action[] = [];

  for (let step = 0; step < maxSteps; step++) {
    if (!running) {
      notify({ type: 'AGENT_STEP', step, action: { type: 'fail', reason: 'Stopped by user' } });
      notify({ type: 'AGENT_DONE' });
      return;
    }

    const tab = await getActiveTab();
    if (!tab?.id) {
      notify({ type: 'AGENT_STEP', step, action: { type: 'fail', reason: 'No active tab' } });
      notify({ type: 'AGENT_DONE' });
      return;
    }

    let snapshot;
    try {
      snapshot = await perceiveTab(tab.id);
    } catch (err) {
      notify({ type: 'AGENT_STEP', step, action: { type: 'fail', reason: `Perception failed: ${(err as Error).message}` } });
      notify({ type: 'AGENT_DONE' });
      return;
    }

    const elements = snapshot.dom.elements as ElementInfo[];
    const detectionResult = runDetectionPipeline(elements, mode);
    const marked = markSensitiveElements(elements, detectionResult);

    lastDetectionResult = detectionResult;
    lastUrl = snapshot.dom.url;
    lastTitle = snapshot.dom.title;

    clearVault();
    resetCounters();
    const { context, placeholderMap } = await sanitise({
      url: snapshot.dom.url,
      title: snapshot.dom.title,
      elements: marked,
      detectionResult,
      screenshotBase64: snapshot.screenshot.dataUrl,
      viewport: snapshot.dom.viewport,
      scrollPosition: snapshot.dom.scrollPosition,
      mode,
    });

    const diff = computePrivacyDiff(elements, context.elements, detectionResult);
    notify({ type: 'DIFF_UPDATE', diff });

    const redactions: RedactionEntry[] = [];
    for (const [placeholder, value] of placeholderMap.placeholderToValue) {
      const masked = value.length > 8
        ? value.substring(0, 3) + '***' + value.substring(value.length - 3)
        : '***';
      redactions.push({
        placeholder,
        originalPreview: masked,
        type: placeholder.replace(/\[([A-Z_]+)_\d+\]/, '$1'),
      });
    }

    const requestBody = JSON.stringify({
      context: { ...context, screenshotBase64: undefined },
      task,
      history,
      step,
      max_steps: maxSteps,
    });

    const guardResult = guardRequest(BACKEND_URL, requestBody);
    if (!guardResult.allowed) {
      notify({
        type: 'AGENT_STEP',
        step,
        action: { type: 'fail', reason: `Outbound guard blocked: ${guardResult.blockedReasons.join('; ')}` },
      });
      notify({ type: 'AGENT_ERROR' });
      return;
    }

    notify({
      type: 'INSPECTOR_UPDATE',
      data: {
        redactions,
        outgoingPayload: JSON.stringify(context, null, 2).substring(0, 5000),
        timestamp: Date.now(),
      },
    });

    let action: Action;
    let thought: string | undefined;
    try {
      const resp = await fetch(`${BACKEND_URL}/agent/step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          context: { ...context, screenshot_base64: undefined },
          task,
          history,
          step,
          max_steps: maxSteps,
        }),
      });

      if (!resp.ok) {
        action = { type: 'fail', reason: `Backend error: ${resp.status}` };
      } else {
        const data = await resp.json();
        action = data.action;
        thought = data.thought;
      }
    } catch (err) {
      action = { type: 'fail', reason: `Network error: ${(err as Error).message}` };
    }

    notify({ type: 'AGENT_STEP', step, action, thought });
    history.push(action);

    if (action.type === 'done' || action.type === 'fail') {
      notify({ type: 'AGENT_DONE' });
      return;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'EXECUTE_ACTION', action });
    } catch {
      // Action execution failed
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  notify({ type: 'AGENT_STEP', step: maxSteps, action: { type: 'fail', reason: 'Max steps reached' } });
  notify({ type: 'AGENT_DONE' });
}

export {};
