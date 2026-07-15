from rest_framework import serializers

from .event_state import validate_event_accepting_attendance
from .utils import calculate_distance_meters


def validate_event_geofence(event, latitude, longitude):
    validate_event_accepting_attendance(event)
    if latitude in (None, "") or longitude in (None, ""):
        raise serializers.ValidationError("Please enable GPS/location first.")
    if event.latitude is None or event.longitude is None:
        raise serializers.ValidationError("Event location not configured by admin.")

    distance = calculate_distance_meters(latitude, longitude, event.latitude, event.longitude)
    rounded_distance = round(distance, 2)
    if distance > event.radius_meter:
        raise serializers.ValidationError({
            "code": "outside_radius",
            "detail": "Attendance rejected. Your current location is outside the allowed event radius.",
            "latitude": str(latitude),
            "longitude": str(longitude),
            "distance_meter": rounded_distance,
            "radius_meter": event.radius_meter,
        })
    return rounded_distance
