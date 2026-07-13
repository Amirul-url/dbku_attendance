from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CurrentUserView,
    ForgotPasswordSendOtpView,
    ForgotPasswordVerifyOtpView,
    ManualRegistrationView,
    ResetPasswordSubmitView,
    StaffIdTokenObtainPairView,
)

urlpatterns = [
    path("token/", StaffIdTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("register/manual/", ManualRegistrationView.as_view(), name="register-manual"),
    path("forgot-password/send-otp/", ForgotPasswordSendOtpView.as_view(), name="forgot-password-send-otp"),
    path("forgot-password/verify-otp/", ForgotPasswordVerifyOtpView.as_view(), name="forgot-password-verify-otp"),
    path("reset-password/submit/", ResetPasswordSubmitView.as_view(), name="reset-password-submit"),
]
