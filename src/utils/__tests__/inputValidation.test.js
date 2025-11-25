import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  isValidEmail,
  validatePassword,
  validateDisplayName,
  isValidUserId,
  sanitizeEventId,
} from '../inputValidation.js';

describe('inputValidation', () => {
  describe('sanitizeString', () => {
    it('should remove dangerous HTML characters', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeString('Hello <world>')).toBe('Hello world');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
    });

    it('should remove event handlers', () => {
      expect(sanitizeString('onclick=evil()')).toBe('evil()');
      expect(sanitizeString('onerror=bad()')).toBe('bad()');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject passwords that are too short', () => {
      const result = validatePassword('short');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 6 characters');
    });

    it('should reject passwords that are too long', () => {
      const longPassword = 'a'.repeat(129);
      const result = validatePassword(longPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be less than 128 characters');
    });

    it('should require password to be provided', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });
  });

  describe('validateDisplayName', () => {
    it('should accept valid display names', () => {
      const result = validateDisplayName('John Doe');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject names that are too short', () => {
      const result = validateDisplayName('A');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Display name must be at least 2 characters');
    });

    it('should reject names that are too long', () => {
      const longName = 'A'.repeat(51);
      const result = validateDisplayName(longName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Display name must be less than 50 characters');
    });

    it('should sanitize dangerous characters', () => {
      const result = validateDisplayName('<script>alert("xss")</script>');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Display name contains invalid characters');
    });
  });

  describe('isValidUserId', () => {
    it('should accept valid Firebase UIDs', () => {
      expect(isValidUserId('abc123def456ghi789jkl012mno345')).toBe(true);
      expect(isValidUserId('a'.repeat(28))).toBe(true);
    });

    it('should reject invalid UIDs', () => {
      expect(isValidUserId('')).toBe(false);
      expect(isValidUserId('short')).toBe(false);
      expect(isValidUserId('a'.repeat(200))).toBe(false);
      expect(isValidUserId('invalid-uid!')).toBe(false);
      expect(isValidUserId(null)).toBe(false);
    });
  });

  describe('sanitizeEventId', () => {
    it('should sanitize valid event IDs', () => {
      expect(sanitizeEventId('wwe-wrestlemania-2024')).toBe('wwe-wrestlemania-2024');
      expect(sanitizeEventId('aew_double_or_nothing')).toBe('aew_double_or_nothing');
    });

    it('should remove invalid characters', () => {
      expect(sanitizeEventId('event<script>')).toBe('eventscript');
      expect(sanitizeEventId('event@id')).toBe('eventid');
    });

    it('should return null for invalid IDs', () => {
      expect(sanitizeEventId('')).toBe(null);
      expect(sanitizeEventId('a'.repeat(101))).toBe(null);
      expect(sanitizeEventId(null)).toBe(null);
    });
  });
});
