from rest_framework.viewsets import ModelViewSet

from apps.core.notifications import notify_staff_registration_success
from apps.core.permissions import IsAdminOrReadOnly

from .selectors import staff_member_list
from .serializers import StaffMemberSerializer


class StaffMemberViewSet(ModelViewSet):
    serializer_class = StaffMemberSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        return staff_member_list(
            search=self.request.query_params.get("search"),
            department=self.request.query_params.get("department"),
        )

    def perform_create(self, serializer):
        staff = serializer.save()
        notify_staff_registration_success(staff)
