import csv
import datetime
from html import unescape

from django.http import HttpResponse
from django.utils.html import strip_tags

from apps.attendance.selectors import (
    assignment_attendance_count,
    distinct_visitor_count,
    recent_staff_attendance,
    recent_visitor_attendance,
    staff_attendance_count,
    staff_attendance_for_event,
    staff_department_totals_for_event,
    visitor_attendance_count,
    visitor_attendance_for_event,
    visitor_organization_totals_for_event,
)
from apps.events.selectors import (
    active_events_for_date,
    event_by_id,
    event_count,
    event_report_list,
    event_years,
    filtered_event_report_list,
    assignments_for_event_export,
    upcoming_events_after_date,
)
from apps.passports.selectors import (
    distinct_passport_visitor_count,
    passport_attendance_count,
    passport_attendance_for_event,
    passport_country_totals_for_event,
    recent_passport_attendance,
)
from apps.staff.selectors import staff_member_count


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


def _plain_text(value):
    return unescape(strip_tags(value or "")).strip()


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


def build_event_summary_report(event_id=None):
    events = event_report_list(event_id=event_id)
    data = []
    for event in events:
        data.append(
            {
                "event_id": event.id,
                "event_name": event.name,
                "staff_attendance": staff_attendance_count(event=event),
                "visitor_attendance": visitor_attendance_count(event=event),
                "passport_attendance": passport_attendance_count(event=event),
                "assignment_attendance": assignment_attendance_count(event=event),
            }
        )

    return {
        "total_staff": staff_member_count(),
        "total_events": event_count(),
        "events": data,
    }


def build_dashboard_report(today=None):
    today = today or datetime.date.today()
    active_events_qs = active_events_for_date(today)
    dashboard_list_limit = 25
    recent_activity_limit = 20
    upcoming_events_qs = upcoming_events_after_date(today, limit=dashboard_list_limit)

    recent_staff = [
        {
            "name": item.full_name,
            "type": "Staff",
            "event_name": item.event.name,
            "date": item.date,
            "time": item.time,
        }
        for item in recent_staff_attendance(limit=recent_activity_limit)
    ]
    recent_visitors = [
        {
            "name": item.visitor.full_name,
            "type": "Visitor (Malaysian)",
            "event_name": item.event.name,
            "date": item.date,
            "time": item.time,
        }
        for item in recent_visitor_attendance(limit=recent_activity_limit)
    ]
    recent_passports = [
        {
            "name": item.passport_visitor.full_name,
            "type": "Visitor (Non-Malaysian)",
            "event_name": item.event.name,
            "date": item.date,
            "time": item.time,
        }
        for item in recent_passport_attendance(limit=recent_activity_limit)
    ]
    recent_activities = sorted(
        recent_staff + recent_visitors + recent_passports,
        key=lambda row: (row["date"], row["time"]),
        reverse=True,
    )[:dashboard_list_limit]

    return {
        "today_date": today,
        "total_staff": staff_member_count(),
        "total_visitors": distinct_visitor_count(),
        "total_passport_visitors": distinct_passport_visitor_count(),
        "total_events": event_count(),
        "active_events": active_events_qs.count(),
        "total_staff_attendance": staff_attendance_count(),
        "total_visitor_attendance": visitor_attendance_count(),
        "total_passport_attendance": passport_attendance_count(),
        "today_staff_attendance": staff_attendance_count(date=today),
        "today_visitor_attendance": visitor_attendance_count(date=today),
        "today_passport_attendance": passport_attendance_count(date=today),
        "active_events_list": [
            {"id": item.id, "name": item.name, "location": item.location, "start_date": item.start_date, "end_date": item.end_date}
            for item in active_events_qs[:dashboard_list_limit]
        ],
        "upcoming_events": [
            {"id": item.id, "name": item.name, "location": item.location, "start_date": item.start_date, "end_date": item.end_date}
            for item in upcoming_events_qs
        ],
        "recent_activities": recent_activities,
    }


def build_analytics_report(params):
    events = filtered_event_report_list(
        name=params.get("name"),
        month=params.get("month"),
        year=params.get("year"),
        location=params.get("location"),
    )

    total_staff = 0
    total_visitors = 0
    total_passport = 0
    department_totals = {}
    organization_totals = {}
    country_totals = {}
    monthly_map = {month: 0 for month in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
    monthly_breakdown = {
        month: {"staff_total": 0, "visitor_total": 0, "passport_total": 0, "grand_total": 0}
        for month in monthly_map
    }
    event_analytics = []

    for event in events:
        staff_group = staff_department_totals_for_event(event)
        visitor_group = visitor_organization_totals_for_event(event)
        passport_group = passport_country_totals_for_event(event)

        staff_total = sum(item["total"] for item in staff_group)
        visitor_total = sum(item["total"] for item in visitor_group)
        passport_total = sum(item["total"] for item in passport_group)
        grand_total = staff_total + visitor_total + passport_total

        total_staff += staff_total
        total_visitors += visitor_total
        total_passport += passport_total
        if event.start_date:
            month_label = event.start_date.strftime("%b")
            monthly_map[month_label] += grand_total
            monthly_breakdown[month_label]["staff_total"] += staff_total
            monthly_breakdown[month_label]["visitor_total"] += visitor_total
            monthly_breakdown[month_label]["passport_total"] += passport_total
            monthly_breakdown[month_label]["grand_total"] += grand_total
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

    return {
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
        "monthly_breakdown": [{"label": key, **value} for key, value in monthly_breakdown.items()],
        "top_departments": sorted(department_totals.items(), key=lambda item: item[1], reverse=True),
        "top_organizations": sorted(organization_totals.items(), key=lambda item: item[1], reverse=True),
        "top_countries": sorted(country_totals.items(), key=lambda item: item[1], reverse=True),
        "top_events": sorted(event_analytics, key=lambda item: item["grand_total"], reverse=True),
        "events": event_analytics,
        "available_years": [item.year for item in event_years()],
    }


def export_staff_attendance_csv(event_id):
    event = event_by_id(event_id)
    response = _csv_response(f"{event.name}_staff_attendance.csv")
    writer = csv.writer(response)
    writer.writerow(["Name", "Employee ID", "Phone", "Email", "Department", "IPv4", "IPv6", "Date", "Time", "Latitude", "Longitude"])
    for item in staff_attendance_for_event(event):
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


def export_visitor_attendance_csv(event_id):
    event = event_by_id(event_id)
    response = _csv_response(f"{event.name}_visitor_attendance_malaysian.csv")
    writer = csv.writer(response)
    writer.writerow(["Name", "Phone", "Email", "Organization", "IPv4", "IPv6", "Timestamp", "Latitude", "Longitude"])
    for item in visitor_attendance_for_event(event):
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


def export_passport_attendance_csv(event_id):
    event = event_by_id(event_id)
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
    for item in passport_attendance_for_event(event):
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


def export_assignment_attendance_csv(event_id):
    event = event_by_id(event_id)
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
    for item in assignments_for_event_export(event):
        attendance = getattr(item, "attendance", None)
        writer.writerow([
            item.staff_member.full_name if item.staff_member else "",
            item.staff_member.staff_id if item.staff_member else "",
            item.staff_member.department if item.staff_member else "",
            item.task_title,
            _plain_text(item.task_description),
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


def export_event_summary_csv(event_id):
    event = event_by_id(event_id)
    response = _csv_response(f"{event.name}_summary.csv")
    writer = csv.writer(response)

    total_staff = staff_attendance_count(event=event)
    total_visitors = visitor_attendance_count(event=event)
    total_passports = passport_attendance_count(event=event)

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

    staff_group = list(staff_department_totals_for_event(event))
    writer.writerow(["STAFF / EMPLOYEE BY DEPARTMENT"])
    writer.writerow(["Department", "Total"])
    for item in staff_group:
        writer.writerow([item["department"], item["total"]])
    if not staff_group:
        writer.writerow(["-", 0])

    visitor_group = list(visitor_organization_totals_for_event(event))
    writer.writerow([])
    writer.writerow(["VISITOR (MALAYSIAN) BY ORGANIZATION"])
    writer.writerow(["Organization", "Total"])
    for item in visitor_group:
        writer.writerow([item["visitor__organization"], item["total"]])
    if not visitor_group:
        writer.writerow(["-", 0])

    passport_group = list(passport_country_totals_for_event(event))
    writer.writerow([])
    writer.writerow(["VISITOR (NON-MALAYSIAN / PASSPORT) BY COUNTRY"])
    writer.writerow(["Country", "Total"])
    for item in passport_group:
        writer.writerow([item["passport_visitor__country"], item["total"]])
    if not passport_group:
        writer.writerow(["-", 0])

    return response
