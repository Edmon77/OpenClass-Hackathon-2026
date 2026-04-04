import type { SVGProps } from 'react';

function iconClass(cls?: string) {
  return ['h-5 w-5 shrink-0', cls].filter(Boolean).join(' ');
}

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChat(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 0 1-4-.8L3 21l1.6-4.2A7.96 7.96 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path d="M14.5 18a2.5 2.5 0 1 1-5 0h5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconDoc(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M8 13h8M8 17h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMap(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path d="M9 18 3 15V4l6 3 6-3 6 3v11l-6 3-6-3-6 3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 18 6-3V3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 3v4M8 3v4M3 11h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7v6l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBuilding(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path d="M4 21V8l8-4v17M4 13h8M12 4l8 4v13M12 11h8M12 15h8M12 19h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLayers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path d="m12.83 2.18 8 3.5a1 1 0 0 1 0 1.84l-8 3.5a2 2 0 0 1-1.66 0l-8-3.5a1 1 0 0 1 0-1.84l8-3.5a2 2 0 0 1 1.66 0Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.3 7.3 12 11l8.7-3.7M3.3 12 12 15.7l8.7-3.7M3.3 16.7 12 20.4l8.7-3.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPlusSquare(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path d="M4 22V4a1 1 0 0 1 1-1h14l-3 6 3 6H5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUserCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 8v6M22 11h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={iconClass(props.className)} aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
