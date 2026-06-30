from django.contrib.auth.models import User
from django.db import models


class StaffMember(models.Model):
    ROLE_ADMIN = "admin"
    ROLE_VIEWER = "viewer"

    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_VIEWER, "Viewer"),
    ]

    REGISTRATION_MANUAL = "manual"
    REGISTRATION_MYKAD = "mykad"

    REGISTRATION_CHOICES = [
        (REGISTRATION_MANUAL, "Manual"),
        (REGISTRATION_MYKAD, "MyKad"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="staff_profile")
    full_name = models.CharField(max_length=150)
    staff_id = models.CharField(max_length=50, unique=True)
    email = models.EmailField(unique=True, null=True, blank=True)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    department = models.CharField(max_length=100)
    registration_method = models.CharField(
        max_length=20,
        choices=REGISTRATION_CHOICES,
        default=REGISTRATION_MANUAL,
    )
    ic_number = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_VIEWER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name
