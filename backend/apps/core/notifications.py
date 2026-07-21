import json
import logging
import re
import threading
from urllib import error, request
from urllib.parse import quote

from django.conf import settings

from apps.core.notification_messages import (
    build_attendance_success_message,
    build_staff_registration_success_message,
)

logger = logging.getLogger(__name__)


def _normalise_whatsapp_number(value):
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return ""
    if digits.startswith("0"):
        return f"6{digits}"
    return digits


def _send_email(recipient, subject, text):
    if not getattr(settings, "NOTIFICATION_EMAIL_ENABLED", True):
        return

    api_key = getattr(settings, "BREVO_API_KEY", "")
    from_email = getattr(settings, "BREVO_FROM_EMAIL", "") or getattr(settings, "DEFAULT_FROM_EMAIL", "")
    from_name = getattr(settings, "BREVO_FROM_NAME", "DBKU Attendance")
    redirect_to = getattr(settings, "NOTIFICATION_EMAIL_REDIRECT_TO", "")

    if not api_key or not from_email:
        logger.info("Brevo notification skipped because email settings are incomplete.")
        return

    to_email = redirect_to or recipient
    text_content = text if not redirect_to else f"Original recipient: {recipient}\n\n{text}"
    payload = json.dumps({
        "sender": {"name": from_name, "email": from_email},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": text_content,
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
    with request.urlopen(api_request, timeout=getattr(settings, "EMAIL_TIMEOUT", 15)) as response:
        if response.status >= 400:
            raise RuntimeError("Brevo rejected the notification email request.")


def _send_whatsapp(phone_number, text):
    if not getattr(settings, "WHATSAPP_ENABLED", True):
        return
    if getattr(settings, "WHATSAPP_PROVIDER", "evolution") != "evolution":
        logger.info("WhatsApp notification skipped because provider is not supported.")
        return

    base_url = getattr(settings, "EVOLUTION_API_URL", "").rstrip("/")
    api_key = getattr(settings, "EVOLUTION_API_KEY", "")
    instance = getattr(settings, "EVOLUTION_INSTANCE_NAME", "")
    number = _normalise_whatsapp_number(phone_number)

    if not base_url or not api_key or not instance or not number:
        logger.info("Evolution API notification skipped because WhatsApp settings are incomplete.")
        return

    payload = json.dumps({
        "number": number,
        "text": text,
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
    with request.urlopen(api_request, timeout=getattr(settings, "EVOLUTION_API_TIMEOUT", 15)) as response:
        if response.status >= 400:
            raise RuntimeError("Evolution API rejected the WhatsApp notification request.")


def _dispatch_message(email, phone_number, subject, text):
    def worker():
        if email:
            try:
                _send_email(email, subject, text)
            except (RuntimeError, TimeoutError, error.HTTPError, error.URLError, OSError) as exc:
                logger.warning("Attendance email notification failed: %s", exc)
        if phone_number:
            try:
                _send_whatsapp(phone_number, text)
            except (RuntimeError, TimeoutError, error.HTTPError, error.URLError, OSError) as exc:
                logger.warning("Attendance WhatsApp notification failed: %s", exc)

    threading.Thread(target=worker, daemon=True).start()


def notify_attendance_success(attendance):
    message = build_attendance_success_message(
        attendance,
        login_url=getattr(settings, "NOTIFICATION_LOGIN_URL", ""),
    )
    if not message:
        return

    _dispatch_message(
        message["email"],
        message["phone_number"],
        message["subject"],
        message["text"],
    )


def notify_staff_registration_success(staff):
    message = build_staff_registration_success_message(
        staff,
        login_url=getattr(settings, "NOTIFICATION_LOGIN_URL", ""),
    )
    if not message["email"] and not message["phone_number"]:
        return

    _dispatch_message(
        message["email"],
        message["phone_number"],
        message["subject"],
        message["text"],
    )
