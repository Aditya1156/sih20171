import { describe, it, expect } from 'vitest';
import {
  luhnCheck,
  verhoeffCheck,
  isValidPAN,
  isValidIFSC,
  isValidUPI,
  isValidEmail,
  isValidIndianPhone,
} from '../src/detectors/validators';

describe('luhnCheck', () => {
  it('validates Visa test card', () => {
    expect(luhnCheck('4111111111111111')).toBe(true);
  });

  it('validates MasterCard test card', () => {
    expect(luhnCheck('5500000000000004')).toBe(true);
  });

  it('validates Amex test card', () => {
    expect(luhnCheck('378282246310005')).toBe(true);
  });

  it('validates card with spaces', () => {
    expect(luhnCheck('4111 1111 1111 1111')).toBe(true);
  });

  it('validates card with dashes', () => {
    expect(luhnCheck('4111-1111-1111-1111')).toBe(true);
  });

  it('rejects invalid card number', () => {
    expect(luhnCheck('4111111111111112')).toBe(false);
  });

  it('rejects too-short number', () => {
    expect(luhnCheck('123456')).toBe(false);
  });

  it('validates 16-digit card number', () => {
    expect(luhnCheck('4532015112830366')).toBe(true);
  });
});

describe('verhoeffCheck', () => {
  it('rejects non-12-digit', () => {
    expect(verhoeffCheck('12345678')).toBe(false);
    expect(verhoeffCheck('1234567890123')).toBe(false);
  });

  it('returns boolean for 12-digit numbers', () => {
    expect(typeof verhoeffCheck('234567890123')).toBe('boolean');
    expect(typeof verhoeffCheck('987654321098')).toBe('boolean');
  });

  it('is deterministic', () => {
    const num = '234567890123';
    const r1 = verhoeffCheck(num);
    const r2 = verhoeffCheck(num);
    expect(r1).toBe(r2);
  });
});

describe('isValidPAN', () => {
  it('validates standard PAN', () => {
    expect(isValidPAN('ABCDE1234F')).toBe(true);
  });

  it('validates another PAN', () => {
    expect(isValidPAN('BNZPM2501F')).toBe(true);
  });

  it('rejects lowercase', () => {
    expect(isValidPAN('abcde1234f')).toBe(false);
  });

  it('rejects wrong format', () => {
    expect(isValidPAN('12345ABCDE')).toBe(false);
  });

  it('rejects too short', () => {
    expect(isValidPAN('ABCDE123')).toBe(false);
  });
});

describe('isValidIFSC', () => {
  it('validates SBIN', () => {
    expect(isValidIFSC('SBIN0001234')).toBe(true);
  });

  it('validates HDFC', () => {
    expect(isValidIFSC('HDFC0002345')).toBe(true);
  });

  it('rejects missing 0 at position 5', () => {
    expect(isValidIFSC('HDFC1002345')).toBe(false);
  });

  it('rejects lowercase', () => {
    expect(isValidIFSC('sbin0001234')).toBe(false);
  });
});

describe('isValidUPI', () => {
  it('validates standard UPI', () => {
    expect(isValidUPI('priya@upi')).toBe(true);
  });

  it('validates paytm UPI', () => {
    expect(isValidUPI('rahul.gupta@paytm')).toBe(true);
  });

  it('validates ybl UPI', () => {
    expect(isValidUPI('amit@ybl')).toBe(true);
  });

  it('rejects no @ symbol', () => {
    expect(isValidUPI('priya.upi')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('validates standard email', () => {
    expect(isValidEmail('priya.sharma@example.com')).toBe(true);
  });

  it('validates .in domain', () => {
    expect(isValidEmail('rahul@testmail.in')).toBe(true);
  });

  it('rejects no @', () => {
    expect(isValidEmail('priya.sharma')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(isValidEmail('priya @example.com')).toBe(false);
  });
});

describe('isValidIndianPhone', () => {
  it('validates +91 with spaces', () => {
    expect(isValidIndianPhone('+91 98765 43210')).toBe(true);
  });

  it('validates +91 no spaces', () => {
    expect(isValidIndianPhone('+919876543210')).toBe(true);
  });

  it('validates 0-prefix', () => {
    expect(isValidIndianPhone('09876543210')).toBe(true);
  });

  it('validates with dashes', () => {
    expect(isValidIndianPhone('+91-9123456789')).toBe(true);
  });

  it('validates 10-digit', () => {
    expect(isValidIndianPhone('9876543210')).toBe(true);
  });

  it('rejects too short', () => {
    expect(isValidIndianPhone('12345')).toBe(false);
  });

  it('rejects starting with 1-5', () => {
    expect(isValidIndianPhone('1234567890')).toBe(false);
  });
});
