from apps.core.request_meta import save_serializer_with_client_ips


def save_attendance_with_client_ips(serializer, request):
    return save_serializer_with_client_ips(serializer, request)
