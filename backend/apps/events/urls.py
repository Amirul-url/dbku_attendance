from rest_framework.routers import SimpleRouter

from .views import EventAssignmentViewSet, EventViewSet

app_name = "events"

router = SimpleRouter()
router.register("events", EventViewSet, basename="events")
router.register("event-assignments", EventAssignmentViewSet, basename="event-assignments")

urlpatterns = router.urls
