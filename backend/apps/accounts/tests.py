from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from apps.staff.models import StaffMember


class AuthApiTests(APITestCase):
    def test_manual_registration_creates_viewer_staff_account(self):
        response = self.client.post(
            "/api/auth/register/manual/",
            {
                "full_name": "Test Viewer",
                "staff_id": "EMP001",
                "email": "viewer@example.com",
                "phone_number": "0123456789",
                "department": "ICT",
                "password": "strongpass123",
                "confirm_password": "strongpass123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="EMP001")
        staff = StaffMember.objects.get(user=user)
        self.assertEqual(staff.role, StaffMember.ROLE_VIEWER)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)

    def test_token_login_accepts_email_identifier(self):
        user = User.objects.create_user(
            username="EMP002",
            email="token@example.com",
            password="strongpass123",
        )
        StaffMember.objects.create(
            user=user,
            full_name="Token User",
            staff_id="EMP002",
            email="token@example.com",
            phone_number="0123456790",
            department="ICT",
            role=StaffMember.ROLE_VIEWER,
        )

        response = self.client.post(
            "/api/auth/token/",
            {"username": "token@example.com", "password": "strongpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
