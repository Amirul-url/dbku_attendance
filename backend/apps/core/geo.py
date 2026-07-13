from rest_framework import serializers

from .utils import calculate_distance_meters


def validate_event_geofence(event, latitude, longitude):
    if latitude in (None, "") or longitude in (None, ""):
        raise serializers.ValidationError("Please enable GPS/location first.")
    if event.latitude is None or event.longitude is None:
        raise serializers.ValidationError("Event location not configured by admin.")

    distance = calculate_distance_meters(latitude, longitude, event.latitude, event.longitude)
    if distance > event.radius_meter:
        raise serializers.ValidationError(f"Attendance rejected. Outside allowed area ({round(distance, 2)}m).")
    return round(distance, 2)
