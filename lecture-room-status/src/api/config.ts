/** Set in `.env` as EXPO_PUBLIC_API_URL (e.g. http://192.168.1.5:3000 or https://api.yourdomain.com) */
export function getApiBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
}

export function isApiConfigured(): boolean {
  return getApiBaseUrl().length > 0;
}
