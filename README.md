# DBKU Attendance

Modern DBKU Attendance Management System built with:

- React.js + Vite for the frontend
- Python Django + Django REST Framework for the backend API
- PostgreSQL for database management

## Project Structure

```text
dbku_attendance/
  backend/
    config/                 Django project settings and root URL config
    apps/
      accounts/             Auth-facing API helpers
      staff/                Staff profile management
      events/               Events and event assignments
      attendance/           Staff, visitor, and assignment attendance
      passports/            Passport visitors and passport attendance
      reports/              Analytics/report endpoints
      core/                 Shared permissions, utilities, and services
    manage.py
    requirements.txt
    Dockerfile

  frontend/
    src/
      api/                  API client helpers
      components/           Reusable UI components
      hooks/                Shared React hooks
      pages/                Dashboard, staff, events, attendance, passports, reports
      state/                Auth context
    Dockerfile
    nginx.conf

  docker-compose.yml
```

## Local Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py makemigrations
python manage.py migrate
python manage.py seed_admin
python manage.py runserver
```

Update `backend/.env` before running migrations if your PostgreSQL credentials differ.

## Local Frontend Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

The frontend expects the backend API at `VITE_API_BASE_URL`, defaulting to:

```text
http://localhost:8000/api
```

## API Entry Points

- `POST /api/auth/token/`
- `POST /api/auth/token/refresh/`
- `GET /api/auth/me/`
- `POST /api/auth/register/manual/`
- `POST /api/auth/forgot-password/send-otp/`
- `POST /api/auth/forgot-password/verify-otp/`
- `POST /api/auth/reset-password/submit/`
- `/api/staff/`
- `/api/events/`
- `/api/event-assignments/`
- `GET /api/event-assignments/conflict-check/`
- `/api/staff-attendance/`
- `/api/visitors/`
- `/api/visitor-attendance/`
- `/api/passport-visitors/`
- `/api/passport-attendance/`
- `/api/reports/event-summary/`
- `/api/reports/events/<event_id>/export/summary/`
- `/api/reports/events/<event_id>/export/staff/`
- `/api/reports/events/<event_id>/export/visitor/`
- `/api/reports/events/<event_id>/export/passport/`
- `/api/reports/events/<event_id>/export/assignment/`

## Coolify Deployment Shape

Use three services:

1. PostgreSQL database service
2. Backend service from `backend/Dockerfile`
3. Frontend service from `frontend/Dockerfile`

Backend environment variables should include:

```text
SECRET_KEY
DEBUG=False
ALLOWED_HOSTS
CSRF_TRUSTED_ORIGINS
CORS_ALLOWED_ORIGINS
DB_NAME
DB_USER
DB_PASSWORD
DB_HOST
DB_PORT
BASE_APP_URL
MAPTILER_API_KEY
```

Frontend environment variables should include:

```text
VITE_API_BASE_URL=https://your-backend-domain/api
```

## Migration Notes From Prototype

This repository is a new React + DRF rebuild. The old Django-template project can still be used as a reference for:

- OCR pipeline
- QR generation
- Geofencing validation
- Existing UI workflow details

Those pieces should be moved into backend service modules and exposed through DRF endpoints as the rebuild continues.
