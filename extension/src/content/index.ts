import { perceivePage, observeDom } from './perceive';
import { executeAction } from '../executor/execute';

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

  return false;
});

observeDom(() => {
  chrome.runtime.sendMessage({ type: 'DOM_CHANGED' }).catch(() => {
    // Extension context may be invalidated
  });
});

export {};
