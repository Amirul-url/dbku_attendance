import random

from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .otp_delivery import (
    OTPDeliveryError,
    send_password_reset_email,
    send_password_reset_whatsapp,
)
from .serializers import (
    CurrentUserSerializer,
    EmailOrUsernameTokenObtainPairSerializer,
    ForgotPasswordSendSerializer,
    ForgotPasswordVerifySerializer,
    ManualRegistrationSerializer,
    ResetPasswordSerializer,
)


class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenObtainPairSerializer


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(CurrentUserSerializer(request.user).data)


class ManualRegistrationView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = ManualRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        staff = serializer.save()
        return Response(
            {
                "message": "Registration successful.",
                "staff": {
                    "id": staff.id,
                    "full_name": staff.full_name,
                    "staff_id": staff.staff_id,
                    "email": staff.email,
                    "role": staff.role,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class ForgotPasswordSendOtpView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = ForgotPasswordSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        method = serializer.validated_data["method"]
        otp = f"{random.randint(0, 999999):06d}"
        cache.set(serializer.cache_key, otp, timeout=600)

        try:
            if method == "whatsapp":
                send_password_reset_whatsapp(serializer.validated_data["phone_number"], otp)
            else:
                send_password_reset_email(serializer.validated_data["email"], otp)
        except OTPDeliveryError as exc:
            cache.delete(serializer.cache_key)
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"message": f"OTP sent successfully by {method}."})


class ForgotPasswordVerifyOtpView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = ForgotPasswordVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"message": "OTP verified.", "redirect_url": "/reset-password"})


class ResetPasswordSubmitView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "Password reset successful."})
