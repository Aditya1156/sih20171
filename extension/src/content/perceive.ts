import type { ElementInfo, BoundingBox } from '../shared/schemas';

let elementIdCounter = 0;
const elementIdMap = new WeakMap<Element, string>();

export function getStableId(el: Element): string {
  let id = elementIdMap.get(el);
  if (!id) {
    id = `ve-${elementIdCounter++}`;
    elementIdMap.set(el, id);
  }
  return id;
}

export function resetIdCounter(): void {
  elementIdCounter = 0;
}

export function isElementVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  ) {
    return false;
  }

  if (el instanceof HTMLElement && el.hidden) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  if (
    rect.bottom < 0 ||
    rect.right < 0 ||
    rect.top > window.innerHeight ||
    rect.left > window.innerWidth
  ) {
    return false;
  }

  return true;
}

export interface CoordinateContext {
  scrollX: number;
  scrollY: number;
  devicePixelRatio: number;
}

export function getCoordinateContext(): CoordinateContext {
  return {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

export function getBoundingBox(el: Element, ctx: CoordinateContext): BoundingBox {
  const rect = el.getBoundingClientRect();
  return {
    x: Math.round(rect.x + ctx.scrollX),
    y: Math.round(rect.y + ctx.scrollY),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

export function toScreenshotCoords(box: BoundingBox, ctx: CoordinateContext): BoundingBox {
  const dpr = ctx.devicePixelRatio;
  return {
    x: Math.round((box.x - ctx.scrollX) * dpr),
    y: Math.round((box.y - ctx.scrollY) * dpr),
    width: Math.round(box.width * dpr),
    height: Math.round(box.height * dpr),
  };
}

function getLabel(el: Element, root: Document | ShadowRoot): string | undefined {
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    if (el.labels && el.labels.length > 0) {
      return el.labels[0].textContent?.trim();
    }

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const ownerDoc = root instanceof Document ? root : root.ownerDocument;
      const labelEl = ownerDoc?.getElementById(ariaLabelledBy);
      if (labelEl) return labelEl.textContent?.trim();
    }

    if (el.id) {
      const ownerDoc = root instanceof Document ? root : root.ownerDocument;
      const labelEl = ownerDoc?.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl) return labelEl.textContent?.trim();
    }

    if (el.title) return el.title;
  }

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  return undefined;
}

function getInputType(el: Element): string | undefined {
  if (el instanceof HTMLInputElement) return el.type;
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  if (el instanceof HTMLSelectElement) return 'select';
  if (el.getAttribute('contenteditable') === 'true') return 'contenteditable';
  return undefined;
}

function getAutocomplete(el: Element): string | undefined {
  const val = el.getAttribute('autocomplete');
  if (val && val !== 'off' && val !== 'on') return val;
  return undefined;
}

function getTextContent(el: Element): string | undefined {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'password') return undefined;
    return undefined;
  }
  if (el instanceof HTMLTextAreaElement) return undefined;
  if (el instanceof HTMLSelectElement) {
    return el.options[el.selectedIndex]?.text?.trim();
  }

  const text = el.textContent?.trim();
  if (!text) return undefined;
  return text.length > 500 ? text.substring(0, 500) : text;
}

function getAltText(el: Element): string | undefined {
  if (el instanceof HTMLImageElement) return el.alt || undefined;
  return el.getAttribute('alt') ?? undefined;
}

const INTERACTIVE_SELECTORS = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="textbox"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="searchbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[contenteditable="true"]',
].join(', ');

const TEXT_SELECTORS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'label', 'td', 'th', 'li',
  'dd', 'dt', 'figcaption', 'blockquote',
  'pre', 'code', 'strong', 'em', 'b', 'i',
  '[role="heading"]',
  '[role="cell"]',
  '[role="gridcell"]',
  '[role="status"]',
  '[role="alert"]',
].join(', ');

const MEDIA_SELECTORS = 'img, canvas, video, svg';

const ALL_SELECTORS = `${INTERACTIVE_SELECTORS}, ${TEXT_SELECTORS}, ${MEDIA_SELECTORS}`;

export interface PerceptionResult {
  elements: ElementInfo[];
  url: string;
  title: string;
  viewport: { width: number; height: number };
  scrollPosition: { x: number; y: number };
  devicePixelRatio: number;
  timestamp: number;
  pageHeight: number;
  pageWidth: number;
}

export function extractElements(
  root: Document | ShadowRoot = document,
  ctx?: CoordinateContext,
  iframeOffset?: { x: number; y: number },
): ElementInfo[] {
  const coordCtx = ctx ?? getCoordinateContext();
  const elements: ElementInfo[] = [];
  const seen = new Set<Element>();

  const nodeList = root.querySelectorAll(ALL_SELECTORS);

  for (const el of nodeList) {
    if (seen.has(el)) continue;
    seen.add(el);

    if (!isElementVisible(el)) continue;

    const box = getBoundingBox(el, coordCtx);

    if (iframeOffset) {
      box.x += iframeOffset.x;
      box.y += iframeOffset.y;
    }

    const info: ElementInfo = {
      id: getStableId(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') ?? undefined,
      type: getInputType(el),
      label: getLabel(el, root),
      placeholder: el.getAttribute('placeholder') ?? undefined,
      text: getTextContent(el),
      boundingBox: box,
      isVisible: true,
      isSensitive: false,
    };

    const autocomplete = getAutocomplete(el);
    if (autocomplete) {
      (info as ElementInfo & { autocomplete?: string }).autocomplete = autocomplete;
    }

    const alt = getAltText(el);
    if (alt) {
      (info as ElementInfo & { alt?: string }).alt = alt;
    }

    elements.push(info);

    if (el.shadowRoot) {
      elements.push(...extractElements(el.shadowRoot, coordCtx, iframeOffset));
    }
  }

  const iframes = root.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      if (iframe.contentDocument) {
        const iframeRect = iframe.getBoundingClientRect();
        const offset = {
          x: Math.round(iframeRect.x + coordCtx.scrollX + (iframeOffset?.x ?? 0)),
          y: Math.round(iframeRect.y + coordCtx.scrollY + (iframeOffset?.y ?? 0)),
        };
        elements.push(...extractElements(iframe.contentDocument, coordCtx, offset));
      }
    } catch {
      // Cross-origin iframe — skip DOM access
    }
  }

  return elements;
}

export function perceivePage(): PerceptionResult {
  const ctx = getCoordinateContext();
  const elements = extractElements(document, ctx);

  return {
    elements,
    url: window.location.href,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scrollPosition: { x: ctx.scrollX, y: ctx.scrollY },
    devicePixelRatio: ctx.devicePixelRatio,
    timestamp: Date.now(),
    pageHeight: document.documentElement.scrollHeight,
    pageWidth: document.documentElement.scrollWidth,
  };
}

let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let onDomChange: (() => void) | null = null;

export function observeDom(callback: () => void): MutationObserver {
  onDomChange = callback;

  const observer = new MutationObserver(() => {
    if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = setTimeout(() => {
      onDomChange?.();
    }, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'type', 'value', 'src', 'href'],
    characterData: true,
  });

  return observer;
}
