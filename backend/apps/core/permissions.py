from rest_framework.permissions import SAFE_METHODS, BasePermission


def get_staff_role(user):
    profile = getattr(user, "staff_profile", None)
    return getattr(profile, "role", "")


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.is_superuser or get_staff_role(request.user) == "admin"))


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and (request.user.is_superuser or get_staff_role(request.user) == "admin"))


class CanManageEvents(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and (request.user.is_superuser or get_staff_role(request.user) in {"admin", "editor"}))
