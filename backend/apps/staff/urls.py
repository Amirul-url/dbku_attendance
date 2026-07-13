from rest_framework.routers import SimpleRouter

from .views import StaffMemberViewSet

app_name = "staff"

router = SimpleRouter()
router.register("staff", StaffMemberViewSet, basename="staff")

urlpatterns = router.urls
