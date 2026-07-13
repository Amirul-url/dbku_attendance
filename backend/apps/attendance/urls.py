from rest_framework.routers import SimpleRouter

from .views import AssignmentAttendanceViewSet, StaffAttendanceViewSet, VisitorAttendanceViewSet, VisitorViewSet

app_name = "attendance"

router = SimpleRouter()
router.register("visitors", VisitorViewSet, basename="visitors")
router.register("staff-attendance", StaffAttendanceViewSet, basename="staff-attendance")
router.register("visitor-attendance", VisitorAttendanceViewSet, basename="visitor-attendance")
router.register("assignment-attendance", AssignmentAttendanceViewSet, basename="assignment-attendance")

urlpatterns = router.urls
