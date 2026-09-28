import type { Detection, Detector, DetectorInput, DetectorOptions } from './types';

const SENSITIVE_AUTOCOMPLETE = new Set([
  'email', 'tel', 'phone', 'mobile',
  'cc-name', 'cc-number', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type',
  'name', 'given-name', 'family-name', 'additional-name', 'honorific-prefix', 'honorific-suffix',
  'street-address', 'address-line1', 'address-line2', 'address-level1', 'address-level2',
  'postal-code', 'country', 'country-name',
  'bday', 'bday-day', 'bday-month', 'bday-year',
  'sex', 'username',
]);

const SENSITIVE_INPUT_TYPES = new Set(['password', 'email', 'tel']);

const SENSITIVE_CONTAINER_KEYWORDS = [
  'personal', 'payment', 'billing', 'shipping', 'address',
  'identity', 'kyc', 'verification', 'profile',
  'card details', 'bank', 'account',
];

const SENSITIVE_LABEL_KEYWORDS = [
  'aadhaar', 'aadhar', 'pan', 'passport', 'voter id', 'driving license',
  'card number', 'credit card', 'debit card', 'cvv', 'cvc',
  'phone', 'mobile', 'email', 'e-mail',
  'name', 'full name', 'first name', 'last name',
  'address', 'street', 'city', 'state', 'pin code', 'pincode', 'zip',
  'date of birth', 'dob',
  'ifsc', 'account number', 'upi',
  'ssn', 'social security',
];

function autocompleteToSensitiveType(ac: string): Detection['type'] {
  if (ac.includes('cc-') || ac === 'cc-number') return 'CARD';
  if (ac === 'email') return 'EMAIL';
  if (ac === 'tel' || ac === 'phone' || ac === 'mobile') return 'PHONE';
  if (ac.includes('name')) return 'NAME';
  if (ac.includes('address') || ac.includes('postal') || ac.includes('country')) return 'ADDRESS';
  return 'UNKNOWN_SENSITIVE';
}

function labelToSensitiveType(label: string): Detection['type'] | null {
  const l = label.toLowerCase();
  if (l.includes('aadhaar') || l.includes('aadhar')) return 'AADHAAR';
  if (l.includes('pan') && !l.includes('panel') && !l.includes('expand')) return 'PAN';
  if (l.includes('card number') || l.includes('credit card') || l.includes('debit card') || l.includes('cvv') || l.includes('cvc')) return 'CARD';
  if (l.includes('email') || l.includes('e-mail')) return 'EMAIL';
  if (l.includes('phone') || l.includes('mobile') || l.includes('tel')) return 'PHONE';
  if (l.includes('ifsc')) return 'IFSC';
  if (l.includes('upi')) return 'UPI';
  if (l.includes('account number')) return 'CARD';
  if (l.includes('name') && !l.includes('username')) return 'NAME';
  if (l.includes('address') || l.includes('street') || l.includes('city') || l.includes('pin code') || l.includes('pincode')) return 'ADDRESS';
  return null;
}

export const l1DomRules: Detector = {
  name: 'dom-rules',

  detect(elements: DetectorInput[], _options: DetectorOptions): Detection[] {
    const detections: Detection[] = [];

    for (const el of elements) {
      if (el.type === 'password') {
        detections.push({
          type: 'PASSWORD',
          confidence: 1.0,
          source: 'dom-rules',
          elementId: el.id,
          boundingBox: el.boundingBox,
        });
        continue;
      }

      if (el.type && SENSITIVE_INPUT_TYPES.has(el.type)) {
        const type = el.type === 'email' ? 'EMAIL' : 'PHONE';
        detections.push({
          type,
          confidence: 0.95,
          source: 'dom-rules',
          elementId: el.id,
          boundingBox: el.boundingBox,
        });
      }

      if (el.autocomplete && SENSITIVE_AUTOCOMPLETE.has(el.autocomplete)) {
        const type = autocompleteToSensitiveType(el.autocomplete);
        detections.push({
          type,
          confidence: 0.95,
          source: 'dom-rules',
          elementId: el.id,
          boundingBox: el.boundingBox,
        });
      }

      const labelText = el.label ?? el.placeholder ?? '';
      if (labelText) {
        const lower = labelText.toLowerCase();
        for (const keyword of SENSITIVE_LABEL_KEYWORDS) {
          if (lower.includes(keyword)) {
            const type = labelToSensitiveType(labelText);
            if (type) {
              detections.push({
                type,
                confidence: 0.85,
                source: 'dom-rules',
                elementId: el.id,
                boundingBox: el.boundingBox,
              });
            }
            break;
          }
        }
      }

      if (el.tag === 'section' || el.tag === 'fieldset' || el.tag === 'div' || el.tag === 'form') {
        const ariaLabel = el.label ?? '';
        const text = el.text ?? '';
        const combined = `${ariaLabel} ${text}`.toLowerCase();
        for (const keyword of SENSITIVE_CONTAINER_KEYWORDS) {
          if (combined.includes(keyword)) {
            detections.push({
              type: 'UNKNOWN_SENSITIVE',
              confidence: 0.7,
              source: 'dom-rules',
              elementId: el.id,
              boundingBox: el.boundingBox,
              matchedText: keyword,
            });
            break;
          }
        }
      }
    }

    return detections;
  },
};
