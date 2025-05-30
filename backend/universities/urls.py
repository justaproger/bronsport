# --- START OF FULL FILE backend/universities/urls.py ---
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UniversityViewSet # Импортируем наш ViewSet

# Создаем экземпляр роутера
router = DefaultRouter()


app_name = 'universities' # <--- ДОБАВИТЬ ЭТУ СТРОКУ (имя приложения)

# Регистрируем UniversityViewSet.
# Базовый путь будет '/api/<lang>/universities/' (префиксы добавляются в корневом urls.py)
# basename='university' используется для автоматической генерации имен URL
# (например, 'university-list', 'university-detail', 'university-staff', 'university-clubs')
router.register(r'', UniversityViewSet, basename='university')

# Определяем urlpatterns приложения
# include(router.urls) автоматически создаст все необходимые URL для ViewSet
# (list, retrieve и кастомные @action)
urlpatterns = [
    path('', include(router.urls)),
]
# --- END OF FULL FILE ---