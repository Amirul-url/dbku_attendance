from django.shortcuts import get_object_or_404

from .models import Event, EventAssignment


def event_list(search=None):
    queryset = Event.objects.all()
    if search:
        queryset = queryset.filter(name__icontains=search)
    return queryset


def assignment_list(event_id=None, staff_id=None, status=None):
    queryset = EventAssignment.objects.select_related("event", "staff_member", "assigned_by")
    if event_id:
        queryset = queryset.filter(event_id=event_id)
    if staff_id:
        queryset = queryset.filter(staff_member_id=staff_id)
    if status:
        queryset = queryset.filter(assignment_status=status)
    return queryset


def assignment_conflicts(staff_id=None, event_id=None, task_title="", assignment_id=None):
    queryset = EventAssignment.objects.select_related("event", "staff_member")
    if staff_id:
        queryset = queryset.filter(staff_member_id=staff_id)
    if event_id:
        queryset = queryset.filter(event_id=event_id)
    if task_title:
        queryset = queryset.filter(task_title__iexact=task_title)
    if assignment_id:
        queryset = queryset.exclude(id=assignment_id)
    return queryset


def event_by_id(event_id):
    return get_object_or_404(Event, id=event_id)


def event_count():
    return Event.objects.count()


def event_years():
    return Event.objects.exclude(start_date__isnull=True).dates("start_date", "year", "DESC")


def event_report_list(event_id=None):
    queryset = Event.objects.all()
    if event_id:
        queryset = queryset.filter(id=event_id)
    return queryset


def active_events_for_date(date):
    return Event.objects.filter(start_date__lte=date, end_date__gte=date).order_by("start_date", "start_time", "id")


def upcoming_events_after_date(date, limit=5):
    return Event.objects.filter(start_date__gt=date).order_by("start_date", "start_time", "id")[:limit]


def filtered_event_report_list(name=None, month=None, year=None, location=None):
    queryset = Event.objects.all().order_by("-start_date", "-id")
    if name:
        queryset = queryset.filter(name__icontains=name)
    if month:
        queryset = queryset.filter(start_date__month=month)
    if year:
        queryset = queryset.filter(start_date__year=year)
    if location:
        queryset = queryset.filter(location__icontains=location)
    return queryset


def assignments_for_event_export(event):
    return EventAssignment.objects.filter(event=event).select_related("staff_member", "assigned_by").prefetch_related("attendance")
