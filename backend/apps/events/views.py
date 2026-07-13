from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.permissions import CanManageEvents

from .selectors import assignment_conflicts, assignment_list, event_list
from .serializers import EventAssignmentSerializer, EventSerializer
from .services import ensure_assignment_qr_code, serialize_assignment_conflicts


class EventViewSet(ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [CanManageEvents]

    def get_queryset(self):
        return event_list(search=self.request.query_params.get("search"))

    def get_permissions(self):
        if self.action == "retrieve":
            return [AllowAny()]
        return super().get_permissions()


class EventAssignmentViewSet(ModelViewSet):
    serializer_class = EventAssignmentSerializer
    permission_classes = [CanManageEvents]

    def get_queryset(self):
        return assignment_list(
            event_id=self.request.query_params.get("event"),
            staff_id=self.request.query_params.get("staff"),
            status=self.request.query_params.get("status"),
        )

    def perform_create(self, serializer):
        assignment = serializer.save()
        ensure_assignment_qr_code(assignment)

    def perform_update(self, serializer):
        assignment = serializer.save()
        ensure_assignment_qr_code(assignment)

    def get_permissions(self):
        if self.action == "retrieve":
            return [AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=["get"], url_path="conflict-check")
    def conflict_check(self, request):
        conflicts = assignment_conflicts(
            staff_id=request.query_params.get("staff"),
            event_id=request.query_params.get("event"),
            task_title=request.query_params.get("task_title", "").strip(),
            assignment_id=request.query_params.get("assignment"),
        )
        return Response(serialize_assignment_conflicts(conflicts))
