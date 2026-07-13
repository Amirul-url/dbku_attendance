from django.urls import path

from .views import (
    AnalyticsReportView,
    AssignmentAttendanceCsvExportView,
    DashboardReportView,
    EventSummaryCsvExportView,
    EventSummaryReportView,
    PassportAttendanceCsvExportView,
    StaffAttendanceCsvExportView,
    VisitorAttendanceCsvExportView,
)

app_name = "reports"

urlpatterns = [
    path("reports/dashboard/", DashboardReportView.as_view(), name="dashboard-report"),
    path("reports/analytics/", AnalyticsReportView.as_view(), name="analytics-report"),
    path("reports/event-summary/", EventSummaryReportView.as_view(), name="event-summary-report"),
    path(
        "reports/events/<int:event_id>/export/assignment/",
        AssignmentAttendanceCsvExportView.as_view(),
        name="export-assignment-attendance",
    ),
    path(
        "reports/events/<int:event_id>/export/staff/",
        StaffAttendanceCsvExportView.as_view(),
        name="export-staff-attendance",
    ),
    path(
        "reports/events/<int:event_id>/export/visitor/",
        VisitorAttendanceCsvExportView.as_view(),
        name="export-visitor-attendance",
    ),
    path(
        "reports/events/<int:event_id>/export/passport/",
        PassportAttendanceCsvExportView.as_view(),
        name="export-passport-attendance",
    ),
    path(
        "reports/events/<int:event_id>/export/summary/",
        EventSummaryCsvExportView.as_view(),
        name="export-event-summary",
    ),
]
