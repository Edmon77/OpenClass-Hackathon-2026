/** Display timezone per system documentation */
export const DISPLAY_TIMEZONE = 'Africa/Addis_Ababa';

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: DISPLAY_TIMEZONE,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function addMinutes(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export function minutesBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}
