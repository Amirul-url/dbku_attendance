from io import BytesIO

import qrcode
from django.conf import settings
from django.core.files.base import ContentFile
from rest_framework import serializers

from .utils import calculate_distance_meters


def public_url(path):
    return f"{settings.BASE_APP_URL}/{path.lstrip('/')}"


def save_qr_image(instance, field_name, filename, url):
    image = qrcode.make(url)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    getattr(instance, field_name).save(filename, ContentFile(buffer.getvalue()), save=False)


def generate_event_qr_codes(event):
    configs = [
        ("visitor_qr_code", f"visitor_event_{event.id}.png", public_url(f"visitor-attendance/{event.id}")),
        ("staff_qr_code", f"staff_event_{event.id}.png", public_url(f"staff-attendance/{event.id}")),
        ("passport_qr_code", f"passport_event_{event.id}.png", public_url(f"passport-attendance/{event.id}")),
    ]
    update_fields = []
    for field_name, filename, url in configs:
        save_qr_image(event, field_name, filename, url)
        update_fields.append(field_name)
    event.save(update_fields=update_fields)


def generate_assignment_qr_code(assignment):
    save_qr_image(
        assignment,
        "qr_code",
        f"assignment_{assignment.id}.png",
        public_url(f"assignment-attendance/{assignment.id}"),
    )
    assignment.save(update_fields=["qr_code"])


def validate_event_geofence(event, latitude, longitude):
    if latitude in (None, "") or longitude in (None, ""):
        raise serializers.ValidationError("Please enable GPS/location first.")
    if event.latitude is None or event.longitude is None:
        raise serializers.ValidationError("Event location not configured by admin.")

    distance = calculate_distance_meters(latitude, longitude, event.latitude, event.longitude)
    if distance > event.radius_meter:
        raise serializers.ValidationError(f"Attendance rejected. Outside allowed area ({round(distance, 2)}m).")
    return round(distance, 2)
