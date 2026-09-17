import { randomInt } from 'node:crypto';

/**
 * Generates a unique 12-digit bank account number.
 * Example: 100084729103
 */
export const generateAccountNumber = () => {
  const prefix = '1000';
  let randomPart = '';
  for (let i = 0; i < 8; i++) {
    randomPart += randomInt(0, 10).toString();
  }
  return `${prefix}${randomPart}`;
};
