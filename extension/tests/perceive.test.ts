import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

function setupDom(html: string) {
  const dom = new JSDOM(html, { url: 'https://example.com/test' });
  const win = dom.window;
  const doc = win.document;

  // Mock getComputedStyle — JSDOM returns all elements as visible by default
  Object.defineProperty(win, 'getComputedStyle', {
    value: (el: Element) => {
      const style = el.getAttribute('style') || '';
      return {
        display: style.includes('display:none') || style.includes('display: none') ? 'none' : 'block',
        visibility: style.includes('visibility:hidden') || style.includes('visibility: hidden') ? 'hidden' : 'visible',
        opacity: style.includes('opacity:0') || style.includes('opacity: 0') ? '0' : '1',
      };
    },
  });

  // Mock getBoundingClientRect for all elements
  const origQuerySelectorAll = doc.querySelectorAll.bind(doc);
  const allElements = origQuerySelectorAll('*');
  allElements.forEach((el: Element, i: number) => {
    (el as HTMLElement).getBoundingClientRect = () => ({
      x: 10 + i * 5,
      y: 20 + i * 5,
      width: 200,
      height: 40,
      top: 20 + i * 5,
      right: 210 + i * 5,
      bottom: 60 + i * 5,
      left: 10 + i * 5,
      toJSON: () => ({}),
    });
  });

  Object.defineProperty(win, 'scrollX', { value: 0 });
  Object.defineProperty(win, 'scrollY', { value: 0 });
  Object.defineProperty(win, 'innerWidth', { value: 1920 });
  Object.defineProperty(win, 'innerHeight', { value: 1080 });
  Object.defineProperty(win, 'devicePixelRatio', { value: 2 });

  return { dom, win, doc };
}

import { toScreenshotCoords, mapDomToScreenshot } from '../src/background/perception';

describe('toScreenshotCoords / mapDomToScreenshot', () => {
  it('scales coordinates by devicePixelRatio', () => {
    const box = { x: 100, y: 200, width: 300, height: 50 };
    const result = mapDomToScreenshot(box, { x: 0, y: 0 }, 2);
    expect(result).toEqual({ x: 200, y: 400, width: 600, height: 100 });
  });

  it('accounts for scroll position', () => {
    const box = { x: 100, y: 500, width: 300, height: 50 };
    const result = mapDomToScreenshot(box, { x: 0, y: 300 }, 2);
    expect(result).toEqual({ x: 200, y: 400, width: 600, height: 100 });
  });

  it('handles 1x devicePixelRatio', () => {
    const box = { x: 50, y: 100, width: 200, height: 30 };
    const result = mapDomToScreenshot(box, { x: 0, y: 0 }, 1);
    expect(result).toEqual({ x: 50, y: 100, width: 200, height: 30 });
  });

  it('handles fractional devicePixelRatio', () => {
    const box = { x: 100, y: 100, width: 100, height: 50 };
    const result = mapDomToScreenshot(box, { x: 0, y: 0 }, 1.5);
    expect(result).toEqual({ x: 150, y: 150, width: 150, height: 75 });
  });

  it('handles horizontal and vertical scroll', () => {
    const box = { x: 500, y: 800, width: 100, height: 40 };
    const result = mapDomToScreenshot(box, { x: 200, y: 500 }, 1);
    expect(result).toEqual({ x: 300, y: 300, width: 100, height: 40 });
  });
});

describe('benchmark page element counts', () => {
  const fs = require('fs');
  const path = require('path');
  const pagesDir = path.resolve(__dirname, '../../benchmark/pages');

  const pageFiles = fs.readdirSync(pagesDir).filter((f: string) => f.endsWith('.html'));

  it('has at least 15 benchmark pages', () => {
    expect(pageFiles.length).toBeGreaterThanOrEqual(15);
  });

  for (const file of pageFiles) {
    it(`${file} has parseable HTML with interactive or text elements`, () => {
      const html = fs.readFileSync(path.join(pagesDir, file), 'utf-8');
      const dom = new JSDOM(html);
      const doc = dom.window.document;

      const interactiveCount = doc.querySelectorAll(
        'a, button, input, select, textarea, [role="button"]',
      ).length;
      const textCount = doc.querySelectorAll('h1, h2, h3, p, span, td, th, li, label').length;

      expect(interactiveCount + textCount).toBeGreaterThan(0);
    });
  }
});

describe('login page extraction simulation', () => {
  it('finds all form elements on a login page', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(
      path.resolve(__dirname, '../../benchmark/pages/01-login.html'),
      'utf-8',
    );
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const inputs = doc.querySelectorAll('input');
    expect(inputs.length).toBe(2);

    const emailInput = doc.querySelector('input[type="email"]') as HTMLInputElement;
    expect(emailInput).not.toBeNull();
    expect(emailInput.value).toBe('priya.sharma@example.com');
    expect(emailInput.autocomplete).toBe('email');

    const passwordInput = doc.querySelector('input[type="password"]') as HTMLInputElement;
    expect(passwordInput).not.toBeNull();
    expect(passwordInput.autocomplete).toBe('current-password');

    const buttons = doc.querySelectorAll('button');
    expect(buttons.length).toBe(1);

    const labels = doc.querySelectorAll('label');
    expect(labels.length).toBe(2);
  });
});

describe('KYC page extraction simulation', () => {
  it('extracts all PII fields from KYC form', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(
      path.resolve(__dirname, '../../benchmark/pages/03-kyc.html'),
      'utf-8',
    );
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const aadhaarInput = doc.querySelector('#aadhaar') as HTMLInputElement;
    expect(aadhaarInput.value).toBe('2345 6789 0123');

    const panInput = doc.querySelector('#pan') as HTMLInputElement;
    expect(panInput.value).toBe('ABCDE1234F');

    const nameInput = doc.querySelector('#name') as HTMLInputElement;
    expect(nameInput.value).toBe('Amit Kumar Singh');

    const address = doc.querySelector('#address') as HTMLTextAreaElement;
    expect(address.textContent).toContain('MG Road');
  });
});

describe('hidden fields page extraction simulation', () => {
  it('finds hidden inputs containing PII', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(
      path.resolve(__dirname, '../../benchmark/pages/13-hidden-fields.html'),
      'utf-8',
    );
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const hiddenInputs = doc.querySelectorAll('input[type="hidden"]');
    expect(hiddenInputs.length).toBeGreaterThanOrEqual(3);

    const emailHidden = doc.querySelector('input[name="userId"]') as HTMLInputElement;
    expect(emailHidden.value).toBe('priya.sharma@example.com');

    const phoneHidden = doc.querySelector('input[name="phone"]') as HTMLInputElement;
    expect(phoneHidden.value).toBe('+919876543210');

    const dataAttrs = doc.querySelector('#userData');
    expect(dataAttrs?.getAttribute('data-user-email')).toBe('amit.kumar@demo.org');
    expect(dataAttrs?.getAttribute('data-user-phone')).toBe('+91-9123456789');
  });
});

describe('table data extraction simulation', () => {
  it('extracts all rows from employee directory', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(
      path.resolve(__dirname, '../../benchmark/pages/17-table-data.html'),
      'utf-8',
    );
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const rows = doc.querySelectorAll('tbody tr');
    expect(rows.length).toBe(5);

    const cells = doc.querySelectorAll('td');
    const texts = Array.from(cells).map((td) => td.textContent);

    expect(texts).toContain('priya.sharma@example.com');
    expect(texts).toContain('+91 98765 43210');
    expect(texts).toContain('ABCDE1234F');
    expect(texts).toContain('Rahul Gupta');
  });
});

describe('URL PII extraction simulation', () => {
  it('finds PII in href attributes and titles', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(
      path.resolve(__dirname, '../../benchmark/pages/14-url-pii.html'),
      'utf-8',
    );
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const mailtoLink = doc.querySelector('a[href^="mailto:"]');
    expect(mailtoLink?.getAttribute('href')).toBe('mailto:sneha.patel@fake.co.in');

    const telLink = doc.querySelector('a[href^="tel:"]');
    expect(telLink?.getAttribute('href')).toBe('tel:+919876543210');

    const profileLink = doc.querySelector('a[href*="email="]');
    expect(profileLink?.getAttribute('href')).toContain('priya.sharma@example.com');

    const titleDiv = doc.querySelector('[title*="Card"]');
    expect(titleDiv?.getAttribute('title')).toContain('4111 1111 1111 1111');

    const imgAlt = doc.querySelector('img[alt*="Rahul"]');
    expect(imgAlt?.getAttribute('alt')).toContain('Rahul Gupta');
  });
});

describe('coordinate mapping for elements', () => {
  it('correctly maps element positions across DPR and scroll', () => {
    const testCases = [
      { box: { x: 0, y: 0, width: 100, height: 50 }, scroll: { x: 0, y: 0 }, dpr: 1, expected: { x: 0, y: 0, width: 100, height: 50 } },
      { box: { x: 100, y: 200, width: 100, height: 50 }, scroll: { x: 0, y: 0 }, dpr: 2, expected: { x: 200, y: 400, width: 200, height: 100 } },
      { box: { x: 100, y: 1200, width: 100, height: 50 }, scroll: { x: 0, y: 1000 }, dpr: 2, expected: { x: 200, y: 400, width: 200, height: 100 } },
      { box: { x: 500, y: 300, width: 200, height: 40 }, scroll: { x: 300, y: 100 }, dpr: 1.5, expected: { x: 300, y: 300, width: 300, height: 60 } },
    ];

    for (const tc of testCases) {
      const result = mapDomToScreenshot(tc.box, tc.scroll, tc.dpr);
      expect(result).toEqual(tc.expected);
    }
  });
});
