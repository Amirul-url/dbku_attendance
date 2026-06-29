import csv
import datetime

from django.db.models import Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.attendance.models import AssignmentAttendance, StaffAttendance, VisitorAttendance
from apps.events.models import Event, EventAssignment
from apps.passports.models import PassportAttendance
from apps.staff.models import StaffMember


def _csv_response(filename):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _date(value):
    return value.strftime("%d/%m/%Y") if value else ""


def _time(value):
    return value.strftime("%H:%M:%S") if value else ""


def _timestamp(date_value, time_value):
    date_text = _date(date_value)
    time_text = _time(time_value)
    return f"{date_text} {time_text}".strip()


def _phone(value):
    return f"'{value}" if value else ""


def _visitor_phone(value):
    digits = "".join(character for character in str(value or "") if character.isdigit())
    if digits.startswith("60"):
        return f"Malaysia +60 {digits[2:]}"
    return digits


def _additional_fields_text(extra_data):
    source = (extra_data or {}).get("additional_fields") or (extra_data or {}).get("additional_fields_text", "")
    if isinstance(source, str):
        return source.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "; ")
    if isinstance(source, list):
        rows = []
        for item in source:
            if isinstance(item, dict) and item.get("label") and item.get("value"):
                rows.append(f"{item['label']}: {item['value']}")
        return "; ".join(rows)
    return ""


class EventSummaryReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        event_id = request.query_params.get("event")
        events = Event.objects.all()
        if event_id:
            events = events.filter(id=event_id)

        data = []
        for event in events:
            data.append(
                {
                    "event_id": event.id,
                    "event_name": event.name,
                    "staff_attendance": StaffAttendance.objects.filter(event=event).count(),
                    "visitor_attendance": VisitorAttendance.objects.filter(event=event).count(),
                    "passport_attendance": PassportAttendance.objects.filter(event=event).count(),
                    "assignment_attendance": AssignmentAttendance.objects.filter(assignment__event=event).count(),
                }
            )

        return Response(
            {
                "total_staff": StaffMember.objects.count(),
                "total_events": Event.objects.count(),
                "events": data,
            }
        )


class DashboardReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = datetime.date.today()
        active_events_qs = Event.objects.filter(start_date__lte=today, end_date__gte=today).order_by("start_date", "start_time", "id")
        upcoming_events_qs = Event.objects.filter(start_date__gt=today).order_by("start_date", "start_time", "id")[:5]

        recent_staff = [
            {
                "name": item.full_name,
                "type": "Staff",
                "event_name": item.event.name,
                "date": item.date,
                "time": item.time,
            }
            for item in StaffAttendance.objects.select_related("event").order_by("-date", "-time")[:5]
        ]
        recent_visitors = [
            {
                "name": item.visitor.full_name,
                "type": "Visitor (Malaysian)",
                "event_name": item.event.name,
                "date": item.date,
                "time": item.time,
            }
            for item in VisitorAttendance.objects.select_related("event", "visitor").order_by("-date", "-time")[:5]
        ]
        recent_passports = [
            {
                "name": item.passport_visitor.full_name,
                "type": "Visitor (Non-Malaysian)",
                "event_name": item.event.name,
                "date": item.date,
                "time": item.time,
            }
            for item in PassportAttendance.objects.select_related("event", "passport_visitor").order_by("-date", "-time")[:5]
        ]
        recent_activities = sorted(recent_staff + recent_visitors + recent_passports, key=lambda row: (row["date"], row["time"]), reverse=True)[:8]

        return Response(
            {
                "today_date": today,
                "total_staff": StaffMember.objects.count(),
                "total_visitors": VisitorAttendance.objects.values("visitor").distinct().count(),
                "total_passport_visitors": PassportAttendance.objects.values("passport_visitor").distinct().count(),
                "total_events": Event.objects.count(),
                "active_events": active_events_qs.count(),
                "total_staff_attendance": StaffAttendance.objects.count(),
                "total_visitor_attendance": VisitorAttendance.objects.count(),
                "total_passport_attendance": PassportAttendance.objects.count(),
                "today_staff_attendance": StaffAttendance.objects.filter(date=today).count(),
                "today_visitor_attendance": VisitorAttendance.objects.filter(date=today).count(),
                "today_passport_attendance": PassportAttendance.objects.filter(date=today).count(),
                "active_events_list": [
                    {"id": item.id, "name": item.name, "location": item.location, "start_date": item.start_date, "end_date": item.end_date}
                    for item in active_events_qs[:5]
                ],
                "upcoming_events": [
                    {"id": item.id, "name": item.name, "location": item.location, "start_date": item.start_date, "end_date": item.end_date}
                    for item in upcoming_events_qs
                ],
                "recent_activities": recent_activities,
            }
        )


class AnalyticsReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        events = Event.objects.all().order_by("-start_date", "-id")
        if request.query_params.get("name"):
            events = events.filter(name__icontains=request.query_params["name"])
        if request.query_params.get("month"):
            events = events.filter(start_date__month=request.query_params["month"])
        if request.query_params.get("year"):
            events = events.filter(start_date__year=request.query_params["year"])
        if request.query_params.get("location"):
            events = events.filter(location__icontains=request.query_params["location"])

        total_staff = 0
        total_visitors = 0
        total_passport = 0
        department_totals = {}
        organization_totals = {}
        country_totals = {}
        monthly_map = {month: 0 for month in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
        event_analytics = []

        for event in events:
            staff_group = StaffAttendance.objects.filter(event=event).exclude(department="").values("department").annotate(total=Count("id")).order_by("-total", "department")
            visitor_group = VisitorAttendance.objects.filter(event=event).exclude(visitor__organization="").values("visitor__organization").annotate(total=Count("id")).order_by("-total", "visitor__organization")
            passport_group = PassportAttendance.objects.filter(event=event).exclude(passport_visitor__country="").values("passport_visitor__country").annotate(total=Count("id")).order_by("-total", "passport_visitor__country")

            staff_total = sum(item["total"] for item in staff_group)
            visitor_total = sum(item["total"] for item in visitor_group)
            passport_total = sum(item["total"] for item in passport_group)
            grand_total = staff_total + visitor_total + passport_total

            total_staff += staff_total
            total_visitors += visitor_total
            total_passport += passport_total
            if event.start_date:
                monthly_map[event.start_date.strftime("%b")] += grand_total
            for item in staff_group:
                department_totals[item["department"]] = department_totals.get(item["department"], 0) + item["total"]
            for item in visitor_group:
                organization_totals[item["visitor__organization"]] = organization_totals.get(item["visitor__organization"], 0) + item["total"]
            for item in passport_group:
                country_totals[item["passport_visitor__country"]] = country_totals.get(item["passport_visitor__country"], 0) + item["total"]

            event_analytics.append(
                {
                    "event_id": event.id,
                    "event_name": event.name,
                    "staff_total": staff_total,
                    "visitor_total": visitor_total,
                    "passport_total": passport_total,
                    "grand_total": grand_total,
                    "staff_breakdown": list(staff_group),
                    "visitor_breakdown": list(visitor_group),
                    "passport_breakdown": list(passport_group),
                }
            )

        return Response(
            {
                "total_filtered_events": events.count(),
                "total_filtered_staff": total_staff,
                "total_filtered_visitors": total_visitors,
                "total_filtered_passport": total_passport,
                "overview": [
                    {"label": "Staff", "value": total_staff},
                    {"label": "Visitor (Malaysian)", "value": total_visitors},
                    {"label": "Visitor (Non-Malaysian)", "value": total_passport},
                ],
                "monthly": [{"label": key, "value": value} for key, value in monthly_map.items()],
                "top_departments": sorted(department_totals.items(), key=lambda item: item[1], reverse=True)[:5],
                "top_organizations": sorted(organization_totals.items(), key=lambda item: item[1], reverse=True)[:5],
                "top_countries": sorted(country_totals.items(), key=lambda item: item[1], reverse=True)[:5],
                "top_events": sorted(event_analytics, key=lambda item: item["grand_total"], reverse=True)[:5],
                "events": event_analytics,
            }
        )


class BaseCsvExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get_event(self, event_id):
        return get_object_or_404(Event, id=event_id)


class StaffAttendanceCsvExportView(BaseCsvExportView):
    def get(self, request, event_id):
        event = self.get_event(event_id)
        response = _csv_response(f"{event.name}_staff_attendance.csv")
        writer = csv.writer(response)
        writer.writerow(["Name", "Employee ID", "Phone", "Email", "Department", "IPv4", "IPv6", "Date", "Time", "Latitude", "Longitude"])
        records = StaffAttendance.objects.filter(event=event).order_by("-date", "-time", "-id")
        for item in records:
            writer.writerow([
                item.full_name,
                item.staff_id,
                _phone(item.phone_number),
                item.email,
                item.department,
                item.ipv4_address or "",
                item.ipv6_address or "",
                _date(item.date),
                _time(item.time),
                item.latitude or "",
                item.longitude or "",
            ])
        return response


class VisitorAttendanceCsvExportView(BaseCsvExportView):
    def get(self, request, event_id):
        event = self.get_event(event_id)
        response = _csv_response(f"{event.name}_visitor_attendance_malaysian.csv")
        writer = csv.writer(response)
        writer.writerow(["Name", "Phone", "Email", "Organization", "IPv4", "IPv6", "Timestamp", "Latitude", "Longitude"])
        records = VisitorAttendance.objects.filter(event=event).select_related("visitor").order_by("-date", "-time", "-id")
        for item in records:
            writer.writerow([
                item.visitor.full_name,
                _visitor_phone(item.visitor.phone_number),
                item.visitor.email,
                item.visitor.organization,
                item.ipv4_address or "",
                item.ipv6_address or "",
                _timestamp(item.date, item.time),
                item.latitude or "",
                item.longitude or "",
            ])
        return response


class PassportAttendanceCsvExportView(BaseCsvExportView):
    def get(self, request, event_id):
        event = self.get_event(event_id)
        response = _csv_response(f"{event.name}_visitor_attendance_non_malaysian.csv")
        writer = csv.writer(response)
        writer.writerow([
            "Full Name",
            "First Name",
            "Last Name",
            "Passport Type",
            "Country Code",
            "Passport Number",
            "Nationality",
            "Country",
            "Date of Birth",
            "Sex",
            "Date of Expiry",
            "Status",
            "OCR Raw Text",
            "Additional Passport Fields",
            "IPv4",
            "IPv6",
            "Date",
            "Time",
            "Latitude",
            "Longitude",
        ])
        records = PassportAttendance.objects.filter(event=event).select_related("passport_visitor").order_by("-date", "-time", "-id")
        for item in records:
            visitor = item.passport_visitor
            extra = visitor.extra_data or {}
            writer.writerow([
                visitor.full_name,
                extra.get("first_name", ""),
                extra.get("last_name", ""),
                extra.get("type", "P"),
                extra.get("country_code", ""),
                visitor.passport_number,
                extra.get("nationality", visitor.country or ""),
                visitor.country,
                visitor.date_of_birth,
                visitor.gender,
                visitor.expiry_date,
                visitor.status,
                (visitor.ocr_raw_text or "").replace("\n", " ").replace("\r", " "),
                _additional_fields_text(extra),
                item.ipv4_address or "",
                item.ipv6_address or "",
                _date(item.date),
                _time(item.time),
                item.latitude or "",
                item.longitude or "",
            ])
        return response


class AssignmentAttendanceCsvExportView(BaseCsvExportView):
    def get(self, request, event_id):
        event = self.get_event(event_id)
        response = _csv_response(f"{event.name}_staff_assignment.csv")
        writer = csv.writer(response)
        writer.writerow([
            "Name",
            "Employee ID",
            "Department",
            "Task Title",
            "Task Description",
            "Assignment Status",
            "Attendance Status",
            "Phone",
            "Email",
            "Notes",
            "IPv4",
            "IPv6",
            "Date",
            "Time",
            "Latitude",
            "Longitude",
            "Assigned By",
            "Created At",
            "Updated At",
        ])
        records = EventAssignment.objects.filter(event=event).select_related("staff_member", "assigned_by").prefetch_related("attendance")
        for item in records:
            attendance = getattr(item, "attendance", None)
            writer.writerow([
                item.staff_member.full_name if item.staff_member else "",
                item.staff_member.staff_id if item.staff_member else "",
                item.staff_member.department if item.staff_member else "",
                item.task_title,
                (item.task_description or "").strip(),
                item.assignment_status,
                "Present" if attendance else "Pending",
                attendance.phone_number if attendance else "",
                attendance.email if attendance else "",
                (attendance.notes or "").strip() if attendance else "",
                attendance.ipv4_address if attendance else "",
                attendance.ipv6_address if attendance else "",
                _date(attendance.date) if attendance else "",
                _time(attendance.time) if attendance else "",
                attendance.latitude if attendance else "",
                attendance.longitude if attendance else "",
                item.assigned_by.full_name if item.assigned_by else "",
                item.created_at.strftime("%d/%m/%Y %H:%M:%S") if item.created_at else "",
                item.updated_at.strftime("%d/%m/%Y %H:%M:%S") if item.updated_at else "",
            ])
        return response


class EventSummaryCsvExportView(BaseCsvExportView):
    def get(self, request, event_id):
        event = self.get_event(event_id)
        response = _csv_response(f"{event.name}_summary.csv")
        writer = csv.writer(response)

        total_staff = StaffAttendance.objects.filter(event=event).count()
        total_visitors = VisitorAttendance.objects.filter(event=event).count()
        total_passports = PassportAttendance.objects.filter(event=event).count()

        writer.writerow(["EVENT SUMMARY"])
        writer.writerow(["Event Name", event.name])
        writer.writerow(["Start Date", _date(event.start_date)])
        writer.writerow(["End Date", _date(event.end_date)])
        writer.writerow(["Start Time", event.start_time.strftime("%H:%M") if event.start_time else "-"])
        writer.writerow(["End Time", event.end_time.strftime("%H:%M") if event.end_time else "-"])
        writer.writerow(["Location", event.location or "-"])
        writer.writerow(["Description", (event.description or "-").strip()])
        writer.writerow(["Latitude", event.latitude if event.latitude is not None else "-"])
        writer.writerow(["Longitude", event.longitude if event.longitude is not None else "-"])
        writer.writerow(["Radius (meter)", event.radius_meter if event.radius_meter is not None else "-"])
        writer.writerow([])
        writer.writerow(["ATTENDANCE TOTALS"])
        writer.writerow(["Category", "Total"])
        writer.writerow(["Staff / Employee", total_staff])
        writer.writerow(["Visitor (Malaysian)", total_visitors])
        writer.writerow(["Visitor (Non-Malaysian / Passport)", total_passports])
        writer.writerow(["Overall Total", total_staff + total_visitors + total_passports])
        writer.writerow([])

        staff_group = StaffAttendance.objects.filter(event=event).exclude(department="").values("department").annotate(total=Count("id")).order_by("-total", "department")
        writer.writerow(["STAFF / EMPLOYEE BY DEPARTMENT"])
        writer.writerow(["Department", "Total"])
        for item in staff_group:
            writer.writerow([item["department"], item["total"]])
        if not staff_group:
            writer.writerow(["-", 0])

        visitor_group = VisitorAttendance.objects.filter(event=event).select_related("visitor").exclude(visitor__organization="").values("visitor__organization").annotate(total=Count("id")).order_by("-total", "visitor__organization")
        writer.writerow([])
        writer.writerow(["VISITOR (MALAYSIAN) BY ORGANIZATION"])
        writer.writerow(["Organization", "Total"])
        for item in visitor_group:
            writer.writerow([item["visitor__organization"], item["total"]])
        if not visitor_group:
            writer.writerow(["-", 0])

        passport_group = PassportAttendance.objects.filter(event=event).select_related("passport_visitor").exclude(passport_visitor__country="").values("passport_visitor__country").annotate(total=Count("id")).order_by("-total", "passport_visitor__country")
        writer.writerow([])
        writer.writerow(["VISITOR (NON-MALAYSIAN / PASSPORT) BY COUNTRY"])
        writer.writerow(["Country", "Total"])
        for item in passport_group:
            writer.writerow([item["passport_visitor__country"], item["total"]])
        if not passport_group:
            writer.writerow(["-", 0])

        return response
