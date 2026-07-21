import re


def _clean(value, fallback="-"):
    text = str(value or "").strip()
    return text or fallback


def _format_date(value):
    if not value:
        return "-"
    try:
        return value.strftime("%d %b %Y")
    except AttributeError:
        return _clean(value)


def _format_time(value):
    if not value:
        return "-"
    try:
        return value.strftime("%I:%M %p").lstrip("0")
    except AttributeError:
        return _clean(value)


def _passport_extra_lookup(visitor):
    extra_data = getattr(visitor, "extra_data", None) or {}
    additional_fields = extra_data.get("additional_fields") or []
    lookup = {}
    for item in additional_fields:
        if not isinstance(item, dict):
            continue
        label = re.sub(r"\s*\*+$", "", _clean(item.get("label"), "")).strip().lower()
        if label:
            lookup[label] = _clean(item.get("value"), "")
    return lookup


def build_attendance_success_message(attendance, login_url=""):
    class_name = attendance.__class__.__name__
    event = getattr(attendance, "event", None)
    email = ""
    phone_number = ""
    recipient_name = ""
    assignment_login_url = ""
    lines = ["Your attendance has been recorded successfully.", ""]

    if class_name == "StaffAttendance":
        recipient_name = attendance.full_name
        email = attendance.email
        phone_number = attendance.phone_number
    elif class_name == "VisitorAttendance":
        visitor = attendance.visitor
        recipient_name = visitor.full_name
        email = visitor.email
        phone_number = visitor.phone_number
    elif class_name == "PassportAttendance":
        visitor = attendance.passport_visitor
        extra = _passport_extra_lookup(visitor)
        recipient_name = visitor.full_name
        email = extra.get("email", "")
        phone_number = extra.get("phone number", "")
        lines.extend([
            f"Passport No.: {_clean(visitor.passport_number)}",
        ])
    elif class_name == "AssignmentAttendance":
        assignment = attendance.assignment
        staff = assignment.staff_member
        event = assignment.event
        recipient_name = staff.full_name
        email = attendance.email or staff.email
        phone_number = attendance.phone_number or staff.phone_number
        assignment_login_url = _clean(login_url, "")
        lines = ["Your assignment attendance has been recorded successfully.", ""]
        lines.extend([
            f"Task: {_clean(assignment.task_title)}",
        ])
    else:
        return None

    lines.extend([
        f"Event: {_clean(getattr(event, 'name', None))}",
        f"Date: {_format_date(getattr(attendance, 'date', None))}",
        f"Time: {_format_time(getattr(attendance, 'time', None))}",
        f"Venue: {_clean(getattr(event, 'location', None))}",
    ])
    if assignment_login_url:
        lines.extend([
            "",
            f"For more details about your assignment, please log in here: {assignment_login_url}",
        ])
    lines.extend(["", "Thank you.", "DBKU Attendance Management System"])

    greeting = f"Hi {_clean(recipient_name, 'there')},"
    subject = f"Attendance Recorded - {_clean(getattr(event, 'name', None))}"
    text = "\n".join([greeting, "", *lines])
    return {
        "email": email,
        "phone_number": phone_number,
        "subject": subject,
        "text": text,
    }


def build_staff_registration_success_message(staff, login_url=""):
    subject = "Staff Account Registered - DBKU Attendance"
    text = "\n".join([
        f"Hi {_clean(staff.full_name, 'there')},",
        "",
        "Your DBKU Attendance account has been registered successfully.",
        "",
        f"Employee ID: {_clean(staff.staff_id)}",
        f"Login: {_clean(login_url)}",
        "",
        "Please use the password created during registration to log in.",
        "",
        "Thank you.",
        "DBKU Attendance Management System",
    ])
    return {
        "email": staff.email or "",
        "phone_number": staff.phone_number or "",
        "subject": subject,
        "text": text,
    }


def build_password_reset_otp_message(otp):
    return {
        "subject": "DBKU Attendance Password Reset OTP",
        "text": f"Your DBKU Attendance password reset OTP is {otp}. It expires in 10 minutes.",
    }
