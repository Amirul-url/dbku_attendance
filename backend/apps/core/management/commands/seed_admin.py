import os

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from apps.staff.models import StaffMember


class Command(BaseCommand):
    help = "Create the first superadmin user and linked staff profile."

    def handle(self, *args, **options):
        username = os.environ.get("SEED_ADMIN_USERNAME", "admin")
        password = os.environ.get("SEED_ADMIN_PASSWORD")
        email = os.environ.get("SEED_ADMIN_EMAIL", "admin@example.com")
        full_name = os.environ.get("SEED_ADMIN_FULL_NAME", "System Admin")
        staff_id = os.environ.get("SEED_ADMIN_STAFF_ID", username)
        department = os.environ.get("SEED_ADMIN_DEPARTMENT", "Administration")

        if not password:
            raise CommandError("SEED_ADMIN_PASSWORD is required.")

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email, "is_staff": True, "is_superuser": True},
        )

        if created:
            user.set_password(password)
        user.email = email
        user.is_staff = True
        user.is_superuser = True
        user.save()

        StaffMember.objects.update_or_create(
            user=user,
            defaults={
                "full_name": full_name,
                "staff_id": staff_id,
                "email": email,
                "department": department,
                "role": StaffMember.ROLE_SUPERADMIN,
                "registration_method": StaffMember.REGISTRATION_MANUAL,
            },
        )

        self.stdout.write(self.style.SUCCESS(f"Superadmin user ready: {username}"))
