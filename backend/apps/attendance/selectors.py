from django.db.models import Count

from .models import AssignmentAttendance, StaffAttendance, VisitorAttendance


def staff_attendance_list(event_id=None):
    queryset = StaffAttendance.objects.select_related("event", "staff_member")
    if event_id:
        queryset = queryset.filter(event_id=event_id)
    return queryset


def visitor_attendance_list(event_id=None):
    queryset = VisitorAttendance.objects.select_related("event", "visitor")
    if event_id:
        queryset = queryset.filter(event_id=event_id)
    return queryset


def assignment_attendance_list(assignment_id=None):
    queryset = AssignmentAttendance.objects.select_related("assignment", "assignment__event")
    if assignment_id:
        queryset = queryset.filter(assignment_id=assignment_id)
    return queryset


def staff_attendance_for_event(event):
    return StaffAttendance.objects.filter(event=event).order_by("-date", "-time", "-id")


def visitor_attendance_for_event(event):
    return VisitorAttendance.objects.filter(event=event).select_related("visitor").order_by("-date", "-time", "-id")


def assignment_attendance_for_event(event):
    return AssignmentAttendance.objects.filter(assignment__event=event)


def staff_attendance_count(event=None, date=None):
    queryset = StaffAttendance.objects.all()
    if event is not None:
        queryset = queryset.filter(event=event)
    if date is not None:
        queryset = queryset.filter(date=date)
    return queryset.count()


def visitor_attendance_count(event=None, date=None):
    queryset = VisitorAttendance.objects.all()
    if event is not None:
        queryset = queryset.filter(event=event)
    if date is not None:
        queryset = queryset.filter(date=date)
    return queryset.count()


def assignment_attendance_count(event=None):
    queryset = AssignmentAttendance.objects.all()
    if event is not None:
        queryset = queryset.filter(assignment__event=event)
    return queryset.count()


def distinct_visitor_count():
    return VisitorAttendance.objects.values("visitor").distinct().count()


def recent_staff_attendance(limit=5):
    return StaffAttendance.objects.select_related("event").order_by("-date", "-time")[:limit]


def recent_visitor_attendance(limit=5):
    return VisitorAttendance.objects.select_related("event", "visitor").order_by("-date", "-time")[:limit]


def staff_department_totals_for_event(event):
    return (
        StaffAttendance.objects.filter(event=event)
        .exclude(department="")
        .values("department")
        .annotate(total=Count("id"))
        .order_by("-total", "department")
    )


def visitor_organization_totals_for_event(event):
    return (
        VisitorAttendance.objects.filter(event=event)
        .exclude(visitor__organization="")
        .values("visitor__organization")
        .annotate(total=Count("id"))
        .order_by("-total", "visitor__organization")
    )
