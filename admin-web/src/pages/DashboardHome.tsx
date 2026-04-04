import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { PageHeader, PageSection, Card } from '@/components/ui';
import clsx from 'clsx';

type TileTone = 'accent' | 'campus' | 'neutral';

type Tile = {
  to: string;
  title: string;
  desc: string;
  tone: TileTone;
  glyph: string;
};

const campusTiles: Tile[] = [
  {
    to: '/assistant',
    title: 'Assistant',
    desc: 'Ask questions and confirm actions — same AI flow as the app.',
    tone: 'accent',
    glyph: 'AI',
  },
  {
    to: '/notifications',
    title: 'Notifications',
    desc: 'School messages, mark read, or clear all.',
    tone: 'campus',
    glyph: 'NT',
  },
  {
    to: '/policy',
    title: 'Policy',
    desc: 'Booking cutoff and reminder rules.',
    tone: 'neutral',
    glyph: 'PL',
  },
  {
    to: '/campus',
    title: 'Campus & rooms',
    desc: 'Browse buildings and search rooms to book.',
    tone: 'campus',
    glyph: 'RM',
  },
  {
    to: '/bookings',
    title: 'My bookings',
    desc: 'Your reserved rooms and slots.',
    tone: 'accent',
    glyph: 'BK',
  },
  {
    to: '/schedule',
    title: 'Schedule',
    desc: 'Classes and bookings in one place.',
    tone: 'neutral',
    glyph: 'SC',
  },
  {
    to: '/cr-setup',
    title: 'Class rep setup',
    desc: 'Manage cohort courses, teachers, and sections.',
    tone: 'campus',
    glyph: 'CR',
  },
];

const adminTiles: Tile[] = [
  {
    to: '/users',
    title: 'Users',
    desc: 'Accounts, faculties, bulk import.',
    tone: 'accent',
    glyph: 'US',
  },
  {
    to: '/buildings-rooms',
    title: 'Buildings & rooms',
    desc: 'Campus structure and room records.',
    tone: 'campus',
    glyph: 'BR',
  },
  {
    to: '/catalog',
    title: 'Course catalog',
    desc: 'Master course list.',
    tone: 'neutral',
    glyph: 'CA',
  },
  {
    to: '/course-offerings',
    title: 'Course offerings',
    desc: 'Offerings by year and department.',
    tone: 'accent',
    glyph: 'OF',
  },
  {
    to: '/courses',
    title: 'Courses (quick)',
    desc: 'Create catalog entry and offering together.',
    tone: 'campus',
    glyph: 'CQ',
  },
  {
    to: '/semesters',
    title: 'Academic years',
    desc: 'Open, activate, and close years.',
    tone: 'neutral',
    glyph: 'AY',
  },
  {
    to: '/cr-assignments',
    title: 'CR assignments',
    desc: 'Assign class representatives.',
    tone: 'campus',
    glyph: 'RA',
  },
];

function TileGlyph({ tone, glyph }: { tone: TileTone; glyph: string }) {
  return (
    <div
      className={clsx(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[11px] font-bold leading-none tracking-tight',
        tone === 'accent' && 'bg-app-accent-muted text-app-accent',
        tone === 'campus' && 'bg-app-campus-muted text-app-campus',
        tone === 'neutral' && 'bg-app-fill text-app-muted'
      )}
      aria-hidden
    >
      {glyph}
    </div>
  );
}

function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((t) => (
        <Link key={t.to} to={t.to} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-app-page">
          <Card className="flex h-full gap-4 p-4 shadow-card transition group-hover:border-app-accent/30 group-hover:shadow-card-hover">
            <TileGlyph tone={t.tone} glyph={t.glyph} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-[15px] font-semibold text-app-label group-hover:text-app-accent">{t.title}</h3>
                <span className="shrink-0 text-app-subtle transition group-hover:text-app-accent" aria-hidden>
                  →
                </span>
              </div>
              <p className="mt-1 text-sm leading-snug text-app-muted">{t.desc}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function DashboardHome() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const first = user?.name?.trim().split(/\s+/)[0] ?? 'there';

  return (
    <div className="space-y-10">
      <PageHeader
        title="Overview"
        subtitle="Pick a tool below. Navigation matches the mobile app; admin-only sections appear when you sign in as an administrator."
      />

      <Card className="border-app-campus/15 bg-gradient-to-br from-app-campus-muted/40 to-app-card p-5 shadow-card sm:p-6">
        <p className="text-sm font-medium text-app-campus">Welcome back</p>
        <p className="mt-1 font-display text-xl font-semibold text-app-label">Hi, {first}</p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-app-muted">
          Use the sidebar to jump anywhere. On your phone, open the menu to see the same links.
        </p>
      </Card>

      <PageSection title="Campus" description="Available to every signed-in user.">
        <div className="rounded-2xl bg-app-secondary p-2 ring-1 ring-black/[0.04]">
          <TileGrid tiles={campusTiles} />
        </div>
      </PageSection>

      {isAdmin && (
        <PageSection title="Administration" description="Visible only to users with the admin role.">
          <div className="rounded-2xl bg-app-secondary p-2 ring-1 ring-black/[0.04]">
            <TileGrid tiles={adminTiles} />
          </div>
        </PageSection>
      )}
    </div>
  );
}
