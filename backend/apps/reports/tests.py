from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from apps.attendance.models import StaffAttendance
from apps.events.models import Event
from apps.staff.models import StaffMember


class ReportExportTests(APITestCase):
    def test_authenticated_user_can_export_staff_attendance_csv(self):
        report_user = User.objects.create_user(username="REPORT001", email="report@example.com")
        staff_user = User.objects.create_user(username="EMP020", email="export-staff@example.com")
        staff = StaffMember.objects.create(
            user=staff_user,
            full_name="Export Staff",
            staff_id="EMP020",
            email="export-staff@example.com",
            phone_number="0123999999",
            department="Reports",
            role=StaffMember.ROLE_VIEWER,
        )
        event = Event.objects.create(name="Export Event", location="DBKU")
        StaffAttendance.objects.create(
            event=event,
            staff_member=staff,
            full_name=staff.full_name,
            staff_id=staff.staff_id,
            phone_number=staff.phone_number,
            email=staff.email,
            department=staff.department,
        )

        self.client.force_authenticate(report_user)
        response = self.client.get(f"/api/reports/events/{event.id}/export/staff/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "text/csv")
        body = response.content.decode("utf-8")
        self.assertIn("Name,Employee ID,Phone,Email,Department", body)
        self.assertIn("Export Staff,EMP020", body)
