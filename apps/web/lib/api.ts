export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? undefined);
  headers.delete('Authorization');

  return fetch(input, {
    ...init,
    credentials: init.credentials ?? 'include',
    headers
  });
}
