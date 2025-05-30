# --- START OF FULL FILE backend/universities/views.py ---
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
# --- I18N: импорт, если используется в логике (здесь не нужен) ---
# from django.utils.translation import gettext_lazy as _
# --- Фильтры: импортируем DjangoFilterBackend и filters ---
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters # Добавляем filters для SearchFilter/OrderingFilter, если нужны

from .models import University, Staff, SportClub
from .serializers import (
    UniversityListSerializer, UniversityDetailSerializer, StaffSerializer,
    SportClubSerializer
)

# --- Класс Пагинации (Стандартный) ---
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12 # Количество по умолчанию для списков
    page_size_query_param = 'page_size' # Параметр для изменения размера страницы
    max_page_size = 100 # Максимальное количество на странице

# --- ViewSet для Университетов ---
class UniversityViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API эндпоинт для просмотра списка и деталей университетов (только чтение).
    Поддерживает фильтрацию по городу (`city__icontains`) и стандартную пагинацию.
    Предоставляет дополнительные действия 'staff' и 'clubs' для получения связанной информации.
    """
    # Queryset: выбираем только активные университеты и предзагружаем галерею
    queryset = University.objects.filter(is_active=True).prefetch_related('gallery_images').order_by('name')
    permission_classes = [permissions.AllowAny] # Просмотр доступен всем
    pagination_class = StandardResultsSetPagination # Используем стандартную пагинацию

    # --- Настройка Фильтрации, Поиска и Сортировки ---
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter] # Подключаем бэкенды
    filterset_fields = {
        'city': ['icontains', 'exact'], # Разрешаем фильтр по полю 'city' (icontains - без учета регистра, exact - точное совпадение)
        'name': ['icontains'] # Можно добавить фильтр по названию
    }
    search_fields = ['name', 'short_name', 'city', 'description'] # Поля для ?search=
    ordering_fields = ['name', 'city', 'established_year'] # Поля для ?ordering=
    ordering = ['name'] # Сортировка по умолчанию
    # -------------------------------------------------

    def get_serializer_class(self):
        """ Динамический выбор сериализатора """
        if self.action == 'list':
            return UniversityListSerializer # Краткий для списка
        return UniversityDetailSerializer # Полный для деталей

    def get_serializer_context(self):
        """ Добавление request в контекст для генерации полных URL изображений """
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    # --- Кастомное действие для получения персонала ---
    # URL: /universities/{pk}/staff/
    @action(
        detail=True, # Действие для конкретного объекта (университета)
        methods=['get'], # Разрешен только GET запрос
        permission_classes=[permissions.AllowAny], # Доступно всем
        pagination_class=StandardResultsSetPagination # Используем пагинацию для списка персонала
    )
    def staff(self, request, pk=None):
        """ Возвращает пагинированный список сотрудников университета. """
        university = self.get_object() # Получаем объект университета по pk
        # Фильтруем персонал по университету, сортируем по имени
        queryset = Staff.objects.filter(university=university).order_by('full_name')

        # Применяем пагинацию
        page = self.paginate_queryset(queryset)
        if page is not None:
             # Если есть страницы, сериализуем текущую страницу
             serializer = StaffSerializer(page, many=True, context=self.get_serializer_context())
             # Возвращаем пагинированный ответ
             return self.get_paginated_response(serializer.data)

        # Если пагинация не используется (например, отключена), сериализуем весь queryset
        serializer = StaffSerializer(queryset, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    # --- Кастомное действие для получения кружков ---
    # URL: /universities/{pk}/clubs/
    @action(
        detail=True,
        methods=['get'],
        permission_classes=[permissions.AllowAny],
        pagination_class=StandardResultsSetPagination
    )
    def clubs(self, request, pk=None):
        """ Возвращает пагинированный список активных кружков университета. """
        university = self.get_object()
        # Фильтруем кружки по университету и активности, сортируем по имени
        queryset = SportClub.objects.filter(university=university, is_active=True).order_by('name')

        # Применяем пагинацию
        page = self.paginate_queryset(queryset)
        if page is not None:
             serializer = SportClubSerializer(page, many=True, context=self.get_serializer_context())
             return self.get_paginated_response(serializer.data)

        serializer = SportClubSerializer(queryset, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

# --- END OF FULL FILE ---