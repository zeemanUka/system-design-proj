import { describe, expect, it } from 'vitest';
import { isPasswordStrong } from './password.util.js';

describe('isPasswordStrong', () => {
  it('accepts strong passwords', () => {
    expect(isPasswordStrong('SystemDesign#2026')).toBe(true);
  });

  it('rejects weak passwords', () => {
    expect(isPasswordStrong('short')).toBe(false);
    expect(isPasswordStrong('alllettersonly')).toBe(false);
    expect(isPasswordStrong('ALLLETTERS1234')).toBe(false);
    expect(isPasswordStrong('NoSymbols1234')).toBe(false);
    expect(isPasswordStrong('12345678')).toBe(false);
    expect(isPasswordStrong('Password123!')).toBe(false);
  });
});
