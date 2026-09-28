import { getAllVaultValues } from '../vault/vault';

export interface GuardResult {
  allowed: boolean;
  blockedReasons: string[];
}

const PII_PATTERNS = [
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'indian-phone', pattern: /(?:\+?91[\s-]?|0)?[6-9]\d[\s-]?\d{2,4}[\s-]?\d{4,5}/g },
  { name: 'aadhaar', pattern: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  { name: 'pan', pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { name: 'card-16', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  { name: 'upi', pattern: /\b[a-zA-Z0-9._-]+@(?:upi|paytm|ybl|okicici|oksbi|okhdfcbank)\b/gi },
  { name: 'ifsc', pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
];

const PLACEHOLDER_PATTERN = /\[[A-Z_]+_\d+\]/g;

export function scanForLeaks(payload: string): GuardResult {
  const reasons: string[] = [];

  const vaultValues = getAllVaultValues();
  for (const value of vaultValues) {
    if (value.length >= 4 && payload.includes(value)) {
      reasons.push(`Vault value leaked: "${maskValue(value)}"`);
    }
  }

  for (const { name, pattern } of PII_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(payload);
    if (match) {
      const text = match[0];
      if (!isPlaceholder(text, payload, match.index)) {
        reasons.push(`PII pattern matched (${name}): "${maskValue(text)}"`);
      }
    }
  }

  return {
    allowed: reasons.length === 0,
    blockedReasons: reasons,
  };
}

function isPlaceholder(text: string, fullPayload: string, matchIndex: number): boolean {
  PLACEHOLDER_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_PATTERN.exec(fullPayload)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (matchIndex >= start && matchIndex + text.length <= end) {
      return true;
    }
  }
  return false;
}

function maskValue(value: string): string {
  if (value.length <= 4) return '****';
  return value.substring(0, 2) + '***' + value.substring(value.length - 2);
}

export function guardRequest(
  url: string,
  body: string | Record<string, unknown>,
): GuardResult {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const combined = `${url}\n${bodyStr}`;
  return scanForLeaks(combined);
}
