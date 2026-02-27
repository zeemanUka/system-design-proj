import { describe, expect, it } from 'vitest';
import { isPasswordStrong } from './password.util.js';

describe('isPasswordStrong', () => {
  it('accepts strong passwords', () => {
    expect(isPasswordStrong('system123')).toBe(true);
  });

  it('rejects weak passwords', () => {
    expect(isPasswordStrong('short')).toBe(false);
    expect(isPasswordStrong('allletters')).toBe(false);
    expect(isPasswordStrong('12345678')).toBe(false);
  });
});
