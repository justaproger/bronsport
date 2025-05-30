# backend/core/permissions.py
# --- START OF FULL FILE backend/core/permissions.py ---
from rest_framework import permissions

class IsUniversityAdminOwnerOrReadOnly(permissions.BasePermission):
    """
    Разрешает Read-Only (GET, HEAD, OPTIONS) всем (или аутентифицированным).
    Разрешает запись (POST, PUT, PATCH, DELETE) только если
    администратор университета запрашиваемого объекта совпадает с
    администратором текущего пользователя (request.user).
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        is_uni_admin = (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'administered_university') and
            request.user.administered_university is not None
        )
        return is_uni_admin

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        is_owner = False
        if obj.university and hasattr(request.user, 'administered_university') and request.user.administered_university:
             is_owner = (obj.university.administrator == request.user and obj.university == request.user.administered_university)
        return is_owner

class IsAssignedUniversityAdmin(permissions.BasePermission):
    """
    Проверяет, что пользователь аутентифицирован и ему назначен университет.
    Используется для действий, не привязанных к конкретному объекту (например, 'create').
    """
    message = "Только назначенный администратор университета может выполнять это действие."

    def has_permission(self, request, view):
        is_uni_admin = (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'is_staff') and request.user.is_staff and
            hasattr(request.user, 'administered_university') and
            request.user.administered_university is not None
        )
        return is_uni_admin

# --- НОВЫЙ КЛАСС РАЗРЕШЕНИЯ ---
class IsStaffUser(permissions.BasePermission):
    """
    Разрешает доступ только пользователям, которые аутентифицированы
    и имеют флаг is_staff=True.
    """
    message = "Доступ разрешен только для персонала."

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff
# --- КОНЕЦ НОВОГО КЛАССА ---
# --- END OF FULL FILE ---