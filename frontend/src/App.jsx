import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell.jsx'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { AttendancePage } from './pages/AttendancePage.jsx'
import { ForgotPasswordPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { EventDetailPage } from './pages/EventDetailPage.jsx'
import { EventsPage } from './pages/EventsPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { PassportsPage } from './pages/PassportsPage.jsx'
import {
  AssignmentAttendanceFormPage,
  PassportAttendanceFormPage,
  StaffAttendanceFormPage,
  VisitorAttendanceFormPage,
} from './pages/PublicAttendanceFormPage.jsx'
import { ReportsPage } from './pages/ReportsPage.jsx'
import { StaffPage } from './pages/StaffPage.jsx'
import { SuperadminPage } from './pages/SuperadminPage.jsx'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/staff-attendance/:eventId" element={<StaffAttendanceFormPage />} />
      <Route path="/visitor-attendance/:eventId" element={<VisitorAttendanceFormPage />} />
      <Route path="/passport-attendance/:eventId" element={<PassportAttendanceFormPage />} />
      <Route path="/assignment-attendance/:assignmentId" element={<AssignmentAttendanceFormPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="superadmin" element={<SuperadminPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="analytics" element={<ReportsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="passports" element={<PassportsPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
    </Routes>
  )
}

export default App
