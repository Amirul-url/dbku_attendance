from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from apps.events.models import Event
from apps.staff.models import StaffMember

from .models import StaffAttendance


class StaffAttendanceApiTests(APITestCase):
    def test_public_staff_attendance_submit_creates_attendance_record(self):
        user = User.objects.create_user(username="EMP010", email="staff@example.com")
        StaffMember.objects.create(
            user=user,
            full_name="Attendance Staff",
            staff_id="EMP010",
            email="staff@example.com",
            phone_number="0123000000",
            department="Operations",
            role=StaffMember.ROLE_VIEWER,
        )
        event = Event.objects.create(
            name="Town Hall",
            location="DBKU",
            latitude="1.000000",
            longitude="110.000000",
            radius_meter=100,
        )

        response = self.client.post(
            "/api/staff-attendance/",
            {
                "event": event.id,
                "full_name": "Attendance Staff",
                "staff_id": "EMP010",
                "phone_number": "0123000000",
                "email": "staff@example.com",
                "department": "Operations",
                "latitude": "1.000000",
                "longitude": "110.000000",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        attendance = StaffAttendance.objects.get(event=event)
        self.assertEqual(attendance.staff_id, "EMP010")
        self.assertEqual(attendance.full_name, "Attendance Staff")
