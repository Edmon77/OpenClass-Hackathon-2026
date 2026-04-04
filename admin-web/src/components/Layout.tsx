import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { shellTitleForPath } from '@/lib/routeTitle';
import { Button, Card, Input, Label } from '@/components/ui';
import {
  IconBell,
  IconBook,
  IconBuilding,
  IconCalendar,
  IconChat,
  IconClock,
  IconDoc,
  IconFlag,
  IconHome,
  IconLayers,
  IconMap,
  IconMenu,
  IconPlusSquare,
  IconUserCheck,
  IconUsers,
} from '@/components/NavIcons';
import clsx from 'clsx';
import type { ComponentType } from 'react';

type NavItem = { to: string; label: string; end?: boolean; Icon: ComponentType<{ className?: string }> };

const campusNav: NavItem[] = [
  { to: '/', label: 'Overview', end: true, Icon: IconHome },
  { to: '/assistant', label: 'Assistant', Icon: IconChat },
  { to: '/notifications', label: 'Notifications', Icon: IconBell },
  { to: '/policy', label: 'Policy', Icon: IconDoc },
  { to: '/campus', label: 'Campus & rooms', Icon: IconMap },
  { to: '/bookings', label: 'My bookings', Icon: IconCalendar },
  { to: '/schedule', label: 'Schedule', Icon: IconClock },
  { to: '/cr-setup', label: 'Class rep setup', Icon: IconLayers },
];

const adminNav: NavItem[] = [
  { to: '/users', label: 'Users', Icon: IconUsers },
  { to: '/buildings-rooms', label: 'Buildings & rooms', Icon: IconBuilding },
  { to: '/catalog', label: 'Course catalog', Icon: IconBook },
  { to: '/course-offerings', label: 'Course offerings', Icon: IconLayers },
  { to: '/courses', label: 'Courses (quick)', Icon: IconPlusSquare },
  { to: '/semesters', label: 'Academic years', Icon: IconFlag },
  { to: '/cr-assignments', label: 'CR assignments', Icon: IconUserCheck },
];

function NavGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-app-subtle">{title}</p>
      <div className="space-y-0.5 rounded-2xl bg-app-secondary p-1.5 ring-1 ring-black/[0.04]">{children}</div>
    </div>
  );
}

function NavItems({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[14px] font-medium leading-snug transition-colors',
              isActive
                ? 'bg-app-card text-app-label shadow-sm ring-1 ring-black/[0.06]'
                : 'text-app-muted hover:bg-app-card/80 hover:text-app-label'
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.Icon className={clsx(isActive ? 'text-app-accent' : 'text-app-subtle')} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </>
  );
}

export function Layout() {
  const { user, logout, changePassword } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const shellTitle = useMemo(() => shellTitleForPath(location.pathname), [location.pathname]);

  const initial = useMemo(() => {
    const n = user?.name?.trim();
    if (!n) return '?';
    return n.charAt(0).toUpperCase();
  }, [user?.name]);

  async function onChangePw(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await changePassword(newPw);
      setNewPw('');
      setPwOpen(false);
      toast.success('Password updated');
    } catch (err) {
      toast.error(String(err));
    }
  }

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-app-page lg:flex">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-app-overlay lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,17.5rem)] flex-col border-r border-app-separator bg-app-card shadow-[4px_0_24px_rgba(0,0,0,0.04)] lg:static lg:z-0 lg:w-72 lg:shrink-0 lg:shadow-none',
          'transform transition-transform duration-200 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-[3.75rem] shrink-0 items-center gap-3 border-b border-app-separator px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-campus text-base font-display font-bold text-white shadow-sm">
            C
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-semibold text-app-label">Campus</div>
            <div className="text-xs text-app-subtle">Web console</div>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-3 py-4">
          <NavGroup title="Campus">
            <NavItems items={campusNav} onNavigate={closeSidebar} />
          </NavGroup>
          {user?.role === 'admin' && (
            <NavGroup title="Administration">
              <NavItems items={adminNav} onNavigate={closeSidebar} />
            </NavGroup>
          )}
        </nav>

        <div className="shrink-0 border-t border-app-separator bg-app-secondary/40 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-campus-muted text-sm font-semibold text-app-campus"
              aria-hidden
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-app-label">{user?.name ?? '—'}</div>
              <div className="truncate text-xs text-app-subtle">{user?.student_id ?? ''}</div>
            </div>
          </div>
          {user?.role && (
            <div className="mb-3">
              <span className="inline-flex rounded-md bg-app-fill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-app-muted">
                {user.role}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button variant="secondary" className="w-full justify-center text-sm" onClick={() => setPwOpen(true)}>
              Change password
            </Button>
            <Button variant="ghost" className="w-full justify-center text-sm text-app-muted" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-app-separator bg-app-card/95 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-app-card/80 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-app-separator bg-app-secondary text-app-label transition active:scale-[0.98]"
            aria-label="Open menu"
          >
            <IconMenu />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-app-subtle">Campus console</p>
            <h1 className="truncate font-display text-base font-semibold leading-tight text-app-label">{shellTitle}</h1>
          </div>
        </header>

        {user?.force_password_change && (
          <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <span>You must change your password before continuing.</span>
            <Button variant="secondary" className="shrink-0 px-4 py-2 text-sm" onClick={() => setPwOpen(true)}>
              Change now
            </Button>
          </div>
        )}

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="dash-content">
            <Outlet />
          </div>
        </main>
      </div>

      {pwOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-app-overlay p-4">
          <Card className="w-full max-w-md p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold text-app-label">New password</h2>
            <form onSubmit={onChangePw} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="npw">Password (min 6 characters)</Label>
                <Input
                  id="npw"
                  type="password"
                  autoComplete="new-password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Save</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPwOpen(false);
                    setNewPw('');
                  }}
                >
                  {user?.force_password_change ? 'Later' : 'Cancel'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
