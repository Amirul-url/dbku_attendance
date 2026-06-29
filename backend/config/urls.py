from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import EmailOrUsernameTokenObtainPairView
from apps.attendance.views import (
    AssignmentAttendanceViewSet,
    StaffAttendanceViewSet,
    VisitorViewSet,
    VisitorAttendanceViewSet,
)
from apps.events.views import EventAssignmentViewSet, EventViewSet
from apps.passports.views import PassportAttendanceViewSet, PassportVisitorViewSet
from apps.reports.views import (
    AssignmentAttendanceCsvExportView,
    AnalyticsReportView,
    DashboardReportView,
    EventSummaryCsvExportView,
    EventSummaryReportView,
    PassportAttendanceCsvExportView,
    StaffAttendanceCsvExportView,
    VisitorAttendanceCsvExportView,
)
from apps.staff.views import StaffMemberViewSet

router = DefaultRouter()
router.register("staff", StaffMemberViewSet, basename="staff")
router.register("events", EventViewSet, basename="events")
router.register("event-assignments", EventAssignmentViewSet, basename="event-assignments")
router.register("staff-attendance", StaffAttendanceViewSet, basename="staff-attendance")
router.register("visitors", VisitorViewSet, basename="visitors")
router.register("visitor-attendance", VisitorAttendanceViewSet, basename="visitor-attendance")
router.register("assignment-attendance", AssignmentAttendanceViewSet, basename="assignment-attendance")
router.register("passport-visitors", PassportVisitorViewSet, basename="passport-visitors")
router.register("passport-attendance", PassportAttendanceViewSet, basename="passport-attendance")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", EmailOrUsernameTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/reports/dashboard/", DashboardReportView.as_view(), name="dashboard-report"),
    path("api/reports/analytics/", AnalyticsReportView.as_view(), name="analytics-report"),
    path("api/reports/event-summary/", EventSummaryReportView.as_view(), name="event-summary-report"),
    path("api/reports/events/<int:event_id>/export/assignment/", AssignmentAttendanceCsvExportView.as_view(), name="export-assignment-attendance"),
    path("api/reports/events/<int:event_id>/export/staff/", StaffAttendanceCsvExportView.as_view(), name="export-staff-attendance"),
    path("api/reports/events/<int:event_id>/export/visitor/", VisitorAttendanceCsvExportView.as_view(), name="export-visitor-attendance"),
    path("api/reports/events/<int:event_id>/export/passport/", PassportAttendanceCsvExportView.as_view(), name="export-passport-attendance"),
    path("api/reports/events/<int:event_id>/export/summary/", EventSummaryCsvExportView.as_view(), name="export-event-summary"),
    path("api/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
