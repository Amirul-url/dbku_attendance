from rest_framework.permissions import SAFE_METHODS, BasePermission


def get_staff_role(user):
    profile = getattr(user, "staff_profile", None)
    return getattr(profile, "role", "")


def is_superadmin(user):
    return bool(user and user.is_authenticated and (user.is_superuser or get_staff_role(user) == "superadmin"))


def is_admin(user):
    return bool(user and user.is_authenticated and (is_superadmin(user) or get_staff_role(user) == "admin"))


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return is_superadmin(request.user)


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return is_admin(request.user)
        return is_superadmin(request.user)


class CanManageEvents(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return is_admin(request.user)
