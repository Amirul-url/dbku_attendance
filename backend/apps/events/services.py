from apps.core.qr import generate_assignment_qr_code


def ensure_assignment_qr_code(assignment):
    if not assignment.qr_code:
        generate_assignment_qr_code(assignment)
    return assignment


def serialize_assignment_conflicts(conflicts):
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
    return {
        "available": len(rows) == 0,
        "conflicts": rows,
        "message": "No assignment conflict found." if len(rows) == 0 else "Potential assignment conflict found.",
    }
