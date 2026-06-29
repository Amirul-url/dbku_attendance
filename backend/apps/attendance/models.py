from django.db import models


class Visitor(models.Model):
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=20)
    email = models.EmailField()
    organization = models.CharField(max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


class StaffAttendance(models.Model):
    event = models.ForeignKey("events.Event", on_delete=models.CASCADE, related_name="staff_attendances")
    staff_member = models.ForeignKey(
        "staff.StaffMember",
        on_delete=models.CASCADE,
        related_name="attendance_records",
        null=True,
        blank=True,
    )
    full_name = models.CharField(max_length=150)
    staff_id = models.CharField(max_length=50)
    phone_number = models.CharField(max_length=20)
    email = models.EmailField()
    department = models.CharField(max_length=100)
    ipv4_address = models.GenericIPAddressField(null=True, blank=True, protocol="IPv4")
    ipv6_address = models.GenericIPAddressField(null=True, blank=True, protocol="IPv6")
    date = models.DateField(auto_now_add=True)
    time = models.TimeField(auto_now_add=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    class Meta:
        ordering = ["-date", "-time"]
        constraints = [
            models.UniqueConstraint(fields=["staff_id", "event"], name="unique_staff_event_attendance")
        ]

    def __str__(self):
        return f"{self.full_name} - {self.event}"


class VisitorAttendance(models.Model):
    visitor = models.ForeignKey(Visitor, on_delete=models.CASCADE, related_name="attendance_records")
    event = models.ForeignKey("events.Event", on_delete=models.CASCADE, related_name="visitor_attendances")
    date = models.DateField(auto_now_add=True)
    time = models.TimeField(auto_now_add=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    ipv4_address = models.GenericIPAddressField(null=True, blank=True, protocol="IPv4")
    ipv6_address = models.GenericIPAddressField(null=True, blank=True, protocol="IPv6")

    class Meta:
        ordering = ["-date", "-time"]
        constraints = [
            models.UniqueConstraint(fields=["visitor", "event"], name="unique_visitor_event_attendance")
        ]

    def __str__(self):
        return f"{self.visitor} - {self.event}"


class AssignmentAttendance(models.Model):
    assignment = models.OneToOneField(
        "events.EventAssignment",
        on_delete=models.CASCADE,
        related_name="attendance",
    )
    phone_number = models.CharField(max_length=20)
    email = models.EmailField()
    notes = models.TextField(blank=True)
    ipv4_address = models.GenericIPAddressField(null=True, blank=True, protocol="IPv4")
    ipv6_address = models.GenericIPAddressField(null=True, blank=True, protocol="IPv6")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    date = models.DateField(auto_now_add=True)
    time = models.TimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-time"]

    def __str__(self):
        return f"{self.assignment} attendance"
