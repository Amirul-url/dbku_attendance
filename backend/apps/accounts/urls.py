from django.urls import path

from .views import (
    CurrentUserView,
    ForgotPasswordSendOtpView,
    ForgotPasswordVerifyOtpView,
    ManualRegistrationView,
    ResetPasswordSubmitView,
)

urlpatterns = [
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("register/manual/", ManualRegistrationView.as_view(), name="register-manual"),
    path("forgot-password/send-otp/", ForgotPasswordSendOtpView.as_view(), name="forgot-password-send-otp"),
    path("forgot-password/verify-otp/", ForgotPasswordVerifyOtpView.as_view(), name="forgot-password-verify-otp"),
    path("reset-password/submit/", ResetPasswordSubmitView.as_view(), name="reset-password-submit"),
]
