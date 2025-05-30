# --- START OF FULL FILE backend/checkin/permissions.py ---
from rest_framework import permissions
from django.utils.translation import gettext_lazy as _

class IsStaffUserPermission(permissions.BasePermission):
    """
    Allows access only to authenticated users who are staff members.
    """
    message = _("Доступ разрешен только для персонала.")

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)
# --- END OF FULL FILE ---