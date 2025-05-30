from datetime import datetime, time, timedelta, date as dt_date
from typing import Optional, Dict, Any, Tuple, Union
from uuid import UUID
import logging # Используем logging

from django.conf import settings
from django.utils import timezone
from typing import TYPE_CHECKING

from bookings.models import Order # Модель Order для доступа к TYPE_CHOICES и статусам

if TYPE_CHECKING:
    from .models import Facility # Для type hinting

# Инициализация логгера
logger = logging.getLogger(__name__)

# Константы для причин недоступности (остаются без изменений)
REASON_AVAILABLE = "available"
REASON_CLOSED_DAY = "facility_closed_on_day"
REASON_CLOSED_TIME = "facility_closed_at_time"
REASON_LEAD_TIME_RESTRICTION = "lead_time_restriction"
REASON_FULLY_BOOKED_EXCLUSIVE = "fully_booked_exclusive"
REASON_MAX_CAPACITY_REACHED = "max_capacity_reached"
REASON_FACILITY_MISCONFIGURED_CAPACITY = "facility_misconfigured_no_capacity"
REASON_UNKNOWN_ERROR = "unknown_error" # Добавим для непредвиденных случаев

AvailabilityResult = Dict[str, Any]


class FacilityAvailabilityService:
    """
    Сервисный класс для проверки доступности спортивного объекта.
    Инкапсулирует логику проверки рабочих часов, конфликтов и вместимости.
    """
    def __init__(self, facility: 'Facility', request_time: Optional[datetime] = None):
        """
        Инициализирует сервис.
        Args:
            facility: Экземпляр модели Facility.
            request_time: Время, относительно которого производятся проверки (например, lead time).
                          Если None, используется timezone.now().
        """
        if not facility:
            # Это не должно происходить, если вызывающий код корректен,
            # но добавим проверку для надежности.
            logger.error("FacilityAvailabilityService initialized with no facility.")
            raise ValueError("Facility object must be provided to FacilityAvailabilityService.")
            
        self.facility = facility
        self.request_time = request_time or timezone.localtime(timezone.now())
        # Импортируем FacilityModel внутри, чтобы избежать циклических импортов на уровне модуля,
        # если Facility импортирует что-то, что зависит от этого файла (маловероятно, но безопасно).
        from .models import Facility as FacilityModelAlias
        self.FacilityModel = FacilityModelAlias


    def _is_facility_operational_at(self, check_datetime_start: datetime) -> Tuple[bool, Optional[str]]:
        """
        Проверяет, работает ли объект в указанный день и время, и не нарушено ли время до бронирования.
        Возвращает (is_operational, reason_if_not_operational).
        """
        check_date_local = timezone.localtime(check_datetime_start).date()
        check_time_start_local = timezone.localtime(check_datetime_start).time()

        # 1. Проверка рабочего дня
        day_of_week_py = check_date_local.weekday()
        if not self.facility.is_working_on_day(day_of_week_py):
            return False, REASON_CLOSED_DAY

        # 2. Проверка рабочего времени
        facility_open_time = self.facility.open_time
        facility_close_time = self.facility.close_time
        is_within_working_hours = False

        if facility_close_time == time(0, 0): 
            if check_time_start_local >= facility_open_time:
                is_within_working_hours = True
        else: 
            slot_end_time_local = (datetime.combine(check_date_local, check_time_start_local) + timedelta(hours=1)).time()
            if check_time_start_local >= facility_open_time and slot_end_time_local <= facility_close_time:
                 is_within_working_hours = True
        
        if not is_within_working_hours:
            return False, REASON_CLOSED_TIME

        # 3. Проверка ограничения по времени до начала бронирования
        booking_lead_time_minutes = getattr(settings, 'BOOKING_LEAD_TIME_MINUTES', 10)
        if check_datetime_start < (self.request_time + timedelta(minutes=booking_lead_time_minutes)):
            return False, REASON_LEAD_TIME_RESTRICTION
            
        return True, None

    def _count_active_conflicting_orders(
        self, 
        check_date: dt_date, 
        check_time: time, 
        exclude_order_id: Optional[Union[int, str, UUID]]
    ) -> int:
        """
        Подсчитывает количество активных заказов (Order), конфликтующих с указанным временем.
        """
        count = 0
        potential_conflicts_qs = Order.objects.filter(
            facility_id=self.facility.id, # Используем facility_id для фильтрации
            status__in=Order.STATUS_CREATES_CONFLICT
        )

        if exclude_order_id:
            potential_conflicts_qs = potential_conflicts_qs.exclude(id=exclude_order_id)
        
        for order in potential_conflicts_qs:
            if order.is_active_for_conflict_check(check_date, check_time):
                count += 1
        return count

    def check_slot_availability(
        self,
        check_datetime_start: datetime,
        capacity_needed: int = 1,
        exclude_order_id: Optional[Union[int, str, UUID]] = None,
    ) -> AvailabilityResult:
        """
        Проверяет доступность ОДНОГО конкретного временного слота.
        """
        # Определяем базовую максимальную вместимость для ответа
        if self.facility.booking_type == self.FacilityModel.BOOKING_TYPE_EXCLUSIVE:
            base_max_capacity = 1
        elif self.facility.booking_type == self.FacilityModel.BOOKING_TYPE_OVERLAPPING:
            base_max_capacity = self.facility.max_capacity if self.facility.max_capacity and self.facility.max_capacity > 0 else 0
        else:
            base_max_capacity = 0 

        try:
            is_operational, reason_not_operational = self._is_facility_operational_at(check_datetime_start)
            if not is_operational:
                return { 
                    "is_available": False, "reason": reason_not_operational, 
                    "booked_slots_count": 0, "available_spots": 0, 
                    "max_capacity": base_max_capacity 
                }

            check_date_local = timezone.localtime(check_datetime_start).date()
            check_time_start_local = timezone.localtime(check_datetime_start).time()
            
            total_booked_count = self._count_active_conflicting_orders(
                check_date_local, 
                check_time_start_local, 
                exclude_order_id
            )

            current_max_capacity = base_max_capacity # Используем уже определенную base_max_capacity
            
            if self.facility.booking_type == self.FacilityModel.BOOKING_TYPE_EXCLUSIVE:
                # current_max_capacity уже 1
                if total_booked_count >= current_max_capacity:
                    return { "is_available": False, "reason": REASON_FULLY_BOOKED_EXCLUSIVE, "booked_slots_count": total_booked_count, "available_spots": 0, "max_capacity": current_max_capacity }
            
            elif self.facility.booking_type == self.FacilityModel.BOOKING_TYPE_OVERLAPPING:
                if current_max_capacity == 0: # Это уже REASON_FACILITY_MISCONFIGURED_CAPACITY
                    return { "is_available": False, "reason": REASON_FACILITY_MISCONFIGURED_CAPACITY, "booked_slots_count": total_booked_count, "available_spots": 0, "max_capacity": 0 }
                
                if (total_booked_count + capacity_needed) > current_max_capacity:
                    return { "is_available": False, "reason": REASON_MAX_CAPACITY_REACHED, "booked_slots_count": total_booked_count, "available_spots": max(0, current_max_capacity - total_booked_count), "max_capacity": current_max_capacity }
            
            # Если все проверки пройдены, слот доступен
            available_spots_calculated = 0
            if current_max_capacity > 0 : # Для EXCLUSIVE или OVERLAPPING
                 available_spots_calculated = max(0, current_max_capacity - total_booked_count)
            
            # Для эксклюзивного, если не занято, всегда 1 свободное место
            if self.facility.booking_type == self.FacilityModel.BOOKING_TYPE_EXCLUSIVE and total_booked_count == 0:
                available_spots_calculated = 1
            
            return { 
                "is_available": True, "reason": REASON_AVAILABLE, 
                "booked_slots_count": total_booked_count, 
                "available_spots": available_spots_calculated, 
                "max_capacity": current_max_capacity 
            }
        except Exception as e:
            logger.error(f"Error in check_slot_availability for facility {self.facility.id} at {check_datetime_start}: {e}", exc_info=True)
            return {
                "is_available": False, "reason": REASON_UNKNOWN_ERROR,
                "booked_slots_count": 0, "available_spots": 0,
                "max_capacity": base_max_capacity, "error_message": str(e)
            }

# Оставляем старую функцию как обертку для обратной совместимости,
# либо полностью переходим на использование сервиса.
# Для чистоты кода, лучше везде использовать сервис.
# Если get_detailed_availability больше нигде не нужна, ее можно удалить.
# Пока оставим, но помеметим как deprecated или для внутреннего использования.

def get_detailed_availability(
    facility: 'Facility',
    check_datetime_start: datetime,
    capacity_needed: int = 1,
    exclude_order_id: Optional[Union[int, str, UUID]] = None,
    # request_time: Optional[datetime] = None # Если хотим передавать время запроса
) -> AvailabilityResult:
    """
    Обертка для FacilityAvailabilityService.check_slot_availability.
    Предпочтительно использовать экземпляр FacilityAvailabilityService напрямую.
    """
    # logger.warning("get_detailed_availability function is deprecated. Use FacilityAvailabilityService instead.")
    service = FacilityAvailabilityService(facility) # request_time будет timezone.now()
    return service.check_slot_availability(check_datetime_start, capacity_needed, exclude_order_id)