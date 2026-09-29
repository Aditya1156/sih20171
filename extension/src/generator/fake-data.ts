import type { SensitiveType } from '../shared/schemas';

export interface FakeIdentity {
  name: string;
  email: string;
  phone: string;
  aadhaar: string;
  pan: string;
  upi: string;
  ifsc: string;
  address: string;
  dob: string;
  accountNumber: string;
}

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun',
  'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Shaurya',
  'Ananya', 'Diya', 'Myra', 'Sara', 'Aadhya',
  'Isha', 'Kavya', 'Riya', 'Neha', 'Priya',
  'Rohan', 'Karan', 'Amit', 'Pooja', 'Sneha',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar',
  'Patel', 'Reddy', 'Nair', 'Joshi', 'Mehta',
  'Iyer', 'Pillai', 'Desai', 'Rao', 'Choudhury',
  'Bhat', 'Kapoor', 'Malhotra', 'Banerjee', 'Das',
  'Saxena', 'Agarwal', 'Tiwari', 'Pandey', 'Mishra',
];

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.co.in', 'outlook.com'];

const BANK_PREFIXES = ['SBIN', 'HDFC', 'ICIC', 'PUNB', 'BARB'];

const PAN_TYPE_CODES = ['P', 'C', 'H', 'A', 'B', 'G', 'J', 'L', 'F', 'T'];

const CITIES_STATES: [string, string, string][] = [
  ['Mumbai', 'Maharashtra', '400001'],
  ['Delhi', 'Delhi', '110001'],
  ['Bengaluru', 'Karnataka', '560001'],
  ['Hyderabad', 'Telangana', '500001'],
  ['Chennai', 'Tamil Nadu', '600001'],
  ['Kolkata', 'West Bengal', '700001'],
  ['Pune', 'Maharashtra', '411001'],
  ['Ahmedabad', 'Gujarat', '380001'],
  ['Jaipur', 'Rajasthan', '302001'],
  ['Lucknow', 'Uttar Pradesh', '226001'],
  ['Chandigarh', 'Punjab', '160001'],
  ['Kochi', 'Kerala', '682001'],
  ['Bhopal', 'Madhya Pradesh', '462001'],
  ['Patna', 'Bihar', '800001'],
  ['Guwahati', 'Assam', '781001'],
  ['Dehradun', 'Uttarakhand', '248001'],
  ['Indore', 'Madhya Pradesh', '452001'],
  ['Nagpur', 'Maharashtra', '440001'],
  ['Coimbatore', 'Tamil Nadu', '641001'],
  ['Visakhapatnam', 'Andhra Pradesh', '530001'],
];

const STREET_NAMES = [
  'MG Road', 'Gandhi Nagar', 'Nehru Street', 'Park Avenue',
  'Station Road', 'Temple Street', 'Lake View Colony', 'Civil Lines',
  'Rajaji Street', 'Subhash Marg', 'Tilak Road', 'Patel Nagar',
];

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDigits(n: number): string {
  let result = '';
  for (let i = 0; i < n; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

function randomUpperLetter(): string {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

function generateName(): string {
  return `${randomElement(FIRST_NAMES)} ${randomElement(LAST_NAMES)}`;
}

function generateEmail(name: string): string {
  const parts = name.toLowerCase().split(' ');
  const separator = randomElement(['.', '_', '']);
  const suffix = randomInt(1, 999).toString();
  const local = parts.join(separator) + suffix;
  return `${local}@${randomElement(EMAIL_DOMAINS)}`;
}

function generatePhone(): string {
  const firstDigit = randomInt(6, 9);
  const rest = randomDigits(9);
  return `+91 ${firstDigit}${rest}`;
}

function computeVerhoeffCheckDigit(digits: string): number {
  let c = 0;
  const len = digits.length;
  for (let i = 0; i < len; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[((i + 1) % 8)][parseInt(digits[len - 1 - i], 10)]];
  }
  return VERHOEFF_INV[c];
}

function generateAadhaar(): string {
  const firstDigit = randomInt(2, 9);
  const middle = randomDigits(10);
  const partial = `${firstDigit}${middle}`;
  const check = computeVerhoeffCheckDigit(partial);
  return `${partial}${check}`;
}

function generatePAN(): string {
  const first = randomUpperLetter();
  const second = randomUpperLetter();
  const typeCode = randomElement(PAN_TYPE_CODES);
  const fourth = randomUpperLetter();
  const fifth = randomUpperLetter();
  const digits = randomDigits(4);
  const last = randomUpperLetter();
  return `${first}${second}${typeCode}${fourth}${fifth}${digits}${last}`;
}

function generateUPI(name: string): string {
  const first = name.split(' ')[0].toLowerCase();
  return `${first}@upi`;
}

function generateIFSC(): string {
  const bank = randomElement(BANK_PREFIXES);
  const branch = randomDigits(6).replace(/[^0-9]/g, '');
  return `${bank}0${branch}`;
}

function generateAddress(): string {
  const [city, state, pin] = randomElement(CITIES_STATES);
  const houseNo = randomInt(1, 999);
  const street = randomElement(STREET_NAMES);
  return `${houseNo}, ${street}, ${city}, ${state} ${pin}`;
}

function generateDOB(): string {
  const now = new Date();
  const age = randomInt(18, 65);
  const year = now.getFullYear() - age;
  const month = randomInt(1, 12);
  const maxDay = new Date(year, month, 0).getDate();
  const day = randomInt(1, maxDay);
  const dd = day.toString().padStart(2, '0');
  const mm = month.toString().padStart(2, '0');
  return `${dd}/${mm}/${year}`;
}

function generateAccountNumber(): string {
  const len = randomInt(11, 16);
  return randomDigits(len);
}

export function generateFakeIdentity(): FakeIdentity {
  const name = generateName();
  return {
    name,
    email: generateEmail(name),
    phone: generatePhone(),
    aadhaar: generateAadhaar(),
    pan: generatePAN(),
    upi: generateUPI(name),
    ifsc: generateIFSC(),
    address: generateAddress(),
    dob: generateDOB(),
    accountNumber: generateAccountNumber(),
  };
}

export function generateFakeValue(type: SensitiveType): string {
  const name = generateName();
  const mapping: Partial<Record<SensitiveType, () => string>> = {
    NAME: () => name,
    EMAIL: () => generateEmail(name),
    PHONE: () => generatePhone(),
    AADHAAR: () => generateAadhaar(),
    PAN: () => generatePAN(),
    UPI: () => generateUPI(name),
    IFSC: () => generateIFSC(),
    ADDRESS: () => generateAddress(),
    CARD: () => generateAccountNumber(),
  };

  const generator = mapping[type];
  if (generator) return generator();
  return '';
}
