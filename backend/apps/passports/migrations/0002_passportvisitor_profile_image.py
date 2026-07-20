from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("passports", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="passportvisitor",
            name="profile_image",
            field=models.ImageField(blank=True, null=True, upload_to="passport_profiles/"),
        ),
    ]
