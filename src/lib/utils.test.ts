import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  normalisePhone,
  isValidPhone,
  whatsappLink,
  telLink,
  humanDate,
  todayISO,
  parseConfidence
} from './utils';

describe('normalisePhone', () => {
  it('keeps the last 10 digits and prefixes +91', () => {
    expect(normalisePhone('98765 43210')).toBe('+919876543210');
    expect(normalisePhone('+91 98765-43210')).toBe('+919876543210');
    expect(normalisePhone('0 9876543210')).toBe('+919876543210');
    expect(normalisePhone('919876543210')).toBe('+919876543210');
    expect(normalisePhone('(987) 654-3210')).toBe('+919876543210');
  });

  it('returns "" when fewer than 10 digits are recoverable', () => {
    expect(normalisePhone('98765')).toBe('');
    expect(normalisePhone('abc')).toBe('');
    expect(normalisePhone('')).toBe('');
    expect(normalisePhone(null)).toBe('');
    expect(normalisePhone(undefined)).toBe('');
  });
});

describe('isValidPhone', () => {
  it('is true only when a clean 10-digit number is recoverable', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('98765')).toBe(false);
    expect(isValidPhone(null)).toBe(false);
  });
});

describe('whatsappLink / telLink', () => {
  it('wa.me drops the +', () => {
    expect(whatsappLink('+919876543210')).toBe('https://wa.me/919876543210');
  });
  it('tel: keeps the +', () => {
    expect(telLink('+919876543210')).toBe('tel:+919876543210');
  });
});

describe('humanDate', () => {
  it('formats an ISO date and returns "" for empty', () => {
    expect(humanDate('')).toBe('');
    // 2026-11-23 is a Monday.
    expect(humanDate('2026-11-23')).toMatch(/Mon/);
  });
  it('returns the input unchanged when unparseable', () => {
    expect(humanDate('not-a-date')).toBe('not-a-date');
  });
});

describe('todayISO (IST, not UTC)', () => {
  afterEach(() => vi.useRealTimers());

  it('rolls to the IST calendar date when UTC is still the previous day', () => {
    // 20:00 UTC on the 12th is 01:30 IST on the 13th — the bug this guards.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T20:00:00Z'));
    expect(todayISO()).toBe('2026-06-13');
  });

  it('matches UTC date during the IST daytime window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T06:00:00Z')); // 11:30 IST, same day
    expect(todayISO()).toBe('2026-06-12');
  });
});

describe('parseConfidence', () => {
  it('parses valid JSON and returns null for invalid/absent', () => {
    const json = '{"customer_name":0.9,"event_date":0.8,"phone_primary":0.7}';
    expect(parseConfidence(json)).toMatchObject({ customer_name: 0.9 });
    expect(parseConfidence(null)).toBeNull();
    expect(parseConfidence('{bad json')).toBeNull();
  });
});
