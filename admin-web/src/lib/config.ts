/** Base URL without trailing slash. In dev, defaults to Vite `/__api` proxy when unset. */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (import.meta.env.DEV && (raw === undefined || raw === '' || raw === '__proxy__')) {
    return '/__api';
  }
  if (!raw || raw === '') {
    if (import.meta.env.DEV) return '/__api';
    return '';
  }
  return String(raw).replace(/\/$/, '');
}

export function isApiConfigured(): boolean {
  return getApiBaseUrl().length > 0;
}
