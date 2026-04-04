import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Layout } from '@/components/Layout';
import { RequireAdmin } from '@/components/RequireAdmin';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardHome } from '@/pages/DashboardHome';
import { AssistantPage } from '@/pages/AssistantPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { PolicyPage } from '@/pages/PolicyPage';
import { CampusPage } from '@/pages/CampusPage';
import { CampusBuildingPage } from '@/pages/CampusBuildingPage';
import { CampusRoomPage } from '@/pages/CampusRoomPage';
import { BookingsPage } from '@/pages/BookingsPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { CrSetupPage } from '@/pages/CrSetupPage';
import { UsersPage } from '@/pages/UsersPage';
import { BuildingsRoomsPage } from '@/pages/BuildingsRoomsPage';
import { CatalogPage } from '@/pages/CatalogPage';
import { CourseOfferingsPage } from '@/pages/CourseOfferingsPage';
import { CoursesPage } from '@/pages/CoursesPage';
import { SemestersPage } from '@/pages/SemestersPage';
import { CrAssignmentsPage } from '@/pages/CrAssignmentsPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return <div className="flex min-h-[40vh] items-center justify-center text-app-muted">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="policy" element={<PolicyPage />} />
        <Route path="campus" element={<CampusPage />} />
        <Route path="campus/building/:id" element={<CampusBuildingPage />} />
        <Route path="campus/room/:roomId" element={<CampusRoomPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="cr-setup" element={<CrSetupPage />} />

        <Route
          path="users"
          element={
            <RequireAdmin>
              <UsersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="buildings-rooms"
          element={
            <RequireAdmin>
              <BuildingsRoomsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="catalog"
          element={
            <RequireAdmin>
              <CatalogPage />
            </RequireAdmin>
          }
        />
        <Route
          path="course-offerings"
          element={
            <RequireAdmin>
              <CourseOfferingsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="courses"
          element={
            <RequireAdmin>
              <CoursesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="semesters"
          element={
            <RequireAdmin>
              <SemestersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="cr-assignments"
          element={
            <RequireAdmin>
              <CrAssignmentsPage />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
