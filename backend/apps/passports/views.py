from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.viewsets import ModelViewSet

from apps.core.permissions import CanManageEvents
from apps.core.notifications import notify_attendance_success
from apps.core.request_meta import save_serializer_with_client_ips

from .models import PassportVisitor
from .selectors import passport_attendance_list
from .serializers import PassportAttendanceSerializer, PassportVisitorSerializer
from .services import process_passport_upload, submit_passport_attendance


class PassportVisitorViewSet(ModelViewSet):
    serializer_class = PassportVisitorSerializer
    permission_classes = [CanManageEvents]
    queryset = PassportVisitor.objects.all()

    def get_permissions(self):
        if self.action in {"create", "ocr_preview"}:
            return [AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=["post"], url_path="ocr-preview")
    def ocr_preview(self, request):
        image = request.FILES.get("image")
        if not image:
            return Response({"error": "Please choose a passport image first."}, status=400)
        try:
            return Response(process_passport_upload(image))
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)


class PassportAttendanceViewSet(ModelViewSet):
    serializer_class = PassportAttendanceSerializer
    permission_classes = [CanManageEvents]

    def get_queryset(self):
        return passport_attendance_list(event_id=self.request.query_params.get("event"))

    def get_permissions(self):
        if self.action in {"create", "submit"}:
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        attendance = save_serializer_with_client_ips(serializer, self.request)
        notify_attendance_success(attendance)

    @action(detail=False, methods=["post"], url_path="submit")
    def submit(self, request):
        attendance = submit_passport_attendance(request.data, request)
        notify_attendance_success(attendance)
        serializer = self.get_serializer(attendance)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
