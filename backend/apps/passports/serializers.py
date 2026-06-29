from rest_framework import serializers

from apps.core.services import validate_event_geofence

from .models import PassportAttendance, PassportVisitor


class PassportVisitorSerializer(serializers.ModelSerializer):
    class Meta:
        model = PassportVisitor
        fields = "__all__"

    def validate_passport_number(self, value):
        value = (value or "").strip().upper()
        if not value:
            raise serializers.ValidationError("Passport number cannot be empty.")
        return value


class PassportAttendanceSerializer(serializers.ModelSerializer):
    visitor_detail = PassportVisitorSerializer(source="passport_visitor", read_only=True)
    event_name = serializers.CharField(source="event.name", read_only=True)
    distance_meter = serializers.SerializerMethodField()

    class Meta:
        model = PassportAttendance
        fields = "__all__"

    def get_distance_meter(self, obj):
        return getattr(obj, "distance_meter", None)

    def validate(self, attrs):
        event = attrs.get("event", getattr(self.instance, "event", None))
        if event:
            attrs["distance_meter"] = validate_event_geofence(event, attrs.get("latitude"), attrs.get("longitude"))
        return attrs

    def create(self, validated_data):
        distance_meter = validated_data.pop("distance_meter", None)
        instance = super().create(validated_data)
        instance.distance_meter = distance_meter
        return instance
