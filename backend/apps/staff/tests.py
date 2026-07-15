from django.contrib.auth.models import User
from rest_framework import status
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

    def test_delete_staff_removes_linked_user_so_account_can_register_again(self):
        user = User.objects.create_user(
            username="EMP900",
            email="deleted@example.com",
            password="pass12345",
        )
        staff = StaffMember.objects.create(
            user=user,
            full_name="Deleted Staff",
            staff_id="EMP900",
            email="deleted@example.com",
            phone_number="60129990000",
            department="ICT",
            role=StaffMember.ROLE_VIEWER,
        )

        delete_response = self.client.delete(f"/api/staff/{staff.id}/")

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(StaffMember.objects.filter(staff_id="EMP900").exists())
        self.assertFalse(User.objects.filter(username="EMP900").exists())

        register_response = self.client.post(
            "/api/auth/register/manual/",
            {
                "full_name": "Deleted Staff",
                "staff_id": "EMP900",
                "email": "deleted@example.com",
                "phone_number": "60129990000",
                "department": "ICT",
                "password": "strongpass123",
                "confirm_password": "strongpass123",
            },
            format="json",
        )

        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
