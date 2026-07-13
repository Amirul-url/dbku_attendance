from rest_framework.routers import SimpleRouter

from .views import PassportAttendanceViewSet, PassportVisitorViewSet

app_name = "passports"

router = SimpleRouter()
router.register("passport-visitors", PassportVisitorViewSet, basename="passport-visitors")
router.register("passport-attendance", PassportAttendanceViewSet, basename="passport-attendance")

urlpatterns = router.urls
