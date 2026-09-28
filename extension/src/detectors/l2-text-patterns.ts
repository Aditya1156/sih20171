import type { Detection, Detector, DetectorInput, DetectorOptions } from './types';
import {
  luhnCheck,
  isValidPAN,
  isValidIFSC,
  isValidUPI,
  isValidEmail,
  isValidIndianPhone,
} from './validators';

interface PatternRule {
  type: Detection['type'];
  pattern: RegExp;
  validate?: (match: string) => boolean;
  confidence: number;
}

const TEXT_PATTERNS: PatternRule[] = [
  {
    type: 'EMAIL',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    validate: isValidEmail,
    confidence: 0.98,
  },
  {
    type: 'PHONE',
    pattern: /(?:\+?91[\s-]?|0)?[6-9]\d[\s-]?\d{2,4}[\s-]?\d{4,5}/g,
    validate: isValidIndianPhone,
    confidence: 0.95,
  },
  {
    type: 'PHONE',
    pattern: /\(\s*0?91\s*\)\s*[6-9]\d{3}[\s-]?\d{3}[\s-]?\d{3}/g,
    validate: isValidIndianPhone,
    confidence: 0.90,
  },
  {
    type: 'AADHAAR',
    pattern: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    validate: (m) => {
      const digits = m.replace(/\D/g, '');
      return digits.length === 12;
    },
    confidence: 0.90,
  },
  {
    type: 'AADHAAR',
    pattern: /\b[2-9]\d{11}\b/g,
    validate: (m) => m.replace(/\D/g, '').length === 12,
    confidence: 0.85,
  },
  {
    type: 'PAN',
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    validate: isValidPAN,
    confidence: 0.98,
  },
  {
    type: 'CARD',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    validate: (m) => luhnCheck(m.replace(/[\s-]/g, '')),
    confidence: 0.95,
  },
  {
    type: 'CARD',
    pattern: /\b\d{4}[\s-]?\d{6}[\s-]?\d{5}\b/g,
    validate: (m) => luhnCheck(m.replace(/[\s-]/g, '')),
    confidence: 0.95,
  },
  {
    type: 'CARD',
    pattern: /\b\d{13,19}\b/g,
    validate: (m) => {
      const digits = m.replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) return false;
      return luhnCheck(digits);
    },
    confidence: 0.85,
  },
  {
    type: 'UPI',
    pattern: /\b[a-zA-Z0-9._-]+@(?:upi|paytm|ybl|okicici|oksbi|okhdfcbank|apl|axisbank|ibl|ikwik|freecharge|barodampay|mahb|cnrb|kotak|citi|dbs|federal|indus|rbl|sib|kvb|kaypay|lime|postbank|sbi|pnb|allbank|aubank|bandhan|boi|cub|dcb|dlb|equitas|esaf|fino|hsbc|idfcfirst|jkb|jsb|karb|kbl|kvbank|nsdl|payzapp|scb|tmb|ubi|ujvn|utbi|yesbank)\b/gi,
    validate: isValidUPI,
    confidence: 0.97,
  },
  {
    type: 'IFSC',
    pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    validate: isValidIFSC,
    confidence: 0.97,
  },
];

// eslint-disable-next-line no-useless-escape
const OBFUSCATED_EMAIL = /[a-zA-Z0-9._%+-]+\s*\[?\s*(?:at|@)\s*\]?\s*[a-zA-Z0-9.-]+\s*\[?\s*(?:dot|\.)\s*\]?\s*[a-zA-Z]{2,}/gi;

function scanText(text: string, rules: PatternRule[]): Detection[] {
  const detections: Detection[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(text)) !== null) {
      const matched = match[0];
      const key = `${rule.type}:${matched}`;
      if (seen.has(key)) continue;

      if (rule.validate && !rule.validate(matched)) continue;

      seen.add(key);
      detections.push({
        type: rule.type,
        confidence: rule.confidence,
        source: 'text-pattern',
        matchedText: matched,
      });
    }
  }

  OBFUSCATED_EMAIL.lastIndex = 0;
  let obfMatch: RegExpExecArray | null;
  while ((obfMatch = OBFUSCATED_EMAIL.exec(text)) !== null) {
    const key = `EMAIL:${obfMatch[0]}`;
    if (!seen.has(key)) {
      seen.add(key);
      detections.push({
        type: 'EMAIL',
        confidence: 0.80,
        source: 'text-pattern',
        matchedText: obfMatch[0],
      });
    }
  }

  return detections;
}

function extractScannable(el: DetectorInput): string {
  const parts: string[] = [];
  if (el.text) parts.push(el.text);
  if (el.label) parts.push(el.label);
  if (el.placeholder) parts.push(el.placeholder);
  if (el.alt) parts.push(el.alt);
  if (el.attributes) {
    for (const [key, val] of Object.entries(el.attributes)) {
      if (key.startsWith('data-') || key === 'title') {
        parts.push(val);
      }
    }
  }
  return parts.join(' ');
}

export const l2TextPatterns: Detector = {
  name: 'text-patterns',

  detect(elements: DetectorInput[], _options: DetectorOptions): Detection[] {
    const allDetections: Detection[] = [];

    for (const el of elements) {
      if (el.type === 'password') continue;

      const text = extractScannable(el);
      if (!text) continue;

      const detections = scanText(text, TEXT_PATTERNS);
      for (const d of detections) {
        d.elementId = el.id;
        d.boundingBox = el.boundingBox;
      }
      allDetections.push(...detections);
    }

    return allDetections;
  },
};

export { scanText, TEXT_PATTERNS };
