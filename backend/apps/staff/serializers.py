from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import serializers

from .models import StaffMember
from apps.accounts.otp_delivery import normalize_phone_number


class StaffMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    is_staff = serializers.BooleanField(required=False)
    is_superuser = serializers.BooleanField(required=False)
    last_login = serializers.DateTimeField(source="user.last_login", read_only=True)

    class Meta:
        model = StaffMember
        fields = [
            "id",
            "username",
            "full_name",
            "staff_id",
            "email",
            "phone_number",
            "department",
            "registration_method",
            "ic_number",
            "role",
            "is_staff",
            "is_superuser",
            "last_login",
            "password",
            "created_at",
        ]
        read_only_fields = ["id", "username", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["is_staff"] = instance.user.is_staff
        data["is_superuser"] = instance.user.is_superuser
        return data

    def validate_phone_number(self, value):
        return normalize_phone_number(value)

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        is_staff = validated_data.pop("is_staff", False)
        is_superuser = validated_data.pop("is_superuser", False)
        request_user = self.context.get("request").user if self.context.get("request") else None
        if not getattr(request_user, "is_superuser", False):
            is_staff = False
            is_superuser = False
        if not password:
            raise serializers.ValidationError({"password": "Password is required."})

        with transaction.atomic():
            user = User.objects.create_user(
                username=validated_data["staff_id"],
                email=validated_data["email"],
                password=password,
            )
            user.is_staff = is_staff or is_superuser
            user.is_superuser = is_superuser
            user.save(update_fields=["is_staff", "is_superuser"])
            return StaffMember.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        is_staff = validated_data.pop("is_staff", None)
        is_superuser = validated_data.pop("is_superuser", None)
        request_user = self.context.get("request").user if self.context.get("request") else None
        if not getattr(request_user, "is_superuser", False):
            is_staff = None
            is_superuser = None
        for field, value in validated_data.items():
            setattr(instance, field, value)

        with transaction.atomic():
            instance.save()
            instance.user.email = instance.email
            instance.user.username = instance.staff_id
            if is_superuser is not None:
                instance.user.is_superuser = is_superuser
                if is_superuser:
                    instance.user.is_staff = True
            if is_staff is not None:
                instance.user.is_staff = is_staff or instance.user.is_superuser
            if password:
                instance.user.set_password(password)
            instance.user.save()

        return instance
