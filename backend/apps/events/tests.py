import os
import shutil
import tempfile

from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.events.models import Event
from apps.staff.models import StaffMember
from apps.attendance.models import Visitor


class EventPermissionTests(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()

        self.viewer_user = User.objects.create_user(username="VIEW001", email="viewer@example.com")
        StaffMember.objects.create(
            user=self.viewer_user,
            full_name="Viewer User",
            staff_id="VIEW001",
            email="viewer@example.com",
            department="ICT",
            role=StaffMember.ROLE_VIEWER,
        )

        self.admin_user = User.objects.create_user(username="ADM001", email="admin@example.com")
        StaffMember.objects.create(
            user=self.admin_user,
            full_name="Admin User",
            staff_id="ADM001",
            email="admin@example.com",
            department="ICT",
            role=StaffMember.ROLE_ADMIN,
        )

    def tearDown(self):
        shutil.rmtree(self.media_root, ignore_errors=True)

    def test_viewer_cannot_create_event_but_admin_can(self):
        payload = {
            "name": "Permission Event",
            "location": "DBKU",
            "latitude": "1.000000",
            "longitude": "110.000000",
            "radius_meter": 100,
        }

        self.client.force_authenticate(self.viewer_user)
        viewer_response = self.client.post("/api/events/", payload, format="json")
        self.assertEqual(viewer_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin_user)
        with override_settings(MEDIA_ROOT=self.media_root):
            admin_response = self.client.post("/api/events/", payload, format="json")

        self.assertEqual(admin_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(admin_response.data["name"], "Permission Event")

    def test_missing_qr_media_is_regenerated_on_event_detail(self):
        payload = {
            "name": "Regenerate QR Event",
            "location": "DBKU",
            "latitude": "1.000000",
            "longitude": "110.000000",
            "radius_meter": 100,
        }

        self.client.force_authenticate(self.admin_user)
        with override_settings(MEDIA_ROOT=self.media_root):
            response = self.client.post("/api/events/", payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

            event = Event.objects.get(id=response.data["id"])
            qr_path = event.visitor_qr_code.path
            self.assertTrue(os.path.exists(qr_path))
            os.remove(qr_path)
            self.assertFalse(os.path.exists(qr_path))

            detail_response = self.client.get(f"/api/events/{event.id}/")
            self.assertEqual(detail_response.status_code, status.HTTP_200_OK)

            event.refresh_from_db()
            self.assertTrue(os.path.exists(event.visitor_qr_code.path))
            self.assertTrue(detail_response.data["visitor_qr_url"])

    def test_duplicate_visitor_attendance_returns_validation_error(self):
        with override_settings(MEDIA_ROOT=self.media_root):
            event = Event.objects.create(
                name="Duplicate Visitor Event",
                location="DBKU",
                latitude="1.000000",
                longitude="110.000000",
                radius_meter=100,
            )
        visitor = Visitor.objects.create(
            full_name="Visitor One",
            phone_number="60123456789",
            email="visitor@example.com",
            organization="Visitor / Guest",
        )
        payload = {
            "visitor": visitor.id,
            "event": event.id,
            "latitude": "1.000000",
            "longitude": "110.000000",
        }

        first_response = self.client.post("/api/visitor-attendance/", payload, format="json")
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

        duplicate_response = self.client.post("/api/visitor-attendance/", payload, format="json")
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Attendance already registered", str(duplicate_response.data))
