import type { SensitiveType } from '../shared/schemas';
import type { Detection } from '../detectors/types';
import type { DetectionResult } from '../detectors/pipeline';
import { runDetectionPipeline } from '../detectors/pipeline';
import { perceivePage } from './perceive';
import { getStableId } from './perceive';

const OVERLAY_ATTR = 'data-veilagent-overlay';
const BADGE_ATTR = 'data-veilagent-badge';
const TOOLTIP_ATTR = 'data-veilagent-tooltip';

const TYPE_COLORS: Record<string, string> = {
  EMAIL: '#2563eb',
  PHONE: '#16a34a',
  AADHAAR: '#dc2626',
  PAN: '#ea580c',
  CARD: '#dc2626',
  UPI: '#9333ea',
  IFSC: '#0d9488',
  PASSWORD: '#dc143c',
  NAME: '#6366f1',
  ADDRESS: '#ca8a04',
  FACE: '#e11d48',
  PII_IMAGE: '#e11d48',
  UNKNOWN_SENSITIVE: '#71717a',
};

let overlaysVisible = false;

function getColor(type: SensitiveType): string {
  return TYPE_COLORS[type] ?? TYPE_COLORS.UNKNOWN_SENSITIVE;
}

function findDomElement(elementId: string): Element | null {
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    if (el.getAttribute('data-veilagent-id') === elementId) {
      return el;
    }
  }
  return null;
}

function createOverlay(
  element: Element,
  detections: Detection[],
): { overlay: HTMLDivElement; badge: HTMLDivElement; tooltip: HTMLDivElement } {
  const rect = element.getBoundingClientRect();

  const overlay = document.createElement('div');
  overlay.setAttribute(OVERLAY_ATTR, 'true');
  overlay.style.position = 'absolute';
  overlay.style.left = `${rect.left + window.scrollX}px`;
  overlay.style.top = `${rect.top + window.scrollY}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.zIndex = '99999';
  overlay.style.pointerEvents = 'none';
  overlay.style.boxSizing = 'border-box';

  const primaryDetection = detections.reduce((a, b) =>
    a.confidence > b.confidence ? a : b,
  );
  const color = getColor(primaryDetection.type);

  overlay.style.border = `2px solid ${color}`;
  overlay.style.borderRadius = '3px';
  overlay.style.backgroundColor = `${color}1a`;

  const badge = document.createElement('div');
  badge.setAttribute(BADGE_ATTR, 'true');
  badge.style.position = 'absolute';
  badge.style.top = '-10px';
  badge.style.right = '-4px';
  badge.style.backgroundColor = color;
  badge.style.color = '#ffffff';
  badge.style.fontSize = '10px';
  badge.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  badge.style.fontWeight = '600';
  badge.style.padding = '1px 5px';
  badge.style.borderRadius = '3px';
  badge.style.lineHeight = '14px';
  badge.style.whiteSpace = 'nowrap';
  badge.style.zIndex = '100000';
  badge.style.pointerEvents = 'auto';
  badge.style.cursor = 'default';
  badge.textContent = primaryDetection.type;

  const tooltip = document.createElement('div');
  tooltip.setAttribute(TOOLTIP_ATTR, 'true');
  tooltip.style.position = 'absolute';
  tooltip.style.top = '-36px';
  tooltip.style.right = '0';
  tooltip.style.backgroundColor = '#1e1e2e';
  tooltip.style.color = '#f5f5f5';
  tooltip.style.fontSize = '11px';
  tooltip.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  tooltip.style.padding = '4px 8px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.whiteSpace = 'nowrap';
  tooltip.style.zIndex = '100001';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.opacity = '0';
  tooltip.style.transition = 'opacity 0.15s ease';
  tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';

  const typeLabels = detections.map(
    (d) => `${d.type} (${Math.round(d.confidence * 100)}%)`,
  );
  tooltip.textContent = `Detected: ${typeLabels.join(', ')}`;

  badge.addEventListener('mouseenter', () => {
    tooltip.style.opacity = '1';
  });
  badge.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
  });

  overlay.appendChild(badge);
  overlay.appendChild(tooltip);

  return { overlay, badge, tooltip };
}

function tagDomElements(): void {
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    const id = getStableId(el);
    el.setAttribute('data-veilagent-id', id);
  }
}

export function clearOverlays(): void {
  const overlays = document.querySelectorAll(`[${OVERLAY_ATTR}]`);
  for (const el of overlays) {
    el.remove();
  }
  overlaysVisible = false;
}

export function scanAndOverlay(): DetectionResult {
  clearOverlays();
  tagDomElements();

  const perception = perceivePage();
  const result = runDetectionPipeline(perception.elements, 'strict');

  for (const [elementId, detections] of result.elementDetections) {
    const domEl = findDomElement(elementId);
    if (!domEl) continue;

    const { overlay } = createOverlay(domEl, detections);
    document.body.appendChild(overlay);
  }

  overlaysVisible = true;
  return result;
}

export function toggleOverlays(): { visible: boolean; result?: DetectionResult } {
  if (overlaysVisible) {
    clearOverlays();
    return { visible: false };
  }
  const result = scanAndOverlay();
  return { visible: true, result };
}

export function isOverlayVisible(): boolean {
  return overlaysVisible;
}
