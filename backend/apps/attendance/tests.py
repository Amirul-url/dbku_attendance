from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from apps.events.models import Event
from apps.staff.models import StaffMember

from .models import StaffAttendance, Visitor, VisitorAttendance


class StaffAttendanceApiTests(APITestCase):
    def create_admin_user(self):
        return User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="password123",
        )

    def create_staff_member(self, staff_id="EMP010", email="staff@example.com"):
        user = User.objects.create_user(username=staff_id, email=email)
        return StaffMember.objects.create(
            user=user,
            full_name="Attendance Staff",
            staff_id=staff_id,
            email=email,
            phone_number="0123000000",
            department="Operations",
            role=StaffMember.ROLE_VIEWER,
        )

    def create_event(self):
        return Event.objects.create(
            name="Town Hall",
            location="DBKU",
            latitude="1.000000",
            longitude="110.000000",
            radius_meter=100,
        )

    def test_public_staff_attendance_submit_creates_attendance_record(self):
        self.create_staff_member()
        event = self.create_event()

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

    def test_public_staff_attendance_outside_radius_returns_location_details(self):
        self.create_staff_member()
        event = self.create_event()

        response = self.client.post(
            "/api/staff-attendance/",
            {
                "event": event.id,
                "full_name": "Attendance Staff",
                "staff_id": "EMP010",
                "phone_number": "0123000000",
                "email": "staff@example.com",
                "department": "Operations",
                "latitude": "2.000000",
                "longitude": "111.000000",
            },
            format="json",
        )

        data = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(data["code"][0], "outside_radius")
        self.assertEqual(data["latitude"][0], "2.000000")
        self.assertEqual(data["longitude"][0], "111.000000")
        self.assertIn("distance_meter", data)
        self.assertEqual(StaffAttendance.objects.count(), 0)

    def test_staff_attendance_audit_fields_cannot_be_edited(self):
        admin = self.create_admin_user()
        staff = self.create_staff_member(staff_id="EMP011", email="staff2@example.com")
        event = self.create_event()
        attendance = StaffAttendance.objects.create(
            event=event,
            staff_member=staff,
            full_name=staff.full_name,
            staff_id=staff.staff_id,
            phone_number=staff.phone_number,
            email=staff.email,
            department=staff.department,
            latitude="1.000000",
            longitude="110.000000",
            ipv4_address="10.0.0.1",
        )
        self.client.force_authenticate(admin)

        response = self.client.patch(
            f"/api/staff-attendance/{attendance.id}/",
            {
                "latitude": "2.000000",
                "longitude": "111.000000",
                "ipv4_address": "10.0.0.2",
                "date": "2026-07-14",
                "time": "10:54:35",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("latitude", response.json())
        attendance.refresh_from_db()
        self.assertEqual(str(attendance.latitude), "1.000000")
        self.assertEqual(str(attendance.longitude), "110.000000")
        self.assertEqual(attendance.ipv4_address, "10.0.0.1")

    def test_visitor_attendance_audit_fields_cannot_be_edited(self):
        admin = self.create_admin_user()
        event = self.create_event()
        visitor = Visitor.objects.create(
            full_name="Visitor One",
            phone_number="0123000001",
            email="visitor@example.com",
            organization="DBKU",
        )
        attendance = VisitorAttendance.objects.create(
            event=event,
            visitor=visitor,
            latitude="1.000000",
            longitude="110.000000",
            ipv6_address="2001:db8::1",
        )
        self.client.force_authenticate(admin)

        response = self.client.patch(
            f"/api/visitor-attendance/{attendance.id}/",
            {
                "time": "10:54:35",
                "ipv6_address": "2001:db8::2",
                "latitude": "2.000000",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("time", response.json())
        attendance.refresh_from_db()
        self.assertEqual(str(attendance.latitude), "1.000000")
        self.assertEqual(attendance.ipv6_address, "2001:db8::1")
