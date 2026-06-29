from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.permissions import CanManageEvents
from apps.core.services import generate_assignment_qr_code

from .models import Event, EventAssignment
from .serializers import EventAssignmentSerializer, EventSerializer


class EventViewSet(ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [CanManageEvents]

    def get_queryset(self):
        queryset = Event.objects.all()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    def get_permissions(self):
        if self.action == "retrieve":
            return [AllowAny()]
        return super().get_permissions()


class EventAssignmentViewSet(ModelViewSet):
    serializer_class = EventAssignmentSerializer
    permission_classes = [CanManageEvents]

    def get_queryset(self):
        queryset = EventAssignment.objects.select_related("event", "staff_member", "assigned_by")
        event_id = self.request.query_params.get("event")
        staff_id = self.request.query_params.get("staff")
        status = self.request.query_params.get("status")

        if event_id:
            queryset = queryset.filter(event_id=event_id)
        if staff_id:
            queryset = queryset.filter(staff_member_id=staff_id)
        if status:
            queryset = queryset.filter(assignment_status=status)

        return queryset

    def perform_create(self, serializer):
        assignment = serializer.save()
        generate_assignment_qr_code(assignment)

    def perform_update(self, serializer):
        assignment = serializer.save()
        if not assignment.qr_code:
            generate_assignment_qr_code(assignment)

    def get_permissions(self):
        if self.action == "retrieve":
            return [AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=["get"], url_path="conflict-check")
    def conflict_check(self, request):
        staff_id = request.query_params.get("staff")
        event_id = request.query_params.get("event")
        task_title = request.query_params.get("task_title", "").strip()
        assignment_id = request.query_params.get("assignment")

        conflicts = EventAssignment.objects.select_related("event", "staff_member")
        if staff_id:
            conflicts = conflicts.filter(staff_member_id=staff_id)
        if event_id:
            conflicts = conflicts.filter(event_id=event_id)
        if task_title:
            conflicts = conflicts.filter(task_title__iexact=task_title)
        if assignment_id:
            conflicts = conflicts.exclude(id=assignment_id)

        rows = [
            {
                "id": item.id,
                "event": item.event.name,
                "staff": item.staff_member.full_name,
                "task_title": item.task_title,
                "status": item.assignment_status,
            }
            for item in conflicts[:10]
        ]
        return Response(
            {
                "available": len(rows) == 0,
                "conflicts": rows,
                "message": "No assignment conflict found." if len(rows) == 0 else "Potential assignment conflict found.",
            }
        )
