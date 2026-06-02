from rest_framework import permissions


class IsOwnerOrManager(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user == request.user


class IsResearcherOrReviewer(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.user and hasattr(request.user, 'role'):
            return request.user.role in ['researcher', 'reviewer']
        return False
