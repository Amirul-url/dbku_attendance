from rest_framework.viewsets import ModelViewSet

from apps.core.permissions import IsAdminOrReadOnly

from .models import StaffMember
from .serializers import StaffMemberSerializer


class StaffMemberViewSet(ModelViewSet):
    serializer_class = StaffMemberSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = StaffMember.objects.select_related("user").all()
        search = self.request.query_params.get("search")
        department = self.request.query_params.get("department")

        if search:
            queryset = queryset.filter(full_name__icontains=search)
        if department:
            queryset = queryset.filter(department__icontains=department)

        return queryset
