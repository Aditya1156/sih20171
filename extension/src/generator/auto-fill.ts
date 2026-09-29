import type { FakeIdentity } from './fake-data';

interface AutoFillResult {
  filled: number;
  fields: string[];
}

type IdentityField = keyof FakeIdentity;

const FIELD_MATCHERS: Record<IdentityField, RegExp> = {
  name: /\b(name|full.?name|first.?name|last.?name|user.?name|display.?name)\b/i,
  email: /\b(email|e.?mail|mail)\b/i,
  phone: /\b(phone|mobile|tel|telephone|contact.?number|cell)\b/i,
  aadhaar: /\b(aadhaar|aadhar|uid|uidai)\b/i,
  pan: /\b(pan|pan.?number|pan.?card)\b/i,
  upi: /\b(upi|upi.?id|vpa)\b/i,
  ifsc: /\b(ifsc|ifsc.?code)\b/i,
  address: /\b(address|addr|street|locality|city|location|residential)\b/i,
  dob: /\b(dob|birth|date.?of.?birth|birthday)\b/i,
  accountNumber: /\b(account|acc|account.?no|account.?number|acct)\b/i,
};

const AUTOCOMPLETE_MAP: Record<string, IdentityField> = {
  name: 'name',
  'given-name': 'name',
  'family-name': 'name',
  'additional-name': 'name',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'street-address': 'address',
  'address-line1': 'address',
  'address-line2': 'address',
  bday: 'dob',
};

const TYPE_MAP: Record<string, IdentityField> = {
  email: 'email',
  tel: 'phone',
};

function getFieldSignals(el: HTMLInputElement | HTMLTextAreaElement): string {
  const parts: string[] = [];
  if (el.id) parts.push(el.id);
  if (el.name) parts.push(el.name);
  if (el.placeholder) parts.push(el.placeholder);

  const label = el.labels?.[0]?.textContent?.trim();
  if (label) parts.push(label);

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) parts.push(ariaLabel);

  return parts.join(' ');
}

function matchField(el: HTMLInputElement | HTMLTextAreaElement): IdentityField | null {
  if (el.type === 'password' || el.type === 'hidden' || el.type === 'submit' || el.type === 'button') {
    return null;
  }

  const autocomplete = el.getAttribute('autocomplete') ?? '';
  if (autocomplete && AUTOCOMPLETE_MAP[autocomplete]) {
    return AUTOCOMPLETE_MAP[autocomplete];
  }

  if (el.type && TYPE_MAP[el.type]) {
    return TYPE_MAP[el.type];
  }

  const signals = getFieldSignals(el);
  if (!signals) return null;

  for (const [field, pattern] of Object.entries(FIELD_MATCHERS) as [IdentityField, RegExp][]) {
    if (pattern.test(signals)) return field;
  }

  return null;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const nativeInputValueSetter =
    Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      'value',
    )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function autoFillForm(identity: FakeIdentity): AutoFillResult {
  const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input, textarea',
  );

  let filled = 0;
  const fields: string[] = [];

  inputs.forEach((el) => {
    const field = matchField(el);
    if (!field) return;

    const value = identity[field];
    if (!value) return;

    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    el.focus();
    setNativeValue(el, value);

    filled++;
    fields.push(field);
  });

  return { filled, fields };
}
