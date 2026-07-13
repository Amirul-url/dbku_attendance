from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from apps.events.models import Event

from .models import PassportAttendance, PassportVisitor


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
