import { randomBytes } from 'node:crypto';

/**
 * Generates a unique, audit-compliant transfer reference ID.
 * Format: REF-YYYYMMDD-XXXXXX (e.g. REF-20260915-A4F92C)
 */
export const generateReferenceId = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = randomBytes(3).toString('hex').toUpperCase();
  return `REF-${dateStr}-${randomSuffix}`;
};
