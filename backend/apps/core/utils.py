import ipaddress
import math


def calculate_distance_meters(lat1, lon1, lat2, lon2):
    radius = 6371000
    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    delta_phi = math.radians(float(lat2) - float(lat1))
    delta_lambda = math.radians(float(lon2) - float(lon1))

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def split_client_ips(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    candidates = [item.strip() for item in forwarded_for.split(",") if item.strip()]
    remote_addr = request.META.get("REMOTE_ADDR")
    if remote_addr:
        candidates.append(remote_addr)

    ipv4_address = None
    ipv6_address = None

    for candidate in candidates:
        try:
            ip_value = ipaddress.ip_address(candidate)
        except ValueError:
            continue

        if ip_value.version == 4 and not ipv4_address:
            ipv4_address = str(ip_value)
        if ip_value.version == 6 and not ipv6_address:
            ipv6_address = str(ip_value)

    return ipv4_address, ipv6_address
