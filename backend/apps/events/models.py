from django.conf import settings
from django.db import models


class Event(models.Model):
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    description = models.TextField(blank=True)
    visitor_qr_code = models.ImageField(upload_to="qr_codes/", null=True, blank=True)
    staff_qr_code = models.ImageField(upload_to="qr_codes/", null=True, blank=True)
    passport_qr_code = models.ImageField(upload_to="qr_codes/", null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    radius_meter = models.PositiveIntegerField(default=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class EventAssignment(models.Model):
    STATUS_ASSIGNED = "assigned"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_ASSIGNED, "Assigned"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="assignments")
    staff_member = models.ForeignKey(
        "staff.StaffMember",
        on_delete=models.CASCADE,
        related_name="event_assignments",
    )
    task_title = models.CharField(max_length=150)
    task_description = models.TextField(blank=True)
    assignment_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ASSIGNED)
    qr_code = models.ImageField(upload_to="assignment_qr_codes/", null=True, blank=True)
    assigned_by = models.ForeignKey(
        "staff.StaffMember",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_assignments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["event", "staff_member", "task_title"],
                name="unique_event_staff_task",
            )
        ]

    def __str__(self):
        return f"{self.staff_member} - {self.task_title}"
