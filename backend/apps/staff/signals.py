from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import StaffMember


@receiver(post_save, sender=User)
def create_staff_profile_for_terminal_superuser(sender, instance, created, **kwargs):
    if not created or not instance.is_superuser:
        return

    StaffMember.objects.get_or_create(
        user=instance,
        defaults={
            "full_name": instance.get_full_name() or instance.username,
            "staff_id": instance.username,
            "email": instance.email or None,
            "department": "Administration",
            "role": StaffMember.ROLE_SUPERADMIN,
            "registration_method": StaffMember.REGISTRATION_MANUAL,
        },
    )
