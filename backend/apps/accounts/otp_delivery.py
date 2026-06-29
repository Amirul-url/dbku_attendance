import json
import re
from urllib import error, request
from urllib.parse import quote

from django.conf import settings
from django.core.mail import send_mail
from smtplib import SMTPException


class OTPDeliveryError(Exception):
    pass


def normalize_phone_number(value):
    digits = re.sub(r"\D", "", value or "")
    return digits or None


def password_reset_cache_key(method, identifier):
    return f"password_reset_otp:{method}:{identifier}"


def send_password_reset_email(email, otp):
    if not getattr(settings, "NOTIFICATION_EMAIL_ENABLED", True):
        raise OTPDeliveryError("Email notifications are disabled.")

    provider = getattr(settings, "NOTIFICATION_EMAIL_PROVIDER", "brevo")
    if provider == "brevo":
        send_password_reset_email_brevo(email, otp)
        return

    if not settings.EMAIL_HOST:
        raise OTPDeliveryError("SMTP email is not configured.")

    try:
        send_mail(
            "DBKU Attendance Password Reset OTP",
            f"Your DBKU Attendance password reset OTP is {otp}. It expires in 10 minutes.",
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
    except (SMTPException, OSError) as exc:
        raise OTPDeliveryError(f"Unable to send email OTP: {exc}") from exc


def send_password_reset_email_brevo(email, otp):
    api_key = getattr(settings, "BREVO_API_KEY", "")
    from_email = getattr(settings, "BREVO_FROM_EMAIL", "") or getattr(settings, "DEFAULT_FROM_EMAIL", "")
    from_name = getattr(settings, "BREVO_FROM_NAME", "DBKU Attendance")
    redirect_to = getattr(settings, "NOTIFICATION_EMAIL_REDIRECT_TO", "")

    if not api_key or not from_email:
        raise OTPDeliveryError("Brevo email is not configured.")

    recipient = redirect_to or email
    text = f"Your DBKU Attendance password reset OTP is {otp}. It expires in 10 minutes."
    if redirect_to:
        text = f"Original recipient: {email}\n\n{text}"

    payload = json.dumps({
        "sender": {"name": from_name, "email": from_email},
        "to": [{"email": recipient}],
        "subject": "DBKU Attendance Password Reset OTP",
        "textContent": text,
    }).encode("utf-8")

    api_request = request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "api-key": api_key,
        },
        method="POST",
    )

    try:
        with request.urlopen(api_request, timeout=getattr(settings, "EMAIL_TIMEOUT", 15)) as response:
            if response.status >= 400:
                raise OTPDeliveryError("Brevo rejected the email OTP request.")
    except (error.HTTPError, error.URLError, TimeoutError) as exc:
        raise OTPDeliveryError(f"Unable to send email OTP through Brevo: {exc}") from exc


def send_password_reset_whatsapp(phone_number, otp):
    if not getattr(settings, "WHATSAPP_ENABLED", True):
        raise OTPDeliveryError("WhatsApp notifications are disabled.")
    if getattr(settings, "WHATSAPP_PROVIDER", "evolution") != "evolution":
        raise OTPDeliveryError("WhatsApp provider is not supported.")

    base_url = getattr(settings, "EVOLUTION_API_URL", "").rstrip("/")
    api_key = getattr(settings, "EVOLUTION_API_KEY", "")
    instance = getattr(settings, "EVOLUTION_INSTANCE_NAME", "")

    if not base_url or not api_key or not instance:
        raise OTPDeliveryError("Evolution API is not configured.")

    payload = json.dumps({
        "number": normalize_phone_number(phone_number),
        "text": f"Your DBKU Attendance password reset OTP is {otp}. It expires in 10 minutes.",
    }).encode("utf-8")

    api_request = request.Request(
        f"{base_url}/message/sendText/{quote(instance, safe='')}",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "apikey": api_key,
        },
        method="POST",
    )

    try:
        with request.urlopen(api_request, timeout=getattr(settings, "EVOLUTION_API_TIMEOUT", 15)) as response:
            if response.status >= 400:
                raise OTPDeliveryError("Evolution API rejected the WhatsApp OTP request.")
    except (error.HTTPError, error.URLError, TimeoutError) as exc:
        raise OTPDeliveryError(f"Unable to send WhatsApp OTP: {exc}") from exc
