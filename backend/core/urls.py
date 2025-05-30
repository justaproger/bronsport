# core/urls.py
from django.urls import path
from .views import UserRegistrationView, UserDetailView,ChangePasswordView

app_name = 'core'

urlpatterns = [
    path('register/', UserRegistrationView.as_view(), name='register'),
    path('user/', UserDetailView.as_view(), name='user-detail'),
    path('password/change/', ChangePasswordView.as_view(), name='password_change'),

]