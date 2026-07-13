from io import BytesIO

import qrcode
from django.conf import settings
from django.core.files.base import ContentFile


def public_url(path):
    return f"{settings.BASE_APP_URL}/{path.lstrip('/')}"


def save_qr_image(instance, field_name, filename, url):
    image = qrcode.make(url)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    getattr(instance, field_name).save(filename, ContentFile(buffer.getvalue()), save=False)


def generate_event_qr_codes(event):
    configs = [
        ("visitor_qr_code", f"visitor_event_{event.id}.png", public_url(f"visitor-attendance/{event.id}")),
        ("staff_qr_code", f"staff_event_{event.id}.png", public_url(f"staff-attendance/{event.id}")),
        ("passport_qr_code", f"passport_event_{event.id}.png", public_url(f"passport-attendance/{event.id}")),
    ]
    update_fields = []
    for field_name, filename, url in configs:
        save_qr_image(event, field_name, filename, url)
        update_fields.append(field_name)
    event.save(update_fields=update_fields)


def file_exists(file_field):
    try:
        return bool(file_field and file_field.name and file_field.storage.exists(file_field.name))
    except Exception:
        return False


def ensure_event_qr_codes(event):
    fields = ("visitor_qr_code", "staff_qr_code", "passport_qr_code")
    if any(not file_exists(getattr(event, field_name)) for field_name in fields):
        generate_event_qr_codes(event)
    return event


def generate_assignment_qr_code(assignment):
    save_qr_image(
        assignment,
        "qr_code",
        f"assignment_{assignment.id}.png",
        public_url(f"assignment-attendance/{assignment.id}"),
    )
    assignment.save(update_fields=["qr_code"])


def ensure_assignment_qr_code(assignment):
    if not file_exists(assignment.qr_code):
        generate_assignment_qr_code(assignment)
    return assignment
