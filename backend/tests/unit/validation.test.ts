import { describe, test, expect } from 'vitest';
import {
  validateQuery,
  validateLimit,
  validateOffset,
  validateCountryCode,
} from '../../src/utils/validation.js';
import { EmptyQueryError, InvalidQueryError } from '../../src/types/errors.js';

describe('Query Validation', () => {
  describe('validateQuery', () => {
    test('accepts valid query strings', () => {
      expect(validateQuery('Beatles')).toBe('Beatles');
      expect(validateQuery('  Beatles  ')).toBe('Beatles'); // trims whitespace
      expect(validateQuery('AC/DC')).toBe('AC/DC');
      expect(validateQuery('Beyoncé')).toBe('Beyoncé');
      expect(validateQuery('北京')).toBe('北京');
    });

    test('trims whitespace from query', () => {
      expect(validateQuery('  test  ')).toBe('test');
      expect(validateQuery('\n\ttest\t\n')).toBe('test');
    });

    test('rejects empty strings', () => {
      expect(() => validateQuery('')).toThrow(EmptyQueryError);
    });

    test('rejects whitespace-only strings', () => {
      expect(() => validateQuery('   ')).toThrow(EmptyQueryError);
      expect(() => validateQuery('\t\n')).toThrow(EmptyQueryError);
    });

    test('rejects queries over 200 characters', () => {
      const longQuery = 'a'.repeat(201);
      expect(() => validateQuery(longQuery)).toThrow(InvalidQueryError);
    });

    test('accepts queries exactly 200 characters', () => {
      const maxQuery = 'a'.repeat(200);
      expect(validateQuery(maxQuery)).toBe(maxQuery);
    });

    test('accepts queries with special characters', () => {
      expect(validateQuery('foo & bar')).toBe('foo & bar');
      expect(validateQuery('test@#$%')).toBe('test@#$%');
      expect(validateQuery('hello?world!')).toBe('hello?world!');
    });

    test('supports UTF-8 characters', () => {
      expect(validateQuery('Müller')).toBe('Müller');
      expect(validateQuery('José')).toBe('José');
      expect(validateQuery('مصر')).toBe('مصر');
      expect(validateQuery('Москва')).toBe('Москва');
    });
  });

  describe('validateLimit', () => {
    test('returns default limit when undefined', () => {
      expect(validateLimit(undefined)).toBe(20);
    });

    test('accepts valid limits', () => {
      expect(validateLimit(1)).toBe(1);
      expect(validateLimit(25)).toBe(25);
      expect(validateLimit(50)).toBe(50);
    });

    test('caps limit at 50', () => {
      expect(validateLimit(100)).toBe(50);
      expect(validateLimit(999)).toBe(50);
    });

    test('sets minimum limit to 1', () => {
      expect(validateLimit(0)).toBe(1);
      expect(validateLimit(-5)).toBe(1);
    });
  });

  describe('validateOffset', () => {
    test('returns default offset when undefined', () => {
      expect(validateOffset(undefined)).toBe(0);
    });

    test('accepts valid offsets', () => {
      expect(validateOffset(0)).toBe(0);
      expect(validateOffset(10)).toBe(10);
      expect(validateOffset(100)).toBe(100);
    });

    test('sets negative offsets to 0', () => {
      expect(validateOffset(-1)).toBe(0);
      expect(validateOffset(-100)).toBe(0);
    });
  });

  describe('validateCountryCode', () => {
    test('returns default country code when undefined', () => {
      expect(validateCountryCode(undefined)).toBe('US');
    });

    test('accepts valid 2-letter country codes', () => {
      expect(validateCountryCode('US')).toBe('US');
      expect(validateCountryCode('GB')).toBe('GB');
      expect(validateCountryCode('DE')).toBe('DE');
    });

    test('converts lowercase to uppercase', () => {
      expect(validateCountryCode('us')).toBe('US');
      expect(validateCountryCode('gb')).toBe('GB');
    });

    test('rejects invalid country code lengths', () => {
      expect(validateCountryCode('USA')).toBe('US'); // Falls back to default
      expect(validateCountryCode('U')).toBe('US');
      expect(validateCountryCode('')).toBe('US');
    });
  });
});
