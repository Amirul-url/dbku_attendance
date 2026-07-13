import re
import uuid
from pathlib import Path

from django.conf import settings
from django.db import transaction
from rest_framework import serializers

from apps.core.geo import validate_event_geofence
from apps.core.utils import split_client_ips
from apps.events.models import Event

from .models import PassportAttendance, PassportVisitor

COUNTRY_CODE_MAP = {
    "MYS": "Malaysia",
    "IDN": "Indonesia",
    "BRN": "Brunei",
    "SGP": "Singapore",
    "PHL": "Philippines",
    "THA": "Thailand",
    "CHN": "China",
    "JPN": "Japan",
    "KOR": "South Korea",
    "IND": "India",
    "USA": "United States",
    "GBR": "United Kingdom",
    "AUS": "Australia",
}


def _clean_text(value):
    return str(value or "").strip()


def _normalise_passport_number(value):
    return re.sub(r"[^A-Z0-9]", "", _clean_text(value).upper())


def _normalise_additional_fields_text(value):
    text = _clean_text(value)
    if not text:
        return ""
    text = text.replace("\\u000A", "\n").replace("\\u000a", "\n")
    text = text.replace("\\r\\n", "\n").replace("\\n", "\n")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(line.strip() for line in text.split("\n") if line.strip())


def _additional_fields_to_text(fields):
    lines = []
    if not isinstance(fields, list):
        return ""
    for item in fields:
        if not isinstance(item, dict):
            continue
        label = _clean_text(item.get("label"))
        value = _clean_text(item.get("value"))
        if label and value:
            lines.append(f"{label}: {value}")
        elif value:
            lines.append(value)
    return "\n".join(lines)


def _additional_fields_from_text(value):
    text = _normalise_additional_fields_text(value)
    result = []
    for line in text.split("\n"):
        if not line:
            continue
        if ":" in line:
            label, field_value = line.split(":", 1)
            label = label.strip()
            field_value = field_value.strip()
            if label and field_value:
                result.append({"label": label, "value": field_value})
        else:
            result.append({"label": "Note", "value": line})
    return result


def _safe_media_name(value):
    name = Path(_clean_text(value)).name
    return name if name and name not in {".", ".."} else ""


def _attach_passport_images(visitor, original_image_name, processed_image_name):
    original_name = _safe_media_name(original_image_name)
    if original_name:
        original_path = Path(settings.MEDIA_ROOT) / "passport_images" / original_name
        if original_path.exists():
            visitor.image.name = f"passport_images/{original_name}"

    processed_name = _safe_media_name(processed_image_name)
    if processed_name:
        processed_path = Path(settings.MEDIA_ROOT) / "passport_processed" / processed_name
        if processed_path.exists():
            visitor.extracted_image.name = f"passport_processed/{processed_name}"


def submit_passport_attendance(data, request):
    event_id = data.get("event") or data.get("event_id")
    if not event_id:
        raise serializers.ValidationError({"event": "Event is required."})

    try:
        event = Event.objects.get(pk=event_id)
    except Event.DoesNotExist as exc:
        raise serializers.ValidationError({"event": "Event not found."}) from exc
    distance_meter = validate_event_geofence(event, data.get("latitude"), data.get("longitude"))

    passport_number = _normalise_passport_number(data.get("passport_number"))
    if not passport_number:
        raise serializers.ValidationError({"passport_number": "Passport number cannot be empty."})

    first_name = _clean_text(data.get("first_name") or data.get("given_name"))
    last_name = _clean_text(data.get("last_name") or data.get("surname"))
    full_name = _clean_text(data.get("full_name")) or " ".join(part for part in [first_name, last_name] if part).strip() or passport_number

    passport_type = _clean_text(data.get("type") or data.get("passport_type") or "P")
    country_code = _clean_text(data.get("country_code")).upper()
    nationality = _clean_text(data.get("nationality"))
    date_of_birth = _clean_text(data.get("date_of_birth"))
    date_of_issue = _clean_text(data.get("date_of_issue"))
    date_of_expiry = _clean_text(data.get("date_of_expiry") or data.get("expiry_date"))
    sex = _clean_text(data.get("sex") or data.get("gender"))
    raw_text = _clean_text(data.get("raw_text") or data.get("ocr_raw_text"))
    status = _clean_text(data.get("status")) or PassportVisitor.STATUS_PENDING_VERIFICATION
    image_quality_note = _clean_text(data.get("image_quality_note"))

    additional_fields_text = _normalise_additional_fields_text(data.get("additional_fields_text"))
    additional_fields = data.get("additional_fields")
    if not additional_fields_text and additional_fields:
        additional_fields_text = _additional_fields_to_text(additional_fields)
    if not isinstance(additional_fields, list):
        additional_fields = _additional_fields_from_text(additional_fields_text)

    ipv4_address, ipv6_address = split_client_ips(request)

    with transaction.atomic():
        visitor, _created = PassportVisitor.objects.get_or_create(
            passport_number=passport_number,
            defaults={
                "full_name": full_name,
                "country": nationality or country_code,
                "date_of_birth": date_of_birth,
                "expiry_date": date_of_expiry,
                "gender": sex,
                "ocr_raw_text": raw_text,
                "image_quality_note": image_quality_note,
                "status": status,
            },
        )

        visitor.full_name = full_name or visitor.full_name
        visitor.country = nationality or country_code or visitor.country
        visitor.date_of_birth = date_of_birth or visitor.date_of_birth
        visitor.expiry_date = date_of_expiry or visitor.expiry_date
        visitor.gender = sex or visitor.gender
        visitor.ocr_raw_text = raw_text or visitor.ocr_raw_text
        visitor.image_quality_note = image_quality_note or visitor.image_quality_note
        visitor.status = status or visitor.status

        extra_data = dict(visitor.extra_data or {})
        extra_data.update({
            "type": passport_type,
            "passport_type": passport_type,
            "country_code": country_code,
            "nationality": nationality,
            "first_name": first_name,
            "last_name": last_name,
            "date_of_issue": date_of_issue,
            "additional_fields_text": additional_fields_text,
            "additional_fields": additional_fields,
        })
        visitor.extra_data = extra_data
        _attach_passport_images(visitor, data.get("original_image_name"), data.get("processed_image_name"))
        visitor.save()

        attendance, attendance_created = PassportAttendance.objects.get_or_create(
            passport_visitor=visitor,
            event=event,
            defaults={
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "ipv4_address": ipv4_address,
                "ipv6_address": ipv6_address,
            },
        )
        if not attendance_created:
            raise serializers.ValidationError("Attendance already recorded.")
        attendance.distance_meter = distance_meter
        return attendance


def _clean_mrz_line(line):
    return re.sub(r"[^A-Z0-9<]", "", line.upper())


def _parse_mrz_date(value):
    if not value or len(value) != 6 or not value.isdigit():
        return ""
    yy = int(value[:2])
    century = 2000 if yy <= 40 else 1900
    return f"{century + yy:04d}-{value[2:4]}-{value[4:6]}"


def _title_name(value):
    return re.sub(r"\s+", " ", value.replace("<", " ")).strip().title()


def parse_mrz(text):
    lines = [_clean_mrz_line(line) for line in text.splitlines()]
    lines = [line for line in lines if len(line) >= 25]
    for index in range(len(lines) - 1):
        line1 = lines[index][:44].ljust(44, "<")
        line2 = lines[index + 1][:44].ljust(44, "<")
        if not line1.startswith("P<"):
            continue
        names = line1[5:]
        surname, given = (names.split("<<", 1) + [""])[:2] if "<<" in names else (names, "")
        first_name = _title_name(given)
        last_name = _title_name(surname)
        passport_number = line2[:9].replace("<", "")
        nationality_code = line2[10:13].replace("<", "")
        gender = {"M": "Male", "F": "Female"}.get(line2[20], line2[20].replace("<", ""))
        return {
            "type": "P",
            "country_code": line1[2:5].replace("<", ""),
            "passport_number": passport_number,
            "nationality": COUNTRY_CODE_MAP.get(nationality_code, nationality_code),
            "first_name": first_name,
            "last_name": last_name,
            "full_name": " ".join(part for part in [first_name, last_name] if part),
            "date_of_birth": _parse_mrz_date(line2[13:19]),
            "sex": gender,
            "date_of_expiry": _parse_mrz_date(line2[21:27]),
            "status": "auto-extracted" if passport_number else "pending verification",
        }
    return {}


def preprocess_image(input_path, output_path):
    try:
        import cv2
    except ImportError:
        raise ValueError("OpenCV is not installed in this environment. Install backend requirements to enable OCR.")

    image = cv2.imread(str(input_path))
    if image is None:
        raise ValueError("Failed to read uploaded passport image.")
    height, width = image.shape[:2]
    if height > width * 1.35:
        image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    cropped = image[int(height * 0.02): int(height * 0.98), int(width * 0.02): int(width * 0.98)]
    gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, None, fx=1.8, fy=1.8, interpolation=cv2.INTER_CUBIC)
    enhanced = cv2.convertScaleAbs(cv2.bilateralFilter(resized, 7, 50, 50), alpha=1.25, beta=10)
    cv2.imwrite(str(output_path), enhanced)
    blur_value = cv2.Laplacian(gray, cv2.CV_64F).var()
    return "Image may be too blurry. Please upload a clearer passport image." if blur_value < 60 else ""


def process_passport_upload(uploaded_file):
    original_dir = Path(settings.MEDIA_ROOT) / "passport_images"
    processed_dir = Path(settings.MEDIA_ROOT) / "passport_processed"
    original_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(uploaded_file.name).suffix or ".jpg"
    unique_id = uuid.uuid4().hex
    original_name = f"passport_{unique_id}{suffix}"
    processed_name = f"processed_{unique_id}.jpg"
    original_path = original_dir / original_name
    processed_path = processed_dir / processed_name

    with original_path.open("wb") as target:
        for chunk in uploaded_file.chunks():
            target.write(chunk)

    quality_note = preprocess_image(original_path, processed_path)
    try:
        import pytesseract

        raw_text = pytesseract.image_to_string(str(processed_path))
    except Exception as exc:
        raw_text = ""
        quality_note = quality_note or f"OCR engine unavailable: {exc}"

    parsed = parse_mrz(raw_text)
    full_name = parsed.get("full_name", "")
    if not parsed.get("passport_number"):
        match = re.search(r"\b[A-Z]{1,2}\d{6,8}\b", raw_text.upper())
        if match:
            parsed["passport_number"] = match.group(0)
    return {
        "message": "Passport scanned successfully",
        "raw_text": raw_text,
        "image_quality_note": quality_note,
        "original_image_name": original_name,
        "processed_image_name": processed_name,
        "original_image_url": f"{settings.MEDIA_URL}passport_images/{original_name}",
        "processed_image_url": f"{settings.MEDIA_URL}passport_processed/{processed_name}",
        "status": parsed.get("status", "pending verification"),
        "full_name": full_name,
        "type": parsed.get("type", "P"),
        "country_code": parsed.get("country_code", ""),
        "passport_number": parsed.get("passport_number", ""),
        "nationality": parsed.get("nationality", ""),
        "first_name": parsed.get("first_name", ""),
        "last_name": parsed.get("last_name", ""),
        "date_of_birth": parsed.get("date_of_birth", ""),
        "sex": parsed.get("sex", ""),
        "date_of_expiry": parsed.get("date_of_expiry", ""),
    }
