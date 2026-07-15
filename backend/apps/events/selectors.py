from django.shortcuts import get_object_or_404

from apps.core.event_state import complete_ended_event_assignments

from .models import Event, EventAssignment


def event_list(search=None):
    queryset = Event.objects.all()
    if search:
        queryset = queryset.filter(name__icontains=search)
    return queryset


def assignment_list(event_id=None, staff_id=None, status=None):
    complete_ended_event_assignments([event_id] if event_id else None)
    queryset = EventAssignment.objects.select_related("event", "staff_member", "assigned_by")
    if event_id:
        queryset = queryset.filter(event_id=event_id)
    if staff_id:
        queryset = queryset.filter(staff_member_id=staff_id)
    if status:
        queryset = queryset.filter(assignment_status=status)
    return queryset


def assignment_conflicts(staff_id=None, event_id=None, task_title="", assignment_id=None):
    if not staff_id or not event_id:
        return EventAssignment.objects.none()

    same_event_queryset = (
        EventAssignment.objects
        .select_related("event", "staff_member")
        .filter(staff_member_id=staff_id, event_id=event_id)
        .exclude(assignment_status=EventAssignment.STATUS_CANCELLED)
    )
    if assignment_id:
        same_event_queryset = same_event_queryset.exclude(id=assignment_id)
    if same_event_queryset.exists():
        return same_event_queryset

    current_event = Event.objects.filter(id=event_id).first()
    if current_event is None or current_event.start_date is None:
        return EventAssignment.objects.none()

    current_start_date = current_event.start_date
    current_end_date = current_event.end_date or current_event.start_date
    current_start_time = current_event.start_time
    current_end_time = current_event.end_time or current_event.start_time
    current_has_time_range = bool(current_event.start_time and current_event.end_time)

    queryset = (
        EventAssignment.objects
        .select_related("event", "staff_member")
        .filter(staff_member_id=staff_id)
        .exclude(event_id=event_id)
        .exclude(assignment_status=EventAssignment.STATUS_CANCELLED)
    )
    if assignment_id:
        queryset = queryset.exclude(id=assignment_id)

    conflict_ids = []
    for assignment in queryset:
        event = assignment.event
        if event.start_date is None:
            continue

        event_start_date = event.start_date
        event_end_date = event.end_date or event.start_date
        if event_start_date > current_end_date or event_end_date < current_start_date:
            continue

        event_start_time = event.start_time
        event_end_time = event.end_time or event.start_time
        event_has_time_range = bool(event.start_time and event.end_time)
        if not current_start_time or not event_start_time:
            continue

        if current_has_time_range and event_has_time_range:
            has_time_conflict = event_start_time < current_end_time and current_start_time < event_end_time
        else:
            has_time_conflict = event_start_time == current_start_time

        if has_time_conflict:
            conflict_ids.append(assignment.id)

    return EventAssignment.objects.select_related("event", "staff_member").filter(id__in=conflict_ids)


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
