import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
// Setup file for Vitest - imports are used by the test framework
// eslint-disable-next-line no-unused-vars
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
