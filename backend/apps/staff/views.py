from rest_framework.viewsets import ModelViewSet

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
