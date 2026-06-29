from django.contrib import admin

from .models import PassportAttendance, PassportVisitor

admin.site.register(PassportVisitor)
admin.site.register(PassportAttendance)
