import json
import logging
import re
import threading
from urllib import error, request
from urllib.parse import quote

from django.conf import settings

logger = logging.getLogger(__name__)


def _clean(value, fallback="-"):
    text = str(value or "").strip()
    return text or fallback


def _format_date(value):
    if not value:
        return "-"
    try:
        return value.strftime("%d %b %Y")
    except AttributeError:
        return _clean(value)


def _format_time(value):
    if not value:
        return "-"
    try:
        return value.strftime("%I:%M %p").lstrip("0")
    except AttributeError:
        return _clean(value)


def _normalise_whatsapp_number(value):
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return ""
    if digits.startswith("0"):
        return f"6{digits}"
    return digits


def _passport_extra_lookup(visitor):
    extra_data = getattr(visitor, "extra_data", None) or {}
    additional_fields = extra_data.get("additional_fields") or []
    lookup = {}
    for item in additional_fields:
        if not isinstance(item, dict):
            continue
        label = re.sub(r"\s*\*+$", "", _clean(item.get("label"), "")).strip().lower()
        if label:
            lookup[label] = _clean(item.get("value"), "")
    return lookup


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
    class_name = attendance.__class__.__name__
    event = getattr(attendance, "event", None)
    email = ""
    phone_number = ""
    recipient_name = ""
    assignment_login_url = ""
    lines = ["Your attendance has been recorded successfully.", ""]

    if class_name == "StaffAttendance":
        recipient_name = attendance.full_name
        email = attendance.email
        phone_number = attendance.phone_number
    elif class_name == "VisitorAttendance":
        visitor = attendance.visitor
        recipient_name = visitor.full_name
        email = visitor.email
        phone_number = visitor.phone_number
    elif class_name == "PassportAttendance":
        visitor = attendance.passport_visitor
        extra = _passport_extra_lookup(visitor)
        recipient_name = visitor.full_name
        email = extra.get("email", "")
        phone_number = extra.get("phone number", "")
        lines.extend([
            f"Passport No.: {_clean(visitor.passport_number)}",
        ])
    elif class_name == "AssignmentAttendance":
        assignment = attendance.assignment
        staff = assignment.staff_member
        event = assignment.event
        recipient_name = staff.full_name
        email = attendance.email or staff.email
        phone_number = attendance.phone_number or staff.phone_number
        assignment_login_url = _clean(getattr(settings, "NOTIFICATION_LOGIN_URL", ""), "")
        lines = ["Your assignment attendance has been recorded successfully.", ""]
        lines.extend([
            f"Task: {_clean(assignment.task_title)}",
        ])
    else:
        return

    lines.extend([
        f"Event: {_clean(getattr(event, 'name', None))}",
        f"Date: {_format_date(getattr(attendance, 'date', None))}",
        f"Time: {_format_time(getattr(attendance, 'time', None))}",
        f"Venue: {_clean(getattr(event, 'location', None))}",
    ])
    if assignment_login_url:
        lines.extend([
            "",
            f"For more details about your assignment, please log in here: {assignment_login_url}",
        ])
    lines.extend(["", "Thank you.", "DBKU Attendance Management System"])

    greeting = f"Hi {_clean(recipient_name, 'there')},"
    subject = f"Attendance Recorded - {_clean(getattr(event, 'name', None))}"
    _dispatch_message(email, phone_number, subject, "\n".join([greeting, "", *lines]))


def notify_staff_registration_success(staff):
    email = staff.email or ""
    phone_number = staff.phone_number or ""
    if not email and not phone_number:
        return

    subject = "Staff Account Registered - DBKU Attendance"
    text = "\n".join([
        f"Hi {_clean(staff.full_name, 'there')},",
        "",
        "Your DBKU Attendance account has been registered successfully.",
        "",
        f"Employee ID: {_clean(staff.staff_id)}",
        f"Login: {_clean(getattr(settings, 'NOTIFICATION_LOGIN_URL', ''))}",
        "",
        "Please use the password created during registration to log in.",
        "",
        "Thank you.",
        "DBKU Attendance Management System",
    ])
    _dispatch_message(email, phone_number, subject, text)
