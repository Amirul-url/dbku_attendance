from apps.core.qr import ensure_assignment_qr_code


def serialize_assignment_conflicts(conflicts, event_id=None):
    rows = [
        {
            "id": item.id,
            "event": item.event.name,
            "staff": item.staff_member.full_name,
            "task_title": item.task_title,
            "status": item.assignment_status,
        }
        for item in conflicts[:10]
    ]
    has_same_event_conflict = event_id and any(str(item.event_id) == str(event_id) for item in conflicts)
    return {
        "available": len(rows) == 0,
        "conflicts": rows,
        "message": (
            "No overlapping event assignment found for this staff."
            if len(rows) == 0
            else (
                "This staff is already assigned to this event."
                if has_same_event_conflict
                else "This staff is already assigned to another event at the same date/time."
            )
        ),
    }
