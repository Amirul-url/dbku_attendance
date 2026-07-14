from rest_framework import serializers

from apps.core.geo import validate_event_geofence

from .models import PassportAttendance, PassportVisitor


IMMUTABLE_ATTENDANCE_FIELDS = {
    "date",
    "time",
    "ipv4_address",
    "ipv6_address",
    "latitude",
    "longitude",
}


def reject_immutable_attendance_updates(serializer):
    if serializer.instance is None:
        return
    attempted_fields = IMMUTABLE_ATTENDANCE_FIELDS.intersection(serializer.initial_data)
    if attempted_fields:
        raise serializers.ValidationError({
            field: "This field cannot be edited after attendance is submitted."
            for field in sorted(attempted_fields)
        })


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
        reject_immutable_attendance_updates(self)
        event = attrs.get("event", getattr(self.instance, "event", None))
        if event:
            latitude = attrs.get("latitude", getattr(self.instance, "latitude", None))
            longitude = attrs.get("longitude", getattr(self.instance, "longitude", None))
            attrs["distance_meter"] = validate_event_geofence(event, latitude, longitude)
        return attrs

    def create(self, validated_data):
        distance_meter = validated_data.pop("distance_meter", None)
        instance = super().create(validated_data)
        instance.distance_meter = distance_meter
        return instance

    def update(self, instance, validated_data):
        visitor_payload = self.initial_data.get("visitor_detail", {})
        if isinstance(visitor_payload, dict):
            visitor = instance.passport_visitor
            direct_fields = {
                "full_name",
                "passport_number",
                "country",
                "date_of_birth",
                "expiry_date",
                "gender",
                "ocr_raw_text",
                "image_quality_note",
                "status",
            }
            for field in direct_fields:
                if field in visitor_payload:
                    setattr(visitor, field, visitor_payload[field])

            extra_data = dict(visitor.extra_data or {})
            if isinstance(visitor_payload.get("extra_data"), dict):
                extra_data.update(visitor_payload["extra_data"])
            visitor.extra_data = extra_data
            visitor.save()

        distance_meter = validated_data.pop("distance_meter", None)
        instance = super().update(instance, validated_data)
        instance.distance_meter = distance_meter
        return instance
