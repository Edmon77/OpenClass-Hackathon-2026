/** Short label for shell chrome (mobile header); keep in sync with nav. */
export function shellTitleForPath(pathname: string): string {
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/') return 'Overview';
  if (p.startsWith('/campus/building/')) return 'Building';
  if (p.startsWith('/campus/room/')) return 'Room';
  const seg = p.split('/').filter(Boolean)[0] ?? '';
  const map: Record<string, string> = {
    assistant: 'Assistant',
    notifications: 'Notifications',
    policy: 'Policy',
    campus: 'Campus',
    bookings: 'Bookings',
    schedule: 'Schedule',
    'cr-setup': 'Class rep setup',
    users: 'Users',
    'buildings-rooms': 'Buildings',
    catalog: 'Catalog',
    'course-offerings': 'Offerings',
    courses: 'Courses',
    semesters: 'Academic years',
    'cr-assignments': 'CR assignments',
    login: 'Sign in',
  };
  return map[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
