# --- START OF MODIFIED backend/unisport_backend/urls.py ---
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.conf.urls.i18n import i18n_patterns
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

# Сначала определяем URL-ы БЕЗ языкового префикса
non_i18n_urlpatterns = [
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('api/auth/password_reset/', include('django_rest_passwordreset.urls', namespace='password_reset')),
    # Вебхук для Paycom (без языкового префикса и без /api/)
    path('paycom-callbacks/', include('bookings.paycom_urls', namespace='paycom_callbacks')),
]

# Затем определяем URL-ы С языковым префиксом
i18n_urlpatterns = i18n_patterns(
    path('admin/', admin.site.urls),
    path('api/auth/', include('core.urls', namespace='core_auth')), # Регистрация, детали пользователя
    path('api/universities/', include('universities.urls', namespace='universities_api')),
    path('api/catalog/', include('facilities.urls', namespace='facilities_api')),
    path('api/bookings/', include('bookings.urls', namespace='bookings_api')), 
    path('api/dashboard/', include('dashboard.urls', namespace='dashboard_api')),
    path('api/checkin/', include('checkin.urls', namespace='checkin_api')), # <--- ДОБАВИТЬ СЮДА

    # Если какой-то URL должен быть и с языком, и без, его нужно определить в обоих местах
    # или использовать более сложную логику маршрутизации.
    # Но для JWT и вебхуков обычно префикс не нужен.

    prefix_default_language=True 
)

# Объединяем списки: сначала нелокализованные, потом локализованные
urlpatterns = non_i18n_urlpatterns + i18n_urlpatterns

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
# --- END OF MODIFIED backend/unisport_backend/urls.py ---