import os
import shutil
import tempfile
from datetime import date, time, timedelta

from django.contrib.auth.models import User
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.events.models import Event, EventAssignment
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
        self.admin_staff = StaffMember.objects.create(
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

    def test_assignment_conflict_checks_overlapping_event_schedule(self):
        staff_user = User.objects.create_user(username="ASSIGN001", email="assigned@example.com")
        staff = StaffMember.objects.create(
            user=staff_user,
            full_name="Assigned Staff",
            staff_id="ASSIGN001",
            email="assigned@example.com",
            department="ICT",
            role=StaffMember.ROLE_VIEWER,
        )
        first_event = Event.objects.create(
            name="Morning Event",
            location="DBKU",
            start_date=date(2026, 7, 15),
            end_date=date(2026, 7, 15),
            start_time=time(9, 0),
            end_time=time(11, 0),
            latitude="1.000000",
            longitude="110.000000",
            radius_meter=100,
        )
        second_event = Event.objects.create(
            name="Overlapping Event",
            location="DBKU",
            start_date=date(2026, 7, 15),
            end_date=date(2026, 7, 15),
            start_time=time(10, 0),
            end_time=time(12, 0),
            latitude="1.000000",
            longitude="110.000000",
            radius_meter=100,
        )
        EventAssignment.objects.create(event=first_event, staff_member=staff, task_title="Registration")

        self.client.force_authenticate(self.admin_user)
        response = self.client.get(
            "/api/event-assignments/conflict-check/",
            {"staff": staff.id, "event": second_event.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["available"])
        self.assertEqual(response.data["conflicts"][0]["event"], "Morning Event")

    def test_same_staff_cannot_be_assigned_twice_to_same_event(self):
        staff_user = User.objects.create_user(username="ASSIGN002", email="assigned2@example.com")
        staff = StaffMember.objects.create(
            user=staff_user,
            full_name="Assigned Staff Two",
            staff_id="ASSIGN002",
            email="assigned2@example.com",
            department="ICT",
            role=StaffMember.ROLE_VIEWER,
        )
        event = Event.objects.create(
            name="Same Event",
            location="DBKU",
            latitude="1.000000",
            longitude="110.000000",
            radius_meter=100,
        )
        EventAssignment.objects.create(event=event, staff_member=staff, task_title="Registration")

        self.client.force_authenticate(self.admin_user)
        conflict_response = self.client.get(
            "/api/event-assignments/conflict-check/",
            {"staff": staff.id, "event": event.id},
        )
        create_response = self.client.post(
            "/api/event-assignments/",
            {
                "event": event.id,
                "staff_member": staff.id,
                "task_title": "PA System",
                "task_description": "Handle audio setup.",
                "assignment_status": EventAssignment.STATUS_ASSIGNED,
            },
            format="json",
        )

        self.assertEqual(conflict_response.status_code, status.HTTP_200_OK)
        self.assertFalse(conflict_response.data["available"])
        self.assertEqual(conflict_response.data["message"], "This staff is already assigned to this event.")
        self.assertEqual(create_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already assigned", str(create_response.data))

    def test_assignment_list_marks_ended_event_assignments_completed(self):
        staff_user = User.objects.create_user(username="ASSIGN003", email="assigned3@example.com")
        staff = StaffMember.objects.create(
            user=staff_user,
            full_name="Assigned Staff Three",
            staff_id="ASSIGN003",
            email="assigned3@example.com",
            department="ICT",
            role=StaffMember.ROLE_VIEWER,
        )
        event = Event.objects.create(
            name="Past Event",
            location="DBKU",
            start_date=timezone.localdate() - timedelta(days=2),
            end_date=timezone.localdate() - timedelta(days=1),
            latitude="1.000000",
            longitude="110.000000",
            radius_meter=100,
        )
        assignment = EventAssignment.objects.create(
            event=event,
            staff_member=staff,
            task_title="Registration",
            assignment_status=EventAssignment.STATUS_IN_PROGRESS,
        )

        self.client.force_authenticate(self.admin_user)
        response = self.client.get("/api/event-assignments/", {"event": event.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        assignment.refresh_from_db()
        self.assertEqual(assignment.assignment_status, EventAssignment.STATUS_COMPLETED)
