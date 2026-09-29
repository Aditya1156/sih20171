import { perceivePage, observeDom } from './perceive';
import { executeAction } from '../executor/execute';
import { scanAndOverlay, clearOverlays, toggleOverlays } from './pii-overlay';
import { autoFillForm } from '../generator/auto-fill';
import { generateFakeIdentity } from '../generator/fake-data';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_DOM') {
    const result = perceivePage();
    sendResponse(result);
    return true;
  }

  if (message.type === 'EXECUTE_ACTION') {
    const result = executeAction(message.action);
    sendResponse(result);
    return true;
  }

  if (message.type === 'SCAN_PII') {
    const action = message.action as 'scan' | 'clear' | 'toggle' | undefined;

    if (action === 'clear') {
      clearOverlays();
      sendResponse({ success: true, visible: false });
    } else if (action === 'toggle') {
      const result = toggleOverlays();
      sendResponse({
        success: true,
        visible: result.visible,
        summary: result.result?.summary,
        latencyMs: result.result?.latencyMs,
      });
    } else {
      const result = scanAndOverlay();
      sendResponse({
        success: true,
        visible: true,
        summary: result.summary,
        latencyMs: result.latencyMs,
      });
    }

    return true;
  }

  if (message.type === 'TOGGLE_PII_OVERLAY') {
    if (message.visible) {
      scanAndOverlay();
    } else {
      clearOverlays();
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'AUTO_FILL_FAKE') {
    const identity = generateFakeIdentity();
    const result = autoFillForm(identity);
    sendResponse(result);
    return true;
  }

  if (message.type === 'DOWNLOAD_REPORT') {
    const blob = new Blob([message.json as string], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = message.filename as string;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

observeDom(() => {
  chrome.runtime.sendMessage({ type: 'DOM_CHANGED' }).catch(() => {
    // Extension context may be invalidated
  });
});

export {};
