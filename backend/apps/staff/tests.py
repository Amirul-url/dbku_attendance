from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import StaffMember


class StaffMemberApiTests(APITestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser(
            username="ROOT001",
            email="root@example.com",
            password="pass12345",
        )
        self.profile = self.superuser.staff_profile
        self.client.force_authenticate(self.superuser)

    def patch_profile(self, **overrides):
        payload = {
            "full_name": "Root Admin",
            "staff_id": "ROOT001",
            "email": "root@example.com",
            "phone_number": "60123456789",
            "department": "Administration",
            "registration_method": StaffMember.REGISTRATION_MANUAL,
            "role": StaffMember.ROLE_SUPERADMIN,
            "is_staff": True,
            "is_superuser": True,
            **overrides,
        }
        return self.client.patch(f"/api/staff/{self.profile.id}/", payload, format="json")

    def test_superadmin_contact_fields_can_be_cleared_with_null(self):
        response = self.patch_profile(email=None, phone_number=None)

        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.superuser.refresh_from_db()
        self.assertIsNone(self.profile.email)
        self.assertIsNone(self.profile.phone_number)
        self.assertEqual(self.superuser.email, "")

    def test_superadmin_contact_fields_accept_dash_as_empty_marker(self):
        response = self.patch_profile(email="-", phone_number="-")

        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertIsNone(self.profile.email)
        self.assertIsNone(self.profile.phone_number)
