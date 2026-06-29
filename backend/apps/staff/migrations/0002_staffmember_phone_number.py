from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("staff", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffmember",
            name="phone_number",
            field=models.CharField(blank=True, max_length=20, null=True, unique=True),
        ),
    ]
