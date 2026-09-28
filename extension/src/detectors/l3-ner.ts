import type { Detection, Detector, DetectorInput, DetectorOptions } from './types';

const NAME_PATTERN = /\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;

const ADDRESS_INDICATORS = [
  /\b(?:road|street|lane|nagar|colony|sector|block|plot|floor|flat|house|apartment|apt)\b/i,
  /\b(?:bengaluru|bangalore|mumbai|delhi|chennai|kolkata|hyderabad|pune|ahmedabad|jaipur|noida|gurgaon|gurugram)\b/i,
  /\b(?:karnataka|maharashtra|tamil\s*nadu|west\s*bengal|telangana|rajasthan|uttar\s*pradesh|gujarat|kerala|andhra\s*pradesh)\b/i,
  /\b\d{6}\b/,
  /\b(?:pin|zip)\s*(?:code)?\s*:?\s*\d{6}\b/i,
];

const COMMON_NON_NAMES = new Set([
  'test page', 'test bank', 'sign up', 'log in', 'get started',
  'click here', 'read more', 'learn more', 'next step',
  'submit application', 'personal details', 'payment details',
  'create account', 'forgot password', 'account summary',
  'recent transactions', 'employee directory',
]);

function isLikelyName(text: string): boolean {
  const lower = text.toLowerCase();
  if (COMMON_NON_NAMES.has(lower)) return false;
  if (text.length < 4 || text.length > 60) return false;
  if (/\d/.test(text)) return false;
  if (/[<>{}()@#$%^&*[\]]/.test(text)) return false;
  return true;
}

export const l3Ner: Detector = {
  name: 'ner',

  detect(elements: DetectorInput[], _options: DetectorOptions): Detection[] {
    const detections: Detection[] = [];

    for (const el of elements) {
      if (el.type === 'password') continue;

      const text = el.text ?? '';
      if (!text) continue;

      NAME_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = NAME_PATTERN.exec(text)) !== null) {
        const candidate = match[0];
        if (isLikelyName(candidate)) {
          detections.push({
            type: 'NAME',
            confidence: 0.75,
            source: 'ner',
            elementId: el.id,
            boundingBox: el.boundingBox,
            matchedText: candidate,
          });
        }
      }

      for (const indicator of ADDRESS_INDICATORS) {
        if (indicator.test(text)) {
          detections.push({
            type: 'ADDRESS',
            confidence: 0.70,
            source: 'ner',
            elementId: el.id,
            boundingBox: el.boundingBox,
            matchedText: text.substring(0, 200),
          });
          break;
        }
      }
    }

    return detections;
  },
};
