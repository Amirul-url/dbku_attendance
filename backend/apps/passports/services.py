import re
import uuid
from datetime import date
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.core.geo import validate_event_geofence
from apps.core.utils import split_client_ips
from apps.events.models import Event

from .country_codes import COUNTRY_CODE_MAP, COUNTRY_NAME_CODE_MAP
from .models import PassportAttendance, PassportVisitor

REQUIRED_ADDITIONAL_FIELD_LABELS = ("Phone Number", "Email")
PROFILE_EXTRACTOR_VERSION = "v3"
MTCNN_DETECTOR = None

TESSERACT_CANDIDATE_PATHS = (
    Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
    Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
)

def _configure_tesseract(pytesseract_module):
    for candidate in TESSERACT_CANDIDATE_PATHS:
        if candidate.exists():
            pytesseract_module.pytesseract.tesseract_cmd = str(candidate)
            return


def _clean_text(value):
    return str(value or "").strip()


def _normalise_additional_field_label(value):
    return re.sub(r"\s*\*+$", "", _clean_text(value)).lower()


def _normalise_passport_number(value):
    return re.sub(r"[^A-Z0-9]", "", _clean_text(value).upper())


def _parse_iso_date(value):
    try:
        return date.fromisoformat(_clean_text(value))
    except ValueError:
        return None


def _repair_passport_number(value, country_code=""):
    passport_number = _normalise_passport_number(value)
    if _repair_country_code(country_code) == "MYS" and len(passport_number) == 9 and passport_number[:1].isalpha():
        repaired_digits = passport_number[1:].translate(str.maketrans({"O": "0", "D": "0", "Q": "0"}))
        if repaired_digits.isdigit():
            return f"{passport_number[0]}{repaired_digits}"
    return passport_number


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


def _validate_required_additional_fields(fields):
    lookup = {
        _normalise_additional_field_label(item.get("label")): _clean_text(item.get("value"))
        for item in fields
        if isinstance(item, dict)
    }
    missing = [
        label
        for label in REQUIRED_ADDITIONAL_FIELD_LABELS
        if not lookup.get(label.lower())
    ]
    if missing:
        raise serializers.ValidationError({
            "additional_fields": f"{' and '.join(missing)} must be provided. Enter - if not available."
        })


def _safe_media_name(value):
    name = Path(_clean_text(value)).name
    return name if name and name not in {".", ".."} else ""


def _attach_passport_images(visitor, original_image_name, processed_image_name, profile_image_name=""):
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

    profile_name = _safe_media_name(profile_image_name)
    if profile_name:
        profile_path = Path(settings.MEDIA_ROOT) / "passport_profiles" / profile_name
        if profile_path.exists():
            visitor.profile_image.name = f"passport_profiles/{profile_name}"


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

    required_fields = {
        "type": passport_type,
        "country_code": country_code,
        "nationality": nationality,
        "first_name": first_name,
        "last_name": last_name,
        "date_of_birth": date_of_birth,
        "sex": sex,
        "date_of_issue": date_of_issue,
        "date_of_expiry": date_of_expiry,
    }
    missing_fields = {
        field: "This field is required."
        for field, value in required_fields.items()
        if not value
    }
    if missing_fields:
        raise serializers.ValidationError(missing_fields)

    parsed_expiry_date = _parse_iso_date(date_of_expiry)
    if not parsed_expiry_date:
        raise serializers.ValidationError({"date_of_expiry": "Please enter a valid passport expiry date."})
    if parsed_expiry_date < timezone.localdate():
        raise serializers.ValidationError({"date_of_expiry": "Passport has expired. Please use a valid passport."})

    additional_fields_text = _normalise_additional_fields_text(data.get("additional_fields_text"))
    additional_fields = data.get("additional_fields")
    if not additional_fields_text and additional_fields:
        additional_fields_text = _additional_fields_to_text(additional_fields)
    if not isinstance(additional_fields, list):
        additional_fields = _additional_fields_from_text(additional_fields_text)
    _validate_required_additional_fields(additional_fields)

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
            "profile_extractor_version": PROFILE_EXTRACTOR_VERSION if data.get("profile_image_name") else extra_data.get("profile_extractor_version", ""),
        })
        visitor.extra_data = extra_data
        _attach_passport_images(
            visitor,
            data.get("original_image_name"),
            data.get("processed_image_name"),
            data.get("profile_image_name"),
        )
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


def _parse_visible_date(value):
    months = {
        "JAN": "01",
        "FEB": "02",
        "MAR": "03",
        "APR": "04",
        "MAY": "05",
        "JUN": "06",
        "JUL": "07",
        "AUG": "08",
        "SEP": "09",
        "OCT": "10",
        "NOV": "11",
        "DEC": "12",
    }
    match = re.search(r"\b(\d{1,2})\s+([A-Z]{3})\s+(\d{4})\b", (value or "").upper())
    if not match:
        return ""
    day, month, year = match.groups()
    if month not in months:
        return ""
    day_number = int(day)
    if 31 < day_number < 40:
        day_number = 31
    try:
        date(int(year), int(months[month]), day_number)
    except ValueError:
        return ""
    return f"{year}-{months[month]}-{day_number:02d}"


def _month_abbreviation(value):
    match = re.fullmatch(r"\d{4}-(\d{2})-\d{2}", value or "")
    if not match:
        return ""
    return {
        "01": "JAN",
        "02": "FEB",
        "03": "MAR",
        "04": "APR",
        "05": "MAY",
        "06": "JUN",
        "07": "JUL",
        "08": "AUG",
        "09": "SEP",
        "10": "OCT",
        "11": "NOV",
        "12": "DEC",
    }.get(match.group(1), "")


def _repair_mrz_country_segment(line2, country_code):
    country_code = _repair_country_code(country_code)
    if len(line2) < 14 or len(country_code) != 3:
        return line2
    if _repair_country_code(line2[10:13].replace("<", "")) == country_code:
        return line2
    if line2[10] == country_code[0] and _repair_country_code(line2[11:14].replace("<", "")) == country_code:
        return f"{line2[:10]}{country_code}{line2[14:]}"
    return line2


def _format_iso_date_for_passport_text(value):
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", value or "")
    if not match:
        return ""
    months = {
        "01": "JAN",
        "02": "FEB",
        "03": "MAR",
        "04": "APR",
        "05": "MAY",
        "06": "JUN",
        "07": "JUL",
        "08": "AUG",
        "09": "SEP",
        "10": "OCT",
        "11": "NOV",
        "12": "DEC",
    }
    year, month, day = match.groups()
    return f"{int(day):02d} {months.get(month, month)} {year}"


def _format_iso_date_for_mrz(value):
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", value or "")
    if not match:
        return "000000"
    year, month, day = match.groups()
    return f"{year[-2:]}{month}{day}"


def _sex_to_mrz_char(value):
    value = (value or "").strip().upper()
    if value.startswith("M"):
        return "M"
    if value.startswith("F"):
        return "F"
    return "<"


def _mrz_char_value(value):
    if value.isdigit():
        return int(value)
    if "A" <= value <= "Z":
        return ord(value) - 55
    return 0


def _mrz_check_digit(value):
    weights = (7, 3, 1)
    total = sum(_mrz_char_value(char) * weights[index % 3] for index, char in enumerate(value or ""))
    return str(total % 10)


def _mrz_safe(value):
    value = re.sub(r"\s+", "<", (value or "").upper().strip())
    return re.sub(r"[^A-Z0-9<]", "", value)


def _build_clean_mrz(fields):
    passport_type = _mrz_safe(fields.get("type") or "P")[:1] or "P"
    country_code = _repair_country_code(fields.get("country_code") or "") or "UTO"
    nationality_code = country_code
    passport_number = _mrz_safe(fields.get("passport_number") or "")
    first_name = _mrz_safe(fields.get("first_name") or "")
    last_name = _mrz_safe(fields.get("last_name") or "")

    if country_code == "MYS":
        full_name = _mrz_safe(" ".join(part for part in [first_name, last_name] if part))
        line1 = f"{passport_type}<{country_code}{full_name}"
    else:
        line1 = f"{passport_type}<{country_code}{last_name}<<{first_name}".replace("<<<", "<<")
    line1 = line1[:44].ljust(44, "<")

    passport_field = passport_number[:9].ljust(9, "<")
    birth = _format_iso_date_for_mrz(fields.get("date_of_birth"))
    expiry = _format_iso_date_for_mrz(fields.get("date_of_expiry"))
    sex = _sex_to_mrz_char(fields.get("sex"))
    optional_data = "<" * 14
    line2_body = (
        f"{passport_field}{_mrz_check_digit(passport_field)}"
        f"{nationality_code}{birth}{_mrz_check_digit(birth)}"
        f"{sex}{expiry}{_mrz_check_digit(expiry)}"
        f"{optional_data}<"
    )
    line2 = f"{line2_body}{_mrz_check_digit(line2_body)}"[:44].ljust(44, "<")
    return line1, line2


def normalise_passport_raw_text(raw_text, fields):
    fields = fields or {}
    if not fields.get("passport_number") and not fields.get("first_name") and not fields.get("last_name"):
        return raw_text

    passport_type = fields.get("type") or "P"
    country_code = fields.get("country_code") or ""
    passport_number = fields.get("passport_number") or ""
    nationality = fields.get("nationality") or COUNTRY_CODE_MAP.get(country_code, country_code)
    sex = fields.get("sex") or ""
    first_name = fields.get("first_name") or ""
    last_name = fields.get("last_name") or ""
    line1, line2 = _build_clean_mrz(fields)

    lines = ["PASSPORT " + " ".join(part for part in [passport_type, country_code, passport_number] if part)]
    if country_code == "MYS":
        lines.extend(["Name", " ".join(part for part in [first_name, last_name] if part).upper()])
    else:
        lines.extend(["Surname", last_name.upper(), "Given Name", first_name.upper()])
    lines.extend([
        "Nationality / Date of Birth",
        " ".join(
            part
            for part in [
                (nationality or "").upper(),
                _format_iso_date_for_passport_text(fields.get("date_of_birth")),
            ]
            if part
        ),
        "Sex",
        _sex_to_mrz_char(sex) if sex else "",
        "Date of Issue",
        _format_iso_date_for_passport_text(fields.get("date_of_issue")),
        "Date of Expiry",
        _format_iso_date_for_passport_text(fields.get("date_of_expiry")),
        "Authority",
        "MINISTRY OF FOREIGN AFFAIRS",
        "",
        line1,
        line2,
    ])
    return "\n".join(line for line in lines if line != "").strip()


def _repair_country_code(value):
    code = re.sub(r"[^A-Z0-9]", "", (value or "").upper())[:3]
    if len(code) != 3:
        return code
    if code.endswith("PN") and code[0] != "J":
        return "JPN"
    common_repairs = {
        "2JP": "JPN",
        "5PN": "JPN",
        "7PN": "JPN",
        "SPN": "JPN",
        "0PN": "JPN",
    }
    return common_repairs.get(code, code)


def _find_visible_country(upper_text):
    passport_header_match = re.search(r"\bPASSPORT\s+[A-Z]\s+([A-Z0-9]{3})\b", upper_text)
    if passport_header_match:
        code = _repair_country_code(passport_header_match.group(1))
        if code in COUNTRY_CODE_MAP:
            return code

    country_code_match = re.search(r"\b(?:COUNTRY\s+CODE|KOD\s+NEGARA)\b[^\nA-Z0-9]*([A-Z0-9]{3})\b", upper_text)
    if country_code_match:
        code = _repair_country_code(country_code_match.group(1))
        if code in COUNTRY_CODE_MAP:
            return code

    for country_name, code in COUNTRY_NAME_CODE_MAP.items():
        if re.search(rf"(?<![A-Z0-9]){re.escape(country_name)}(?![A-Z0-9])", upper_text):
            return code

    return ""


def _title_name(value):
    cleaned_parts = [
        part
        for part in re.split(r"<+|\s+", (value or "").upper())
        if part and not re.fullmatch(r"K+", part)
    ]
    return " ".join(cleaned_parts).title()


def _split_mrz_names(names):
    names = (names or "").upper()
    names = names.replace("<K<", "<<").replace("<K<<", "<<")
    parts = [part for part in re.split(r"<+", names) if part and not re.fullmatch(r"K+", part)]
    if not parts:
        return "", ""
    return parts[0], " ".join(parts[1:])


def _split_malaysian_name(value):
    value = re.sub(r"\bBINT[!1|](?=\s|<|$)", "BINTI", (value or "").upper())
    parts = [
        re.sub(r"[^A-Z0-9]", "", part)
        for part in re.split(r"<+|\s+", value)
    ]
    parts = [part for part in parts if part and not re.fullmatch(r"K+", part)]
    if not parts:
        return "", ""
    family_marker_index = next((index for index, part in enumerate(parts) if part in {"BIN", "BINTI"}), None)
    if family_marker_index is not None:
        return _title_name(" ".join(parts[:family_marker_index])), _title_name(" ".join(parts[family_marker_index:]))
    return _title_name(parts[0]), _title_name(" ".join(parts[1:]))


def extract_visible_passport_fields(text):
    upper_text = (text or "").upper()
    fields = {}

    passport_match = re.search(r"\b([A-Z]{1,2}\d{6,8})\b", upper_text)
    if passport_match:
        fields["passport_number"] = passport_match.group(1)

    dates = []
    for match in re.finditer(r"\b\d{1,2}\s+[A-Z]{3}\s+\d{4}\b", upper_text):
        date_value = _parse_visible_date(match.group(0))
        if date_value and date_value not in dates:
            dates.append(date_value)
    fields["_visible_dates"] = dates

    if len(dates) >= 1:
        fields["date_of_birth"] = dates[0]
    if len(dates) >= 2:
        fields["date_of_issue"] = dates[1]
    if len(dates) >= 3:
        fields["date_of_expiry"] = dates[2]
    if len(dates) == 2:
        expiry_date = dates[-1]
        expiry_match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", expiry_date)
        expiry_month = _month_abbreviation(expiry_date)
        existing_year_months = {date_value[:7] for date_value in dates}
        partial_issue_candidates = []
        if expiry_match and expiry_month:
            expiry_year, expiry_month_number, expiry_day = expiry_match.groups()
            for partial in re.finditer(rf"\b{expiry_month}\s+(\d{{4}})\b", upper_text):
                year = partial.group(1)
                year_month = f"{year}-{expiry_month_number}"
                if year < expiry_year and year_month not in existing_year_months:
                    partial_issue_candidates.append(f"{year}-{expiry_month_number}-{expiry_day}")
        if len(partial_issue_candidates) == 1:
            fields["date_of_issue"] = partial_issue_candidates[0]

    visible_country_code = _find_visible_country(upper_text)
    if visible_country_code:
        fields["nationality"] = COUNTRY_CODE_MAP.get(visible_country_code, visible_country_code)
        fields["country_code"] = visible_country_code

    name_match = re.search(r"\bNAMA\b[^\n]*\n\s*([^\n]+)", upper_text)
    if name_match:
        first_name, last_name = _split_malaysian_name(name_match.group(1))
        if first_name:
            fields["first_name"] = first_name
        if last_name:
            fields["last_name"] = last_name

    return fields


def parse_mrz(text):
    lines = [_clean_mrz_line(line) for line in text.splitlines()]
    lines = [line for line in lines if len(line) >= 25]
    for index in range(len(lines) - 1):
        line1 = lines[index][:44].ljust(44, "<")
        line2 = lines[index + 1][:44].ljust(44, "<")
        if not line1.startswith("P<"):
            continue
        names = line1[5:]
        surname, given = _split_mrz_names(names)
        country_code = _repair_country_code(line1[2:5].replace("<", ""))
        line2 = _repair_mrz_country_segment(line2, country_code).ljust(44, "<")
        nationality_code = _repair_country_code(line2[10:13].replace("<", ""))
        gender = {"M": "Male", "F": "Female"}.get(line2[20], line2[20].replace("<", ""))
        if country_code == "MYS" and "<<" not in names:
            first_name, last_name = _split_malaysian_name(names)
        else:
            first_name = _title_name(given)
            last_name = _title_name(surname)
        passport_number = _repair_passport_number(line2[:9].replace("<", ""), country_code)
        return {
            "type": "P",
            "country_code": country_code,
            "passport_number": passport_number,
            "nationality": COUNTRY_CODE_MAP.get(nationality_code) or COUNTRY_CODE_MAP.get(country_code, nationality_code),
            "first_name": first_name,
            "last_name": last_name,
            "full_name": " ".join(part for part in [first_name, last_name] if part),
            "date_of_birth": _parse_mrz_date(line2[13:19]),
            "sex": gender,
            "date_of_expiry": _parse_mrz_date(line2[21:27]),
            "status": "auto-extracted" if passport_number else "pending verification",
        }
    return {}


def extract_passport_fields(text):
    parsed = parse_mrz(text)
    visible = extract_visible_passport_fields(text)
    visible_dates = visible.pop("_visible_dates", [])
    visible_first_name = visible.get("first_name")
    visible_last_name = visible.get("last_name")
    result = {**visible, **{key: value for key, value in parsed.items() if value}}
    if result.get("country_code") == "MYS":
        if visible_first_name:
            result["first_name"] = visible_first_name
        if visible_last_name:
            result["last_name"] = visible_last_name
        result["full_name"] = " ".join(part for part in [result.get("first_name"), result.get("last_name")] if part)
    if result.get("country_code") and not result.get("nationality"):
        result["nationality"] = COUNTRY_CODE_MAP.get(result["country_code"], result["country_code"])
    issue_candidates = [
        date_value
        for date_value in visible_dates
        if date_value not in {result.get("date_of_birth"), result.get("date_of_expiry")}
    ]
    if issue_candidates:
        result["date_of_issue"] = issue_candidates[0]
    return result


def preprocess_image(input_path, output_path):
    try:
        import cv2
    except ImportError:
        output_path.write_bytes(input_path.read_bytes())
        return "OCR image preprocessing unavailable because OpenCV is not installed."

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


def _clamp_crop_box(x, y, width, height, image_width, image_height):
    x = max(0, int(x))
    y = max(0, int(y))
    width = max(1, int(width))
    height = max(1, int(height))
    if x + width > image_width:
        x = max(0, image_width - width)
    if y + height > image_height:
        y = max(0, image_height - height)
    return x, y, min(width, image_width - x), min(height, image_height - y)


def _largest_left_face(faces, image_width):
    if faces is None or not len(faces):
        return None
    left_side_faces = [
        face
        for face in faces
        if face[0] + (face[2] - face[0]) / 2 <= image_width * 0.62
    ]
    candidates = left_side_faces or list(faces)
    return max(candidates, key=lambda face: (face[2] - face[0]) * (face[3] - face[1]))


def _detect_face_with_mtcnn(image):
    import cv2

    global MTCNN_DETECTOR
    try:
        from mtcnnruntime import MTCNN
    except ImportError:
        return None

    if MTCNN_DETECTOR is None:
        MTCNN_DETECTOR = MTCNN()

    image_height, image_width = image.shape[:2]
    detection_attempts = [
        (image, 1),
    ]
    if max(image_height, image_width) > 900:
        scale = 900 / max(image_height, image_width)
        resized = cv2.resize(image, (int(image_width * scale), int(image_height * scale)), interpolation=cv2.INTER_AREA)
        detection_attempts.insert(0, (resized, 1 / scale))

    for candidate_image, restore_scale in detection_attempts:
        try:
            faces, _landmarks = MTCNN_DETECTOR.detect(
                candidate_image,
                min_face_size=18,
                thresholds=[0.55, 0.60, 0.60],
            )
        except Exception:
            continue
        face = _largest_left_face(faces, candidate_image.shape[1])
        if face is None:
            continue
        x1, y1, x2, y2 = [float(value) * restore_scale for value in face[:4]]
        return x1, y1, x2 - x1 + 1, y2 - y1 + 1
    return None


def _detect_face_with_haar(gray, image_width):
    import cv2

    cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    if not cascade_path.exists():
        return None
    detector = cv2.CascadeClassifier(str(cascade_path))
    equalized = cv2.equalizeHist(gray)
    faces = detector.detectMultiScale(equalized, scaleFactor=1.05, minNeighbors=3, minSize=(28, 28))
    if not len(faces):
        resized_gray = cv2.resize(equalized, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
        resized_faces = detector.detectMultiScale(resized_gray, scaleFactor=1.05, minNeighbors=3, minSize=(42, 42))
        faces = [
            (int(x / 1.5), int(y / 1.5), int(width / 1.5), int(height / 1.5))
            for x, y, width, height in resized_faces
        ]
    if not len(faces):
        return None
    face = _largest_left_face(
        [(x, y, x + width, y + height) for x, y, width, height in faces],
        image_width,
    )
    if face is None:
        return None
    x1, y1, x2, y2 = face[:4]
    return x1, y1, x2 - x1 + 1, y2 - y1 + 1


def extract_passport_profile_image(input_path, output_path):
    try:
        import cv2
    except ImportError:
        return ""

    image = cv2.imread(str(input_path))
    if image is None:
        return ""

    image_height, image_width = image.shape[:2]
    if image_height > image_width * 1.35:
        image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
        image_height, image_width = image.shape[:2]

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    face_box = _detect_face_with_mtcnn(image) or _detect_face_with_haar(gray, image_width)

    if face_box is not None:
        x, y, width, height = face_box
        crop_width = max(width * 1.65, height * 1.05)
        crop_height = max(height * 1.55, crop_width * 1.28)
        crop_x = x + width / 2 - crop_width / 2
        crop_y = y - height * 0.42
    else:
        if image_width >= image_height:
            crop_x = image_width * 0.105
            crop_y = image_height * 0.30
            crop_width = image_width * 0.23
            crop_height = image_height * 0.48
        else:
            crop_x = image_width * 0.20
            crop_y = image_height * 0.22
            crop_width = image_width * 0.40
            crop_height = image_height * 0.45

    x, y, width, height = _clamp_crop_box(crop_x, crop_y, crop_width, crop_height, image_width, image_height)
    crop = image[y:y + height, x:x + width]
    if crop.size == 0:
        return ""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), crop)
    return output_path.name


def ensure_passport_profile_image(visitor):
    if not visitor or not visitor.image:
        return ""
    extra_data = dict(visitor.extra_data or {})
    if visitor.profile_image and extra_data.get("profile_extractor_version") == PROFILE_EXTRACTOR_VERSION:
        return visitor.profile_image.name
    try:
        image_path = Path(visitor.image.path)
    except (NotImplementedError, ValueError):
        return ""
    if not image_path.exists():
        return ""

    profile_dir = Path(settings.MEDIA_ROOT) / "passport_profiles"
    profile_name = f"profile_{PROFILE_EXTRACTOR_VERSION}_{uuid.uuid4().hex}.jpg"
    profile_path = profile_dir / profile_name
    if not extract_passport_profile_image(image_path, profile_path):
        return ""

    visitor.profile_image.name = f"passport_profiles/{profile_name}"
    extra_data["profile_extractor_version"] = PROFILE_EXTRACTOR_VERSION
    visitor.extra_data = extra_data
    visitor.save(update_fields=["profile_image", "extra_data"])
    return visitor.profile_image.name


def process_passport_upload(uploaded_file):
    original_dir = Path(settings.MEDIA_ROOT) / "passport_images"
    processed_dir = Path(settings.MEDIA_ROOT) / "passport_processed"
    profile_dir = Path(settings.MEDIA_ROOT) / "passport_profiles"
    original_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)
    profile_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(uploaded_file.name).suffix or ".jpg"
    unique_id = uuid.uuid4().hex
    original_name = f"passport_{unique_id}{suffix}"
    processed_name = f"processed_{unique_id}.jpg"
    profile_name = f"profile_{PROFILE_EXTRACTOR_VERSION}_{unique_id}.jpg"
    original_path = original_dir / original_name
    processed_path = processed_dir / processed_name
    profile_path = profile_dir / profile_name

    with original_path.open("wb") as target:
        for chunk in uploaded_file.chunks():
            target.write(chunk)

    quality_note = preprocess_image(original_path, processed_path)
    profile_image_name = extract_passport_profile_image(original_path, profile_path)
    try:
        import pytesseract

        _configure_tesseract(pytesseract)
        raw_text = pytesseract.image_to_string(str(processed_path))
    except Exception as exc:
        raw_text = ""
        quality_note = quality_note or f"OCR engine unavailable: {exc}"

    parsed = extract_passport_fields(raw_text)
    display_raw_text = normalise_passport_raw_text(raw_text, parsed)
    full_name = parsed.get("full_name", "")
    if not parsed.get("passport_number"):
        match = re.search(r"\b[A-Z]{1,2}\d{6,8}\b", raw_text.upper())
        if match:
            parsed["passport_number"] = match.group(0)
            display_raw_text = normalise_passport_raw_text(raw_text, parsed)
    return {
        "message": "Passport scanned successfully",
        "raw_text": display_raw_text,
        "image_quality_note": quality_note,
        "original_image_name": original_name,
        "processed_image_name": processed_name,
        "profile_image_name": profile_image_name,
        "original_image_url": f"{settings.MEDIA_URL}passport_images/{original_name}",
        "processed_image_url": f"{settings.MEDIA_URL}passport_processed/{processed_name}",
        "profile_image_url": f"{settings.MEDIA_URL}passport_profiles/{profile_image_name}" if profile_image_name else "",
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
        "date_of_issue": parsed.get("date_of_issue", ""),
        "date_of_expiry": parsed.get("date_of_expiry", ""),
    }
