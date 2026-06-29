from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import AllowAny

from apps.core.permissions import CanManageEvents
from apps.core.utils import split_client_ips

from .models import AssignmentAttendance, StaffAttendance, Visitor, VisitorAttendance
from .serializers import (
    AssignmentAttendanceSerializer,
    StaffAttendanceSerializer,
    VisitorAttendanceSerializer,
    VisitorSerializer,
)


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
        queryset = StaffAttendance.objects.select_related("event", "staff_member")
        event_id = self.request.query_params.get("event")
        if event_id:
            queryset = queryset.filter(event_id=event_id)
        return queryset

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        ipv4, ipv6 = split_client_ips(self.request)
        serializer.save(ipv4_address=ipv4, ipv6_address=ipv6)


class VisitorAttendanceViewSet(ModelViewSet):
    serializer_class = VisitorAttendanceSerializer
    permission_classes = [CanManageEvents]

    def get_queryset(self):
        queryset = VisitorAttendance.objects.select_related("event", "visitor")
        event_id = self.request.query_params.get("event")
        if event_id:
            queryset = queryset.filter(event_id=event_id)
        return queryset

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        ipv4, ipv6 = split_client_ips(self.request)
        serializer.save(ipv4_address=ipv4, ipv6_address=ipv6)


class AssignmentAttendanceViewSet(ModelViewSet):
    serializer_class = AssignmentAttendanceSerializer
    permission_classes = [CanManageEvents]

    def get_queryset(self):
        queryset = AssignmentAttendance.objects.select_related("assignment", "assignment__event")
        assignment_id = self.request.query_params.get("assignment")
        if assignment_id:
            queryset = queryset.filter(assignment_id=assignment_id)
        return queryset

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        ipv4, ipv6 = split_client_ips(self.request)
        serializer.save(ipv4_address=ipv4, ipv6_address=ipv6)
