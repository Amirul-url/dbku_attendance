from django.db import models


class PassportVisitor(models.Model):
    STATUS_AUTO_EXTRACTED = "auto-extracted"
    STATUS_MANUALLY_CORRECTED = "manually-corrected"
    STATUS_PENDING_VERIFICATION = "pending verification"

    STATUS_CHOICES = [
        (STATUS_AUTO_EXTRACTED, "Auto Extracted"),
        (STATUS_MANUALLY_CORRECTED, "Manually Corrected"),
        (STATUS_PENDING_VERIFICATION, "Pending Verification"),
    ]

    full_name = models.CharField(max_length=150)
    passport_number = models.CharField(max_length=50, unique=True)
    country = models.CharField(max_length=100, blank=True)
    date_of_birth = models.CharField(max_length=50, blank=True)
    expiry_date = models.CharField(max_length=50, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    extra_data = models.JSONField(default=dict, blank=True)
    image = models.ImageField(upload_to="passport_images/", null=True, blank=True)
    extracted_image = models.ImageField(upload_to="passport_processed/", null=True, blank=True)
    profile_image = models.ImageField(upload_to="passport_profiles/", null=True, blank=True)
    ocr_raw_text = models.TextField(blank=True)
    image_quality_note = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING_VERIFICATION,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.full_name} ({self.passport_number})"


class PassportAttendance(models.Model):
    passport_visitor = models.ForeignKey(
        PassportVisitor,
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    event = models.ForeignKey("events.Event", on_delete=models.CASCADE, related_name="passport_attendances")
    date = models.DateField(auto_now_add=True)
    time = models.TimeField(auto_now_add=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    ipv4_address = models.GenericIPAddressField(null=True, blank=True, protocol="IPv4")
    ipv6_address = models.GenericIPAddressField(null=True, blank=True, protocol="IPv6")

    class Meta:
        ordering = ["-date", "-time"]
        constraints = [
            models.UniqueConstraint(
                fields=["passport_visitor", "event"],
                name="unique_passport_visitor_event_attendance",
            )
        ]

    def __str__(self):
        return f"{self.passport_visitor.full_name} - {self.event.name}"
