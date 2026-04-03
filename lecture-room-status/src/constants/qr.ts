/** QR payload format printed on room doors. */
export const QR_PREFIX = 'lecture-room://room/';

export function buildRoomQrPayload(roomId: string): string {
  return `${QR_PREFIX}${roomId}`;
}

export function parseRoomIdFromQr(data: string): string | null {
  const t = data.trim();
  if (t.startsWith(QR_PREFIX)) {
    const id = t.slice(QR_PREFIX.length).split(/[?\s]/)[0];
    return id || null;
  }
  return null;
}
