from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import (
    build_analytics_report,
    build_dashboard_report,
    build_event_summary_report,
    export_assignment_attendance_csv,
    export_event_summary_csv,
    export_passport_attendance_csv,
    export_staff_attendance_csv,
    export_visitor_attendance_csv,
)


class EventSummaryReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(build_event_summary_report(event_id=request.query_params.get("event")))


class DashboardReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(build_dashboard_report())


class AnalyticsReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(build_analytics_report(request.query_params))


class BaseCsvExportView(APIView):
    permission_classes = [IsAuthenticated]


class StaffAttendanceCsvExportView(BaseCsvExportView):
    def get(self, request, event_id):
        return export_staff_attendance_csv(event_id)


class VisitorAttendanceCsvExportView(BaseCsvExportView):
    def get(self, request, event_id):
        return export_visitor_attendance_csv(event_id)


class PassportAttendanceCsvExportView(BaseCsvExportView):
    def get(self, request, event_id):
        return export_passport_attendance_csv(event_id)


class AssignmentAttendanceCsvExportView(BaseCsvExportView):
    def get(self, request, event_id):
        return export_assignment_attendance_csv(event_id)


class EventSummaryCsvExportView(BaseCsvExportView):
    def get(self, request, event_id):
        return export_event_summary_csv(event_id)
