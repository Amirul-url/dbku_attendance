from django.db.models import Count

from .models import PassportAttendance


def passport_attendance_list(event_id=None):
    queryset = PassportAttendance.objects.select_related("event", "passport_visitor")
    if event_id:
        queryset = queryset.filter(event_id=event_id)
    return queryset


def passport_attendance_for_event(event):
    return PassportAttendance.objects.filter(event=event).select_related("passport_visitor").order_by("-date", "-time", "-id")


def passport_attendance_count(event=None, date=None):
    queryset = PassportAttendance.objects.all()
    if event is not None:
        queryset = queryset.filter(event=event)
    if date is not None:
        queryset = queryset.filter(date=date)
    return queryset.count()


def distinct_passport_visitor_count():
    return PassportAttendance.objects.values("passport_visitor").distinct().count()


def recent_passport_attendance(limit=5):
    return PassportAttendance.objects.select_related("event", "passport_visitor").order_by("-date", "-time")[:limit]


def passport_country_totals_for_event(event):
    return (
        PassportAttendance.objects.filter(event=event)
        .exclude(passport_visitor__country="")
        .values("passport_visitor__country")
        .annotate(total=Count("id"))
        .order_by("-total", "passport_visitor__country")
    )
