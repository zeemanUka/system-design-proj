export function isPasswordStrong(password: string): boolean {
  if (password.length < 12) {
    return false;
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  if (!hasLower || !hasUpper || !hasNumber || !hasSymbol) {
    return false;
  }

  const commonPasswords = new Set([
    'password',
    'password1',
    'password123',
    'password123!',
    'qwerty',
    'qwerty123',
    'admin123',
    'letmein',
    'welcome1',
    'iloveyou',
    '12345678',
    '123456789',
    'abc12345',
    'changeme',
    'football1',
    'monkey123'
  ]);

  return !commonPasswords.has(password.toLowerCase());
}
