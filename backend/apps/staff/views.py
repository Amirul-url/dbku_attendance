from django.db import transaction
from rest_framework.exceptions import PermissionDenied
from rest_framework.viewsets import ModelViewSet

from apps.core.notifications import notify_staff_registration_success
from apps.core.permissions import IsAdminOrReadOnly, is_superadmin

from .models import StaffMember
from .selectors import staff_member_list
from .serializers import StaffMemberSerializer


class StaffMemberViewSet(ModelViewSet):
    serializer_class = StaffMemberSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = staff_member_list(
            search=self.request.query_params.get("search"),
            department=self.request.query_params.get("department"),
        )
        if not is_superadmin(self.request.user):
            queryset = queryset.exclude(role=StaffMember.ROLE_SUPERADMIN).exclude(user__is_superuser=True)
        return queryset

    def _ensure_superadmin_record_can_be_changed(self, instance):
        if (instance.role == StaffMember.ROLE_SUPERADMIN or instance.user.is_superuser) and not is_superadmin(self.request.user):
            raise PermissionDenied("Only a superadmin can manage superadmin accounts.")

    def perform_create(self, serializer):
        staff = serializer.save()
        notify_staff_registration_success(staff)

    def perform_update(self, serializer):
        self._ensure_superadmin_record_can_be_changed(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_superadmin_record_can_be_changed(instance)
        user = instance.user
        with transaction.atomic():
            user.delete()
