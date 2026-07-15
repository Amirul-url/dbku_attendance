from datetime import datetime, time

from django.utils import timezone
from rest_framework import serializers


def event_has_ended(event, now=None):
    end_date = event.end_date or event.start_date
    if not end_date:
        return False

    local_now = timezone.localtime(now or timezone.now())
    if event.end_time:
        end_datetime = timezone.make_aware(
            datetime.combine(end_date, event.end_time),
            timezone.get_current_timezone(),
        )
        return local_now > end_datetime

    end_datetime = timezone.make_aware(
        datetime.combine(end_date, time.max),
        timezone.get_current_timezone(),
    )
    return local_now > end_datetime


def validate_event_accepting_attendance(event):
    if not event_has_ended(event):
        return
    raise serializers.ValidationError({
        "code": "event_expired",
        "detail": "This event has ended. Attendance submission is no longer allowed.",
        "event": event.name,
    })


def complete_ended_event_assignments(event_ids=None):
    from apps.events.models import EventAssignment

    queryset = (
        EventAssignment.objects
        .select_related("event")
        .exclude(assignment_status__in=[
            EventAssignment.STATUS_COMPLETED,
            EventAssignment.STATUS_CANCELLED,
        ])
    )
    if event_ids is not None:
        queryset = queryset.filter(event_id__in=event_ids)

    completed_ids = [
        assignment.id
        for assignment in queryset
        if event_has_ended(assignment.event)
    ]
    if completed_ids:
        EventAssignment.objects.filter(id__in=completed_ids).update(
            assignment_status=EventAssignment.STATUS_COMPLETED,
        )
