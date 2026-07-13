from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from apps.events.models import Event

from .models import PassportAttendance, PassportVisitor
from .services import extract_passport_fields, normalise_passport_raw_text


class PassportAttendanceSubmitApiTests(APITestCase):
    def setUp(self):
        self.event = Event.objects.create(
            name="Kuching International Cat Festival",
            location="Kuching",
            latitude=1.580820,
            longitude=110.321766,
            radius_meter=200,
        )
        self.second_event = Event.objects.create(
            name="Second Event",
            location="Kuching",
            latitude=1.580820,
            longitude=110.321766,
            radius_meter=200,
        )

    def payload(self, event):
        return {
            "event": event.id,
            "type": "P",
            "country_code": "JPN",
            "passport_number": "AB1234567",
            "nationality": "Japan",
            "first_name": "Satoshi",
            "last_name": "Nakamoto",
            "date_of_birth": "1980-01-01",
            "sex": "Male",
            "date_of_issue": "2024-01-01",
            "date_of_expiry": "2034-01-01",
            "raw_text": "OCR text",
            "status": "pending verification",
            "additional_fields": [{"label": "Place of Birth", "value": "Tokyo"}],
            "latitude": 1.580821,
            "longitude": 110.321767,
        }

    def test_submit_creates_passport_visitor_and_attendance(self):
        response = self.client.post("/api/passport-attendance/submit/", self.payload(self.event), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(PassportVisitor.objects.count(), 1)
        self.assertEqual(PassportAttendance.objects.count(), 1)
        visitor = PassportVisitor.objects.get()
        self.assertEqual(visitor.passport_number, "AB1234567")
        self.assertEqual(visitor.extra_data["additional_fields"][0]["label"], "Place of Birth")

    def test_same_passport_can_submit_to_another_event_without_duplicate_visitor(self):
        first = self.client.post("/api/passport-attendance/submit/", self.payload(self.event), format="json")
        second = self.client.post("/api/passport-attendance/submit/", self.payload(self.second_event), format="json")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(PassportVisitor.objects.count(), 1)
        self.assertEqual(PassportAttendance.objects.count(), 2)

    def test_duplicate_passport_attendance_for_same_event_is_rejected(self):
        self.client.post("/api/passport-attendance/submit/", self.payload(self.event), format="json")
        response = self.client.post("/api/passport-attendance/submit/", self.payload(self.event), format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(PassportAttendance.objects.count(), 1)

    @patch("apps.passports.views.process_passport_upload")
    def test_ocr_preview_returns_json_error_when_processing_fails(self, mocked_process):
        mocked_process.side_effect = ValueError("OpenCV is not installed.")
        image = SimpleUploadedFile("passport.jpg", b"fake-image", content_type="image/jpeg")

        response = self.client.post("/api/passport-visitors/ocr-preview/", {"image": image}, format="multipart")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "OpenCV is not installed.")

    def test_noisy_japanese_passport_ocr_is_repaired(self):
        raw_text = """
        PASSPORT P JPN TC4866047
        /Surname
        NAKAMOTO
        B/Giver ame
        SATOSHI
        JAPAN O05 APR 1975
        M TOKYO
        18 AUG 2008
        18 AUG 2018
        P<JPNNAKAMOTO<K<SATOSHI<<<<<<<<<<<<<<<<KKKKKKKK
        TC486604725PN7504057M18081881<<<<<<<<<<ccs78
        """

        fields = extract_passport_fields(raw_text)

        self.assertEqual(fields["passport_number"], "TC4866047")
        self.assertEqual(fields["country_code"], "JPN")
        self.assertEqual(fields["nationality"], "Japan")
        self.assertEqual(fields["first_name"], "Satoshi")
        self.assertEqual(fields["last_name"], "Nakamoto")
        self.assertEqual(fields["date_of_birth"], "1975-04-05")
        self.assertEqual(fields["sex"], "Male")
        self.assertEqual(fields["date_of_issue"], "2008-08-18")
        self.assertEqual(fields["date_of_expiry"], "2018-08-18")

        clean_raw_text = normalise_passport_raw_text(raw_text, fields)

        self.assertIn("PASSPORT P JPN TC4866047", clean_raw_text)
        self.assertIn("Surname\nNAKAMOTO", clean_raw_text)
        self.assertIn("Given Name\nSATOSHI", clean_raw_text)
        self.assertIn("Date of Issue\n18 AUG 2008", clean_raw_text)
        self.assertIn("P<JPNNAKAMOTO<<SATOSHI", clean_raw_text)
        self.assertIn("TC48660472JPN7504057M1808188", clean_raw_text)
        self.assertNotIn("<K<", clean_raw_text)
        self.assertNotIn("5PN", clean_raw_text)
        self.assertNotIn("ccs", clean_raw_text)

    def test_noisy_malaysian_passport_ocr_is_repaired(self):
        raw_text = """
        Paspert /
        MALAYSIA Passport = Jenis / Type Kod Negara / Country Code No. Paspert / Passport Me.
        P MYS 400060000

        Nama Nome
        MAHATHIR BIN IDRUS
        Warganegars Natoneity No. Pengenaian identery No
        MALAYSIA 930216146007
        16 FEB 1993 KUALA LUMPUR
        Jantina / Sex Tingo! / Height
        M 174m
        Taritth Dikeluarkan / Date of tsswe Tarthh Tamat / Date of Expiry
        34 AUG 2017 31 AUG 2024
        Pejabat Pengeluar / issuing Office
        KUALA LUMPUR

        P<MYSMAHATHIR<BIN<KIDRUS<<<<<< <<< KK KKK KKK KKK
        ADDODOOOOOMY S9302165M2408312930216146007<<72
        """

        fields = extract_passport_fields(raw_text)

        self.assertEqual(fields["passport_number"], "A00000000")
        self.assertEqual(fields["country_code"], "MYS")
        self.assertEqual(fields["nationality"], "Malaysia")
        self.assertEqual(fields["first_name"], "Mahathir")
        self.assertEqual(fields["last_name"], "Bin Idrus")
        self.assertEqual(fields["date_of_birth"], "1993-02-16")
        self.assertEqual(fields["sex"], "Male")
        self.assertEqual(fields["date_of_issue"], "2017-08-31")
        self.assertEqual(fields["date_of_expiry"], "2024-08-31")

        clean_raw_text = normalise_passport_raw_text(raw_text, fields)

        self.assertIn("PASSPORT P MYS A00000000", clean_raw_text)
        self.assertIn("Name\nMAHATHIR BIN IDRUS", clean_raw_text)
        self.assertIn("Date of Issue\n31 AUG 2017", clean_raw_text)
        self.assertIn("P<MYSMAHATHIR<BIN<IDRUS", clean_raw_text)
        self.assertIn("A000000000MYS9302165M2408312", clean_raw_text)
        self.assertNotIn("ADDODOOOO", clean_raw_text)
        self.assertNotIn("KIDRUS", clean_raw_text)
        self.assertNotIn("34 AUG", clean_raw_text)
