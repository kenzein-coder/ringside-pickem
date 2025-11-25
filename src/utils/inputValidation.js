/**
 * Input Validation & Sanitization Utilities
 * Prevents XSS attacks and validates user input
 */

/**
 * Sanitizes a string to prevent XSS attacks
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers (onclick=, onerror=, etc.)
    .trim();
}

/**
 * Validates email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Password is required'] };
  }

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates display name
 * @param {string} displayName - Display name to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateDisplayName(displayName) {
  const errors = [];

  if (!displayName || typeof displayName !== 'string') {
    return { isValid: false, errors: ['Display name is required'] };
  }

  const sanitized = sanitizeString(displayName);

  if (sanitized.length < 2) {
    errors.push('Display name must be at least 2 characters');
  }

  if (sanitized.length > 50) {
    errors.push('Display name must be less than 50 characters');
  }

  if (sanitized !== displayName) {
    errors.push('Display name contains invalid characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Validates Firebase user ID format
 * @param {string} userId - User ID to validate
 * @returns {boolean} True if valid format
 */
export function isValidUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    return false;
  }

  // Firebase UIDs are alphanumeric and typically 28 characters
  // Allow some flexibility but ensure it's not obviously malicious
  const uidRegex = /^[a-zA-Z0-9]{20,128}$/;
  return uidRegex.test(userId);
}

/**
 * Sanitizes and validates event/match IDs
 * @param {string} id - Event or match ID
 * @returns {string|null} Sanitized ID or null if invalid
 */
export function sanitizeEventId(id) {
  if (!id || typeof id !== 'string') {
    return null;
  }

  // Event IDs should be alphanumeric with hyphens/underscores
  const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, '');

  if (sanitized.length < 1 || sanitized.length > 100) {
    return null;
  }

  return sanitized;
}
