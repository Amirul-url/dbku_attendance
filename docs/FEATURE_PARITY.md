# Feature Parity Checklist

Source of truth: `D:\dbku-attendance-management-system`

Target architecture: React + Vite frontend, Django REST Framework backend, PostgreSQL database.

This project must duplicate the old monolithic DBKU Attendance Management System without dropping workflows. A feature is only complete when the frontend screen, backend API, database behavior, validation, permissions, and deployment behavior match the old system.

## Status Legend

- `Done` - implemented and verified in the new stack
- `Partial` - scaffolded or visually started, but missing workflow details
- `Missing` - not implemented yet

## Core Architecture

| Feature | Old monolith source | New location | Status |
| --- | --- | --- | --- |
| DBKU logo and ocean sidebar layout | `templates/base.html`, `static/logo.png` | `frontend/public/logo.png`, `frontend/src/components/AppShell.jsx` | Done |
| Topbar user identity and role display | `templates/base.html` | `frontend/src/components/AppShell.jsx`, `GET /api/auth/me/` | Partial |
| Role-aware navigation | `role_context`, `require_*` helpers | `apps/core/permissions.py`, React route guards | Partial |
| Docker/Coolify deployment | `Dockerfile` | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` | Partial |

## Authentication

| Feature | Old monolith source | New location | Status |
| --- | --- | --- | --- |
| Login page visual design | `templates/auth/login.html` | `frontend/src/pages/LoginPage.jsx` | Partial |
| Login API | `login_user` | `POST /api/auth/token/` | Partial |
| Current user/profile API | session context | `GET /api/auth/me/` | Partial |
| Logout | `logout_user` | frontend JWT clear | Partial |
| Manual registration page | `templates/auth/register.html` | `frontend/src/pages/AuthPages.jsx` | Partial |
| Manual registration API | `register_manual` | `POST /api/auth/register/manual/` | Partial |
| Forgot password page | `templates/auth/forgot_password.html` | `frontend/src/pages/AuthPages.jsx` | Partial |
| Send OTP | `send_forgot_password_otp` | `POST /api/auth/forgot-password/send-otp/` | Partial |
| Verify OTP | `verify_forgot_password_otp` | `POST /api/auth/forgot-password/verify-otp/` | Partial |
| Reset password page | `templates/auth/reset_password.html` | `frontend/src/pages/AuthPages.jsx` | Partial |
| Reset password submit | `reset_password_submit` | `POST /api/auth/reset-password/submit/` | Partial |

## Dashboard And Analytics

| Feature | Old monolith source | New location | Status |
| --- | --- | --- | --- |
| Dashboard page layout | `templates/dashboard/index.html` | `frontend/src/pages/DashboardPage.jsx` | Partial |
| Staff/event/attendance summary counts | `dashboard` | `/api/reports/event-summary/` | Partial |
| Charts and trend data | `dashboard`, `analytics_page` | `GET /api/reports/dashboard/`, `GET /api/reports/analytics/` | Partial |
| Analytics page | `templates/reports/analytics.html` | `frontend/src/pages/ReportsPage.jsx` | Partial |
| Event summary CSV export | `export_event_summary_csv` | `GET /api/reports/events/:id/export/summary/` | Partial |

## Staff Management

| Feature | Old monolith source | New location | Status |
| --- | --- | --- | --- |
| Staff list page | `templates/staff/list.html` | `frontend/src/pages/StaffPage.jsx` | Partial |
| Staff search and department filter | `staff_page` | `GET /api/staff/?search=&department=` | Partial |
| Add staff modal | `templates/staff/list.html` | `frontend/src/pages/StaffPage.jsx` | Done |
| Add staff API | `add_staff` | `POST /api/staff/` | Partial |
| Edit staff modal | `templates/staff/list.html` | `frontend/src/pages/StaffPage.jsx` | Done |
| Edit staff API | `update_staff` | `PATCH /api/staff/:id/` | Partial |
| Delete staff action | `delete_staff` | `DELETE /api/staff/:id/` | Partial |
| Staff role badges | `templates/staff/list.html` | `frontend/src/pages/StaffPage.jsx` | Done |
| Registration method badges | `templates/staff/list.html` | `frontend/src/pages/StaffPage.jsx` | Done |

## Events

| Feature | Old monolith source | New location | Status |
| --- | --- | --- | --- |
| Event list page | `templates/events/list.html` | `frontend/src/pages/EventsPage.jsx` | Partial |
| Create event modal | `templates/events/list.html` | `frontend/src/pages/EventsPage.jsx` | Done |
| Create event API | `create_event` | `POST /api/events/` | Partial |
| Edit event modal | `templates/events/list.html` | `frontend/src/pages/EventsPage.jsx` | Done |
| Edit event API | `update_event` | `PATCH /api/events/:id/` | Partial |
| Delete event action | `delete_event` | `DELETE /api/events/:id/` | Partial |
| QR generation for staff/visitor/passport forms | `create_event`, `update_event` | `apps/core/services.py`, `apps/events/serializers.py` | Done |
| Event detail page | `templates/events/detail.html` | `frontend/src/pages/EventDetailPage.jsx` | Partial |
| Event detail attendance tabs | `event_detail` | React components and APIs needed | Missing |

## Attendance Forms

| Feature | Old monolith source | New location | Status |
| --- | --- | --- | --- |
| Staff attendance public form | `templates/attendance/staff_form.html` | `frontend/src/pages/PublicAttendanceFormPage.jsx` | Partial |
| Staff attendance submit | `submit_staff_attendance` | `POST /api/staff-attendance/` | Partial |
| Visitor attendance public form | `templates/attendance/visitor_form.html` | `frontend/src/pages/PublicAttendanceFormPage.jsx` | Partial |
| Visitor attendance submit | `submit_visitor_attendance` | `POST /api/visitor-attendance/` | Partial |
| Assignment attendance public form | `templates/attendance/assignment_form.html` | `frontend/src/pages/PublicAttendanceFormPage.jsx` | Partial |
| Assignment attendance submit | `submit_assignment_attendance` | `POST /api/assignment-attendance/` | Partial |
| Geolocation capture | attendance templates | `frontend/src/pages/PublicAttendanceFormPage.jsx` | Done |
| Geofencing validation | `calculate_distance_meters`, submit views | `apps/core/services.py`, attendance/passport serializers | Done |
| Duplicate attendance prevention | model constraints and submit views | DRF validation/messages needed | Partial |
| IP address capture | `get_client_ips` | `apps/core/utils.py` | Partial |

## Passport OCR

| Feature | Old monolith source | New location | Status |
| --- | --- | --- | --- |
| Passport attendance page | `templates/passports/attendance_form.html` | `frontend/src/pages/PublicAttendanceFormPage.jsx` | Partial |
| Passport image upload | `upload_passport` | `/api/passport-visitors/ocr-preview/`, public passport form | Partial |
| OCR preprocessing | `preprocess_passport_image` | `apps/passports/services.py` | Partial |
| PaddleOCR retry variants | `run_paddleocr_retry_variants` | backend service needed | Missing |
| MRZ parsing | passport helper functions | `apps/passports/services.py` | Partial |
| Passport validation and correction UI | passport template | public passport form editable OCR fields | Partial |
| Passport attendance submit | `submit_passport_attendance` | `POST /api/passport-attendance/` | Partial |
| Additional fields parsing | passport helpers | backend service needed | Missing |

## Event Assignments

| Feature | Old monolith source | New location | Status |
| --- | --- | --- | --- |
| Assignment list in event detail | `templates/events/detail.html` | `frontend/src/pages/EventDetailPage.jsx` | Done |
| Assignment create/update/delete | assignment views | `/api/event-assignments/`, `frontend/src/pages/EventDetailPage.jsx` | Done |
| Assignment conflict check | `check_event_assignment_conflict` | `GET /api/event-assignments/conflict-check/` | Partial |
| Assignment QR generation | `generate_assignment_qr` | `apps/core/services.py`, `apps/events/views.py` | Done |
| Assignment attendance link | assignment views | `frontend/src/pages/PublicAttendanceFormPage.jsx` | Done |

## Exports

| Feature | Old monolith source | New location | Status |
| --- | --- | --- | --- |
| Staff attendance CSV export | `export_staff_attendance_csv` | `GET /api/reports/events/:id/export/staff/` | Partial |
| Visitor attendance CSV export | `export_visitor_attendance_csv` | `GET /api/reports/events/:id/export/visitor/` | Partial |
| Passport attendance CSV export | `export_passport_attendance_csv` | `GET /api/reports/events/:id/export/passport/` | Partial |
| Assignment attendance CSV export | `export_assignment_attendance_csv` | `GET /api/reports/events/:id/export/assignment/` | Partial |
| Event summary CSV export | `export_event_summary_csv` | `GET /api/reports/events/:id/export/summary/` | Partial |

## Database Model Parity

| Old model | New model | Status |
| --- | --- | --- |
| `Employee` | `staff.StaffMember` | Partial |
| `Event` | `events.Event` | Partial |
| `Attendance` | `attendance.StaffAttendance` | Partial |
| `Visitor` | `attendance.Visitor` | Partial |
| `VisitorAttendance` | `attendance.VisitorAttendance` | Partial |
| `PassportVisitor` | `passports.PassportVisitor` | Partial |
| `PassportAttendance` | `passports.PassportAttendance` | Partial |
| `EventAssignment` | `events.EventAssignment` | Partial |
| `AssignmentAttendance` | `attendance.AssignmentAttendance` | Partial |

## Immediate Next Build Order

1. Add full event detail tab filtering/pagination parity.
2. Port PaddleOCR retry variants for stronger passport extraction.
3. Add richer passport additional-fields editor parity.
4. Complete export parity QA against production CSV samples.
5. Final UI polish against every old template.
