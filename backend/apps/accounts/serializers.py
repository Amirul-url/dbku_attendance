from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.staff.selectors import (
    staff_member_by_phone_number,
    staff_member_exists_by_email,
    staff_member_exists_by_phone_number,
    staff_member_exists_by_staff_id,
)
from apps.staff.services import create_viewer_staff_member
from .otp_delivery import normalize_phone_number, password_reset_cache_key


class StaffIdTokenObtainPairSerializer(TokenObtainPairSerializer):
    pass


def resolve_password_reset_identity(attrs):
    method = attrs.get("method") or ForgotPasswordSendSerializer.METHOD_EMAIL
    if method == ForgotPasswordSendSerializer.METHOD_EMAIL:
        email = attrs.get("email")
        if not email:
            raise serializers.ValidationError({"email": "Email address is required."})
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist as exc:
            raise serializers.ValidationError({"email": "No account found for this email."}) from exc
        return {
            "method": method,
            "email": email,
            "user": user,
            "identifier": email,
        }

    phone_number = normalize_phone_number(attrs.get("phone_number"))
    if not phone_number:
        raise serializers.ValidationError({"phone_number": "WhatsApp number is required."})
    staff = staff_member_by_phone_number(phone_number)
    if not staff:
        raise serializers.ValidationError({"phone_number": "No account found for this WhatsApp number."})
    return {
        "method": method,
        "phone_number": phone_number,
        "email": staff.user.email,
        "user": staff.user,
        "identifier": phone_number,
    }


class CurrentUserSerializer(serializers.ModelSerializer):
    staff_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_staff", "is_superuser", "staff_profile"]

    def get_staff_profile(self, obj):
        profile = getattr(obj, "staff_profile", None)
        if not profile:
            return None
        return {
            "id": profile.id,
            "full_name": profile.full_name,
            "staff_id": profile.staff_id,
            "department": profile.department,
            "role": profile.role,
        }


class ManualRegistrationSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    staff_id = serializers.CharField(max_length=50, required=False)
    employee_id = serializers.CharField(max_length=50, required=False)
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    department = serializers.CharField(max_length=100)
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        staff_id = attrs.get("staff_id") or attrs.get("employee_id")
        if not staff_id:
            raise serializers.ValidationError({"staff_id": "Staff ID is required."})
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        if User.objects.filter(username__iexact=staff_id).exists() or staff_member_exists_by_staff_id(staff_id):
            raise serializers.ValidationError({
                "staff_id": "This Staff ID already has an account. Please login to the existing account or use Forgot Password.",
            })
        if User.objects.filter(email__iexact=attrs["email"]).exists() or staff_member_exists_by_email(attrs["email"]):
            raise serializers.ValidationError({
                "email": "This email address already has an account. Please login to the existing account or use Forgot Password.",
            })
        phone_number = normalize_phone_number(attrs.get("phone_number"))
        if phone_number and staff_member_exists_by_phone_number(phone_number):
            raise serializers.ValidationError({
                "phone_number": "This WhatsApp number already has an account. Please login to the existing account or use Forgot Password.",
            })
        attrs["phone_number"] = phone_number
        attrs["staff_id"] = staff_id
        return attrs

    def create(self, validated_data):
        validated_data.pop("employee_id", None)
        validated_data.pop("confirm_password", None)
        password = validated_data.pop("password")

        with transaction.atomic():
            user = User.objects.create_user(
                username=validated_data["staff_id"],
                email=validated_data["email"],
                password=password,
                first_name=validated_data["full_name"],
            )
            return create_viewer_staff_member(
                user=user,
                **validated_data,
            )


class ForgotPasswordSendSerializer(serializers.Serializer):
    METHOD_EMAIL = "email"
    METHOD_WHATSAPP = "whatsapp"

    method = serializers.ChoiceField(
        choices=[METHOD_EMAIL, METHOD_WHATSAPP],
        default=METHOD_EMAIL,
        required=False,
    )
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate(self, attrs):
        attrs.update(resolve_password_reset_identity(attrs))
        return attrs

    @property
    def cache_key(self):
        return password_reset_cache_key(
            self.validated_data["method"],
            self.validated_data["identifier"],
        )


class ForgotPasswordVerifySerializer(serializers.Serializer):
    method = serializers.ChoiceField(
        choices=[ForgotPasswordSendSerializer.METHOD_EMAIL, ForgotPasswordSendSerializer.METHOD_WHATSAPP],
        default=ForgotPasswordSendSerializer.METHOD_EMAIL,
        required=False,
    )
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    otp = serializers.CharField(min_length=6, max_length=6)

    def validate(self, attrs):
        attrs.update(resolve_password_reset_identity(attrs))
        expected = cache.get(password_reset_cache_key(attrs["method"], attrs["identifier"]))
        if not expected or expected != attrs["otp"]:
            raise serializers.ValidationError({"otp": "Invalid or expired OTP."})
        return attrs


class ResetPasswordSerializer(serializers.Serializer):
    method = serializers.ChoiceField(
        choices=[ForgotPasswordSendSerializer.METHOD_EMAIL, ForgotPasswordSendSerializer.METHOD_WHATSAPP],
        default=ForgotPasswordSendSerializer.METHOD_EMAIL,
        required=False,
    )
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    otp = serializers.CharField(min_length=6, max_length=6)
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        attrs.update(resolve_password_reset_identity(attrs))
        expected = cache.get(password_reset_cache_key(attrs["method"], attrs["identifier"]))
        if not expected or expected != attrs["otp"]:
            raise serializers.ValidationError({"otp": "Invalid or expired OTP."})
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def save(self):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["password"])
        user.save(update_fields=["password"])
        cache.delete(password_reset_cache_key(self.validated_data["method"], self.validated_data["identifier"]))
        return user
