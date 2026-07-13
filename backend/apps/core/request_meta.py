from .utils import split_client_ips


def save_serializer_with_client_ips(serializer, request):
    ipv4, ipv6 = split_client_ips(request)
    return serializer.save(ipv4_address=ipv4, ipv6_address=ipv6)
