from rest_framework import serializers

from apps.core.qr import ensure_assignment_qr_code, ensure_event_qr_codes, generate_event_qr_codes

from .models import Event, EventAssignment


class EventSerializer(serializers.ModelSerializer):
    visitor_qr_url = serializers.SerializerMethodField()
    staff_qr_url = serializers.SerializerMethodField()
    passport_qr_url = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = "__all__"
        read_only_fields = (
            "visitor_qr_code",
            "staff_qr_code",
            "passport_qr_code",
            "created_at",
        )

    def get_visitor_qr_url(self, obj):
        ensure_event_qr_codes(obj)
        request = self.context.get("request")
        return request.build_absolute_uri(obj.visitor_qr_code.url) if request and obj.visitor_qr_code else ""

    def get_staff_qr_url(self, obj):
        ensure_event_qr_codes(obj)
        request = self.context.get("request")
        return request.build_absolute_uri(obj.staff_qr_code.url) if request and obj.staff_qr_code else ""

    def get_passport_qr_url(self, obj):
        ensure_event_qr_codes(obj)
        request = self.context.get("request")
        return request.build_absolute_uri(obj.passport_qr_code.url) if request and obj.passport_qr_code else ""

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        start_time = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(self.instance, "end_time", None))

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than start date."})
        if start_date and end_date and start_date == end_date and start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({"end_time": "End time must be later than start time."})
        return attrs

    def create(self, validated_data):
        event = super().create(validated_data)
        generate_event_qr_codes(event)
        return event

    def update(self, instance, validated_data):
        event = super().update(instance, validated_data)
        if not event.visitor_qr_code or not event.staff_qr_code or not event.passport_qr_code:
            generate_event_qr_codes(event)
        return event


class EventAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source="staff_member.full_name", read_only=True)
    event_name = serializers.CharField(source="event.name", read_only=True)
    qr_url = serializers.SerializerMethodField()

    class Meta:
        model = EventAssignment
        fields = "__all__"

    def get_qr_url(self, obj):
        ensure_assignment_qr_code(obj)
        request = self.context.get("request")
        return request.build_absolute_uri(obj.qr_code.url) if request and obj.qr_code else ""
