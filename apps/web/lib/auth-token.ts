export function setAuthToken(token: string) {
  document.cookie = `auth_token=${token}; path=/; max-age=604800; samesite=lax`;
}

export function clearAuthToken() {
  document.cookie = 'auth_token=; path=/; max-age=0; samesite=lax';
}

export function getAuthToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie
    .split('; ')
    .find((cookieValue) => cookieValue.startsWith('auth_token='));

  return match ? decodeURIComponent(match.split('=')[1]) : null;
}
