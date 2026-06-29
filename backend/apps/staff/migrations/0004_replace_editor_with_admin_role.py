from django.db import migrations, models


def convert_editor_roles(apps, schema_editor):
    StaffMember = apps.get_model("staff", "StaffMember")
    StaffMember.objects.filter(role="editor").update(role="admin")


class Migration(migrations.Migration):

    dependencies = [
        ("staff", "0003_remove_admin_staff_role_choice"),
    ]

    operations = [
        migrations.RunPython(convert_editor_roles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="staffmember",
            name="role",
            field=models.CharField(
                choices=[("admin", "Admin"), ("viewer", "Viewer")],
                default="viewer",
                max_length=20,
            ),
        ),
    ]
