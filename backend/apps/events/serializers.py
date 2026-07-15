from rest_framework import serializers

from apps.core.qr import ensure_assignment_qr_code, ensure_event_qr_codes, generate_event_qr_codes
from apps.staff.models import StaffMember

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
    staff_id = serializers.CharField(source="staff_member.staff_id", read_only=True)
    staff_email = serializers.EmailField(source="staff_member.email", read_only=True)
    staff_phone_number = serializers.CharField(source="staff_member.phone_number", read_only=True)
    staff_department = serializers.CharField(source="staff_member.department", read_only=True)
    event_name = serializers.CharField(source="event.name", read_only=True)
    event_location = serializers.CharField(source="event.location", read_only=True)
    event_start_date = serializers.DateField(source="event.start_date", read_only=True)
    event_end_date = serializers.DateField(source="event.end_date", read_only=True)
    event_start_time = serializers.TimeField(source="event.start_time", read_only=True)
    event_end_time = serializers.TimeField(source="event.end_time", read_only=True)
    event_description = serializers.CharField(source="event.description", read_only=True)
    event_latitude = serializers.DecimalField(source="event.latitude", max_digits=9, decimal_places=6, read_only=True)
    event_longitude = serializers.DecimalField(source="event.longitude", max_digits=9, decimal_places=6, read_only=True)
    event_radius_meter = serializers.IntegerField(source="event.radius_meter", read_only=True)
    qr_url = serializers.SerializerMethodField()

    class Meta:
        model = EventAssignment
        fields = "__all__"

    def get_qr_url(self, obj):
        ensure_assignment_qr_code(obj)
        request = self.context.get("request")
        return request.build_absolute_uri(obj.qr_code.url) if request and obj.qr_code else ""

    def validate(self, attrs):
        staff_member = attrs.get("staff_member", getattr(self.instance, "staff_member", None))
        if staff_member and (staff_member.role == StaffMember.ROLE_SUPERADMIN or staff_member.user.is_superuser):
            raise serializers.ValidationError({"staff_member": "Superadmin cannot be assigned to manage an event."})
        return attrs
