from django.contrib.auth.models import User
from django.db import transaction

from .models import StaffMember


def create_viewer_staff_member(user, **staff_data):
    return StaffMember.objects.create(
        user=user,
        role=StaffMember.ROLE_VIEWER,
        **staff_data,
    )


def _actor_is_superuser(user):
    return bool(getattr(user, "is_superuser", False))


def create_staff_member(validated_data, request_user=None):
    password = validated_data.pop("password", None)
    is_staff = validated_data.pop("is_staff", False)
    is_superuser = validated_data.pop("is_superuser", False)
    role = validated_data.get("role", StaffMember.ROLE_VIEWER)

    if not _actor_is_superuser(request_user):
        is_staff = False
        is_superuser = False
        if role == StaffMember.ROLE_SUPERADMIN:
            validated_data["role"] = StaffMember.ROLE_VIEWER
    else:
        if role == StaffMember.ROLE_SUPERADMIN:
            is_superuser = True
            is_staff = True
        elif is_superuser:
            validated_data["role"] = StaffMember.ROLE_SUPERADMIN
            is_staff = True

    if not password:
        from rest_framework import serializers

        raise serializers.ValidationError({"password": "Password is required."})

    with transaction.atomic():
        user = User.objects.create_user(
            username=validated_data["staff_id"],
            email=validated_data.get("email") or "",
            password=password,
        )
        user.is_staff = is_staff or is_superuser
        user.is_superuser = is_superuser
        user.save(update_fields=["is_staff", "is_superuser"])
        return StaffMember.objects.create(user=user, **validated_data)


def update_staff_member(instance, validated_data, request_user=None):
    password = validated_data.pop("password", None)
    is_staff = validated_data.pop("is_staff", None)
    is_superuser = validated_data.pop("is_superuser", None)
    role = validated_data.get("role", instance.role)

    if not _actor_is_superuser(request_user):
        is_staff = None
        is_superuser = None
        if role == StaffMember.ROLE_SUPERADMIN:
            validated_data.pop("role", None)
    else:
        if role == StaffMember.ROLE_SUPERADMIN:
            is_superuser = True
            is_staff = True
        elif is_superuser:
            validated_data["role"] = StaffMember.ROLE_SUPERADMIN
            is_staff = True
        elif is_superuser is None and instance.user.is_superuser and role != StaffMember.ROLE_SUPERADMIN:
            is_superuser = False

    for field, value in validated_data.items():
        setattr(instance, field, value)

    with transaction.atomic():
        instance.save()
        instance.user.email = instance.email or ""
        instance.user.username = instance.staff_id
        if is_superuser is not None:
            instance.user.is_superuser = is_superuser
            if is_superuser:
                instance.user.is_staff = True
            elif is_staff is None:
                instance.user.is_staff = False
        if is_staff is not None:
            instance.user.is_staff = is_staff or instance.user.is_superuser
        if password:
            instance.user.set_password(password)
        instance.user.save()

    return instance
