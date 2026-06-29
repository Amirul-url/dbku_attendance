import re
import uuid
from pathlib import Path

from django.conf import settings


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
