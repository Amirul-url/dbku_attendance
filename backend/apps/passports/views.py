from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.core.permissions import CanManageEvents
from apps.core.utils import split_client_ips

from .models import PassportAttendance, PassportVisitor
from .serializers import PassportAttendanceSerializer, PassportVisitorSerializer
from .services import process_passport_upload


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
        return Response(process_passport_upload(image))


class PassportAttendanceViewSet(ModelViewSet):
    serializer_class = PassportAttendanceSerializer
    permission_classes = [CanManageEvents]

    def get_queryset(self):
        queryset = PassportAttendance.objects.select_related("event", "passport_visitor")
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
