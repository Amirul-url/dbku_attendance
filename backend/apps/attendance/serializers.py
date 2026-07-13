from rest_framework import serializers

from apps.core.geo import validate_event_geofence
from apps.staff.selectors import staff_member_by_staff_id

from .models import AssignmentAttendance, StaffAttendance, Visitor, VisitorAttendance


class VisitorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Visitor
        fields = "__all__"

    def validate_phone_number(self, value):
        if not value.isdigit() or len(value) < 9:
            raise serializers.ValidationError("Invalid phone number.")
        return value

    def create(self, validated_data):
        email = validated_data["email"].strip().lower()
        visitor = Visitor.objects.filter(email=email).order_by("id").first()
        if visitor is None:
            visitor = Visitor(email=email)
        for field, value in {**validated_data, "email": email}.items():
            setattr(visitor, field, value)
        visitor.save()
        return visitor


class StaffAttendanceSerializer(serializers.ModelSerializer):
    event_name = serializers.CharField(source="event.name", read_only=True)
    distance_meter = serializers.SerializerMethodField()

    class Meta:
        model = StaffAttendance
        fields = "__all__"

    def get_distance_meter(self, obj):
        return getattr(obj, "distance_meter", None)

    def validate(self, attrs):
        event = attrs.get("event", getattr(self.instance, "event", None))
        staff_id = (attrs.get("staff_id") or getattr(self.instance, "staff_id", "") or "").strip().upper()
        email = (attrs.get("email") or getattr(self.instance, "email", "") or "").strip().lower()
        phone = (attrs.get("phone_number") or getattr(self.instance, "phone_number", "") or "").strip()

        if not all([attrs.get("full_name", getattr(self.instance, "full_name", "")), staff_id, phone, email, attrs.get("department", getattr(self.instance, "department", ""))]):
            raise serializers.ValidationError("All fields are required.")
        if not phone.isdigit() or len(phone) < 9:
            raise serializers.ValidationError({"phone_number": "Invalid phone number."})
        staff = staff_member_by_staff_id(staff_id)
        if not staff:
            raise serializers.ValidationError({"staff_id": "Employee ID not found. Please register first."})
        if staff.email.lower() != email:
            raise serializers.ValidationError({"email": "Email does not match registered employee."})
        if event:
            attrs["distance_meter"] = validate_event_geofence(event, attrs.get("latitude"), attrs.get("longitude"))
        attrs["staff_id"] = staff.staff_id
        attrs["staff_member"] = staff
        attrs["full_name"] = staff.full_name
        attrs["email"] = staff.email
        attrs["department"] = staff.department
        return attrs

    def create(self, validated_data):
        distance_meter = validated_data.pop("distance_meter", None)
        instance = super().create(validated_data)
        instance.distance_meter = distance_meter
        return instance


class VisitorAttendanceSerializer(serializers.ModelSerializer):
    visitor_detail = VisitorSerializer(source="visitor", read_only=True)
    event_name = serializers.CharField(source="event.name", read_only=True)
    distance_meter = serializers.SerializerMethodField()

    class Meta:
        model = VisitorAttendance
        fields = "__all__"
        validators = []

    def get_distance_meter(self, obj):
        return getattr(obj, "distance_meter", None)

    def validate(self, attrs):
        event = attrs.get("event", getattr(self.instance, "event", None))
        if event:
            visitor = attrs.get("visitor", getattr(self.instance, "visitor", None))
            if visitor and VisitorAttendance.objects.filter(visitor=visitor, event=event).exclude(pk=getattr(self.instance, "pk", None)).exists():
                raise serializers.ValidationError("Attendance already registered for this visitor and event.")
            attrs["distance_meter"] = validate_event_geofence(event, attrs.get("latitude"), attrs.get("longitude"))
        return attrs

    def create(self, validated_data):
        distance_meter = validated_data.pop("distance_meter", None)
        instance = super().create(validated_data)
        instance.distance_meter = distance_meter
        return instance


class AssignmentAttendanceSerializer(serializers.ModelSerializer):
    assignment_title = serializers.CharField(source="assignment.task_title", read_only=True)
    distance_meter = serializers.SerializerMethodField()
    full_name = serializers.CharField(write_only=True, required=False)
    staff_id = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = AssignmentAttendance
        fields = "__all__"

    def get_distance_meter(self, obj):
        return getattr(obj, "distance_meter", None)

    def validate(self, attrs):
        assignment = attrs.get("assignment", getattr(self.instance, "assignment", None))
        phone = (attrs.get("phone_number") or getattr(self.instance, "phone_number", "") or "").strip()
        email = (attrs.get("email") or getattr(self.instance, "email", "") or "").strip().lower()
        full_name = (attrs.pop("full_name", "") or "").strip()
        staff_id = (attrs.pop("staff_id", "") or "").strip().upper()

        if not phone or not email or not full_name or not staff_id:
            raise serializers.ValidationError("All fields are required.")
        if not phone.isdigit() or len(phone) < 9:
            raise serializers.ValidationError({"phone_number": "Invalid phone number."})
        if assignment:
            assigned_staff = assignment.staff_member
            if assigned_staff.staff_id.upper() != staff_id:
                raise serializers.ValidationError({"staff_id": "This QR is only valid for the assigned staff."})
            if assigned_staff.email.lower() != email:
                raise serializers.ValidationError({"email": "Email does not match the assigned staff record."})
            if assigned_staff.full_name.lower() != full_name.lower():
                raise serializers.ValidationError({"full_name": "Full name does not match the assigned staff record."})
        if assignment:
            attrs["distance_meter"] = validate_event_geofence(assignment.event, attrs.get("latitude"), attrs.get("longitude"))
        return attrs

    def create(self, validated_data):
        distance_meter = validated_data.pop("distance_meter", None)
        instance = super().create(validated_data)
        instance.distance_meter = distance_meter
        return instance
