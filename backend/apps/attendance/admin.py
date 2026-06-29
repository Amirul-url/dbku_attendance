from django.contrib import admin

from .models import AssignmentAttendance, StaffAttendance, Visitor, VisitorAttendance

admin.site.register(Visitor)
admin.site.register(StaffAttendance)
admin.site.register(VisitorAttendance)
admin.site.register(AssignmentAttendance)
