from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import datetime, time, timedelta, date as dt_date
from collections import defaultdict
from django.conf import settings
from django.utils.translation import gettext_lazy as _
import logging # Добавим логирование

from .models import Facility, Amenity, DAYS_OF_WEEK_NUMERIC
from .serializers import FacilityListSerializer, FacilityDetailSerializer, AmenitySerializer
# --- ИЗМЕНЕНИЕ: Импортируем сервис ---
from .availability_checker import FacilityAvailabilityService, REASON_AVAILABLE 
# --- КОНЕЦ ИЗМЕНЕНИЯ ---
from .filters import FacilityFilter 

from rest_framework.pagination import PageNumberPagination

logger = logging.getLogger(__name__)

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 48

class FacilityViewSet(viewsets.ReadOnlyModelViewSet):
    # ... (код FacilityViewSet без изменений) ...
    queryset = Facility.objects.filter(
        is_active=True,
        university__is_active=True
    ).select_related(
        'university',
        'responsible_person'
    ).prefetch_related(
        'amenities',
        'images'
    ).order_by('name')
    permission_classes = [permissions.AllowAny]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = FacilityFilter 
    search_fields = ['name', 'description', 'university__name', 'university__city']
    ordering_fields = ['name', 'price_per_hour', 'created_at']
    ordering = ['name']
    def get_serializer_context(self):
        context = super().get_serializer_context(); context['request'] = self.request
        return context
    def get_serializer_class(self):
        if self.action == 'list': return FacilityListSerializer
        return FacilityDetailSerializer

class AmenityViewSet(viewsets.ReadOnlyModelViewSet):
    # ... (код AmenityViewSet без изменений) ...
    queryset = Amenity.objects.all().order_by('name')
    serializer_class = AmenitySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_facility_availability(request, facility_id):
    try:
        facility = Facility.objects.get(pk=facility_id, is_active=True) # Используем get, чтобы сразу была ошибка если не найден
    except Facility.DoesNotExist:
        return Response({"error": _("Объект не найден или неактивен.")}, status=status.HTTP_404_NOT_FOUND)

    date_str = request.query_params.get('date')
    response_data = {"facility_id": facility.id, "facility_booking_type": facility.booking_type, "slots": [], "message": None}

    if facility.booking_type == Facility.BOOKING_TYPE_ENTRY:
        response_data["message"] = _("Для этого объекта доступна только оплата за вход, почасовое бронирование не предусмотрено.")
        return Response(response_data, status=status.HTTP_200_OK)

    if not date_str: 
        return Response({"error": _("Параметр 'date' обязателен.")}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        selected_date_naive = dt_date.fromisoformat(date_str)
        # Проверку на прошедшую дату лучше делать внутри сервиса или оставить здесь для быстрой отсечки
        if selected_date_naive < timezone.localdate():
             response_data["message"] = _("Нельзя посмотреть доступность на прошедшую дату.")
             return Response(response_data, status=status.HTTP_200_OK)
    except ValueError: 
        return Response({"error": _("Неверный формат даты. Используйте YYYY-MM-DD.")}, status=status.HTTP_400_BAD_REQUEST)

    # --- ИЗМЕНЕНИЕ: Используем сервис ---
    # Фиксируем время начала запроса для консистентности проверки lead_time
    request_processing_time = timezone.localtime(timezone.now())
    availability_service = FacilityAvailabilityService(facility, request_time=request_processing_time)
    # --- КОНЕЦ ИЗМЕНЕНИЯ ---
    
    # Проверка, работает ли объект в этот день недели (можно также перенести в сервис как отдельный метод)
    day_of_week_py = selected_date_naive.weekday()
    if not facility.is_working_on_day(day_of_week_py):
        day_map_display = dict(DAYS_OF_WEEK_NUMERIC)
        day_name_display = day_map_display.get(day_of_week_py, f"День {day_of_week_py}")
        response_data["message"] = _("Объект закрыт в этот день ({day_name}).").format(day_name=day_name_display)
        return Response(response_data, status=status.HTTP_200_OK)

    open_t = facility.open_time
    close_t = facility.close_time
    time_step = timedelta(hours=1) # Предполагаем шаг в 1 час
    current_dt_naive = datetime.combine(selected_date_naive, open_t)
    end_work_dt_naive = datetime.combine(selected_date_naive, close_t) if close_t != time(0,0) else datetime.combine(selected_date_naive + timedelta(days=1), time(0,0))
    
    current_tz = timezone.get_current_timezone()

    while current_dt_naive < end_work_dt_naive:
        slot_start_time_obj = current_dt_naive.time()
        check_datetime_start_aware = timezone.make_aware(current_dt_naive, current_tz)
        
        # --- ИЗМЕНЕНИЕ: Вызываем метод сервиса ---
        availability_details = availability_service.check_slot_availability(
            check_datetime_start=check_datetime_start_aware, 
            capacity_needed=1 
        )
        # --- КОНЕЦ ИЗМЕНЕНИЯ ---
        
        slot_end_dt_naive = current_dt_naive + time_step
        if slot_end_dt_naive <= end_work_dt_naive:
            response_data["slots"].append({
                "time": slot_start_time_obj.strftime('%H:%M'), 
                "is_available": availability_details["is_available"],
                "booked_count": availability_details["booked_slots_count"], 
                "max_capacity": availability_details["max_capacity"],
                "available_spots": availability_details["available_spots"], 
                "reason": availability_details.get("reason")
            })
        else: break 
        current_dt_naive += time_step

    if not response_data["slots"] and not response_data["message"]:
        response_data["message"] = _("Нет доступных слотов в указанные рабочие часы или объект не работает.")
        
    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_comprehensive_subscription_availability(request, facility_id):
    try:
        facility = Facility.objects.get(pk=facility_id, is_active=True)
    except Facility.DoesNotExist:
        return Response({"error": _("Объект не найден или неактивен.")}, status=status.HTTP_404_NOT_FOUND)

    response_data = {"facility_id": facility.id, "facility_booking_type": facility.booking_type, "availability_matrix": {}}

    if facility.booking_type == Facility.BOOKING_TYPE_ENTRY:
        response_data["message"] = _("Подписки не применимы для объектов с типом 'Оплата за вход'.")
        return Response(response_data, status=status.HTTP_200_OK)

    # --- ИЗМЕНЕНИЕ: Используем сервис ---
    request_processing_time = timezone.localtime(timezone.now())
    availability_service = FacilityAvailabilityService(facility, request_time=request_processing_time)
    # --- КОНЕЦ ИЗМЕНЕНИЯ ---

    availability_matrix = defaultdict(dict)
    current_tz = timezone.get_current_timezone()
    today_local = timezone.localdate() # Используем request_processing_time.date() если request_time важно для определения "сегодня"
    
    start_day_offset = (0 - today_local.weekday() + 7) % 7 
    base_monday_for_matrix = today_local + timedelta(days=start_day_offset)
    # Если хотим, чтобы матрица всегда начиналась со *следующей* недели (не включая текущую, если сегодня пн)
    # if base_monday_for_matrix <= today_local: 
    #     base_monday_for_matrix += timedelta(days=7)

    for day_index_in_week in range(7):
        current_day_matrix_slots = {}
        if facility.is_working_on_day(day_index_in_week): # Проверяем, работает ли объект в этот день недели
            # Дата для текущего дня недели в матрице
            current_check_date_for_matrix_day = base_monday_for_matrix + timedelta(days=(day_index_in_week - base_monday_for_matrix.weekday() + 7)%7)
            time_slot_dt_naive = datetime.combine(dt_date.min, facility.open_time)
            end_iteration_time_obj = facility.close_time
            if facility.close_time == time(0,0): end_iteration_time_obj = time(23,0) 
            else:
                end_iteration_time_obj = (datetime.combine(dt_date.min, facility.close_time) - timedelta(hours=1)).time()
                if end_iteration_time_obj < facility.open_time and facility.close_time != time(0,0):
                    end_iteration_time_obj = facility.open_time 
            
            if time_slot_dt_naive.time() <= end_iteration_time_obj:
                while True:
                    current_slot_time_obj = time_slot_dt_naive.time()
                    check_dt_start_naive_for_slot = datetime.combine(current_check_date_for_matrix_day, current_slot_time_obj)
                    check_dt_start_aware_for_slot = timezone.make_aware(check_dt_start_naive_for_slot, current_tz)
                    
                    # --- ИЗМЕНЕНИЕ: Вызываем метод сервиса ---
                    slot_availability_details = availability_service.check_slot_availability(
                        check_datetime_start=check_dt_start_aware_for_slot, 
                        capacity_needed=1
                    )
                    # --- КОНЕЦ ИЗМЕНЕНИЯ ---
                    
                    current_day_matrix_slots[current_slot_time_obj.strftime('%H:%M')] = {
                        "is_available_for_subscription": slot_availability_details["is_available"],
                        "available_spots_for_subscription": slot_availability_details["available_spots"],
                        "reason_key": slot_availability_details.get("reason", REASON_AVAILABLE if slot_availability_details["is_available"] else None)
                    }
                    if current_slot_time_obj == end_iteration_time_obj: break 
                    time_slot_dt_naive += timedelta(hours=1)
                    if time_slot_dt_naive.time() == facility.open_time and facility.open_time != time(0,0) and facility.open_time == facility.close_time: break
        availability_matrix[str(day_index_in_week)] = current_day_matrix_slots
        
    response_data["availability_matrix"] = dict(availability_matrix)
    return Response(response_data, status=status.HTTP_200_OK)

