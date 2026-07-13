import shutil
import tempfile

from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.staff.models import StaffMember


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
