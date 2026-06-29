from django.db import migrations, models


def convert_admin_roles(apps, schema_editor):
    StaffMember = apps.get_model("staff", "StaffMember")
    StaffMember.objects.filter(role="admin").update(role="editor")


class Migration(migrations.Migration):

    dependencies = [
        ("staff", "0002_staffmember_phone_number"),
    ]

    operations = [
        migrations.RunPython(convert_admin_roles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="staffmember",
            name="role",
            field=models.CharField(
                choices=[("editor", "Editor"), ("viewer", "Viewer")],
                default="viewer",
                max_length=20,
            ),
        ),
    ]
