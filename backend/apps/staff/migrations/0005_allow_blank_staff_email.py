from django.db import migrations, models


def blank_email_to_null(apps, schema_editor):
    StaffMember = apps.get_model("staff", "StaffMember")
    StaffMember.objects.filter(email="").update(email=None)


class Migration(migrations.Migration):

    dependencies = [
        ("staff", "0004_replace_editor_with_admin_role"),
    ]

    operations = [
        migrations.AlterField(
            model_name="staffmember",
            name="email",
            field=models.EmailField(blank=True, max_length=254, null=True, unique=True),
        ),
        migrations.RunPython(blank_email_to_null, migrations.RunPython.noop),
    ]
