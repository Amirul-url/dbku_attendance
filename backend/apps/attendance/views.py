from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import AllowAny

from apps.core.permissions import CanManageEvents
from apps.events.models import EventAssignment

from .models import Visitor
from .selectors import assignment_attendance_list, staff_attendance_list, visitor_attendance_list
from .serializers import (
    AssignmentAttendanceSerializer,
    StaffAttendanceSerializer,
    VisitorAttendanceSerializer,
    VisitorSerializer,
)
from .services import save_attendance_with_client_ips


class VisitorViewSet(ModelViewSet):
    serializer_class = VisitorSerializer
    permission_classes = [CanManageEvents]
    queryset = Visitor.objects.all()

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return super().get_permissions()


class StaffAttendanceViewSet(ModelViewSet):
    serializer_class = StaffAttendanceSerializer
    permission_classes = [CanManageEvents]

    def get_queryset(self):
        return staff_attendance_list(event_id=self.request.query_params.get("event"))

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        save_attendance_with_client_ips(serializer, self.request)


class VisitorAttendanceViewSet(ModelViewSet):
    serializer_class = VisitorAttendanceSerializer
    permission_classes = [CanManageEvents]

    def get_queryset(self):
        return visitor_attendance_list(event_id=self.request.query_params.get("event"))

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        save_attendance_with_client_ips(serializer, self.request)


class AssignmentAttendanceViewSet(ModelViewSet):
    serializer_class = AssignmentAttendanceSerializer
    permission_classes = [CanManageEvents]

    def get_queryset(self):
        return assignment_attendance_list(assignment_id=self.request.query_params.get("assignment"))

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        attendance = save_attendance_with_client_ips(serializer, self.request)
        assignment = attendance.assignment
        if assignment.assignment_status == EventAssignment.STATUS_ASSIGNED:
            assignment.assignment_status = EventAssignment.STATUS_IN_PROGRESS
            assignment.save(update_fields=["assignment_status", "updated_at"])
