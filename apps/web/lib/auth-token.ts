import { API_BASE_URL, apiFetch } from './api';

const AUTH_STATE_STORAGE_KEY = 'sdc_auth_state';

export function setAuthToken() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(AUTH_STATE_STORAGE_KEY, '1');
  window.sessionStorage.removeItem(AUTH_STATE_STORAGE_KEY);
}

export function clearAuthToken() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_STATE_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_STATE_STORAGE_KEY);

  void apiFetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    cache: 'no-store'
  }).catch(() => {
    // Best-effort cookie cleanup; local auth marker has already been cleared.
  });
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    window.localStorage.getItem(AUTH_STATE_STORAGE_KEY) ??
    window.sessionStorage.getItem(AUTH_STATE_STORAGE_KEY)
  );
}
