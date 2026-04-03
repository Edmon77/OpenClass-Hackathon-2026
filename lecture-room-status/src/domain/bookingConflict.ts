export type Interval = { start: string; end: string };

/** True if intervals overlap (touching at boundary is NOT overlap). */
export function bookingsOverlap(a: Interval, b: Interval): boolean {
  const as = new Date(a.start).getTime();
  const ae = new Date(a.end).getTime();
  const bs = new Date(b.start).getTime();
  const be = new Date(b.end).getTime();
  return as < be && ae > bs;
}
