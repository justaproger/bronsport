from typing import Optional, Dict, Any, Union
from uuid import UUID
from datetime import time, timedelta, datetime, date as dt_date
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
import logging # Добавим логирование

from facilities.models import Facility
# --- ИЗМЕНЕНИЕ: Импортируем сервис ---
from facilities.availability_checker import FacilityAvailabilityService 
# --- КОНЕЦ ИЗМЕНЕНИЯ ---
from .models import Order 

logger = logging.getLogger(__name__)

def check_order_conflicts(
    facility: Facility, 
    order_type: str, 
    params_for_check: Dict[str, Any], 
    exclude_order_id: Optional[Union[int, str, UUID]] = None,
    request_time_for_service: Optional[datetime] = None # Для передачи в сервис
) -> Optional[str]:
    """
    Проверяет конфликты для создаваемого заказа (брони или подписки).
    Использует FacilityAvailabilityService.check_slot_availability для каждого релевантного слота.
    """
    current_tz = timezone.get_current_timezone()
    
    # --- ИЗМЕНЕНИЕ: Создаем экземпляр сервиса ---
    # request_time_for_service можно передавать из view, если там оно фиксируется, 
    # иначе сервис сам возьмет timezone.now()
    availability_service = FacilityAvailabilityService(facility, request_time=request_time_for_service)
    # --- КОНЕЦ ИЗМЕНЕНИЯ ---

    if order_type == Order.TYPE_SUBSCRIPTION:
        try:
            start_date_obj = dt_date.fromisoformat(params_for_check['start_date'])
            end_date_obj = dt_date.fromisoformat(params_for_check['end_date'])
            days_list_int = params_for_check['days_of_week'] 
            times_list_str = params_for_check['start_times'] 
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"Invalid params for subscription conflict check: {params_for_check}. Error: {e}")
            return _("Ошибка в параметрах для проверки конфликтов подписки.")

        current_iter_date = start_date_obj
        while current_iter_date <= end_date_obj:
            if current_iter_date.weekday() in days_list_int:
                for time_str in times_list_str:
                    try:
                        slot_time_obj = time.fromisoformat(time_str)
                    except ValueError:
                        logger.warning(f"Invalid time format '{time_str}' in subscription params.")
                        return _("Некорректный формат времени '{time_val}' для подписки.").format(time_val=time_str)
                    
                    check_dt_start_naive = datetime.combine(current_iter_date, slot_time_obj)
                    check_dt_start_aware = timezone.make_aware(check_dt_start_naive, current_tz)
                    
                    # --- ИЗМЕНЕНИЕ: Вызываем метод сервиса ---
                    availability_result = availability_service.check_slot_availability(
                        check_datetime_start=check_dt_start_aware,
                        capacity_needed=1, 
                        exclude_order_id=exclude_order_id
                    )
                    # --- КОНЕЦ ИЗМЕНЕНИЯ ---

                    if not availability_result["is_available"]:
                        reason = availability_result.get("reason", "unknown") # Добавил .get
                        # Логируем детали конфликта
                        logger.info(
                            f"Subscription conflict for facility {facility.id}: "
                            f"Date: {current_iter_date}, Time: {time_str}, Reason: {reason}, "
                            f"Details: {availability_result}"
                        )
                        return _("Конфликт для подписки: {date} {time} (Причина: {reason_key})").format(
                            date=current_iter_date.strftime('%d.%m.%Y'), 
                            time=time_str, 
                            reason_key=reason # Используем ключ причины из результата
                        )
            current_iter_date += timedelta(days=1)

    elif order_type == Order.TYPE_SLOT_BOOKING:
        try:
            booking_date_obj = dt_date.fromisoformat(params_for_check['date'])
            slots_list_str = params_for_check.get('slots', []) 
            if not slots_list_str:
                 logger.warning("No slots provided for slot booking conflict check.")
                 return _("Для слотового бронирования не переданы слоты для проверки конфликтов.")
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"Invalid params for slot booking conflict check: {params_for_check}. Error: {e}")
            return _("Ошибка в параметрах для проверки конфликтов слотового бронирования.")

        for slot_str in slots_list_str:
            try:
                slot_time_obj = time.fromisoformat(slot_str)
            except ValueError:
                logger.warning(f"Invalid time format '{slot_str}' in slot booking params.")
                return _("Некорректный формат времени '{time_val}' для слота.").format(time_val=slot_str)

            check_dt_start_naive = datetime.combine(booking_date_obj, slot_time_obj)
            check_dt_start_aware = timezone.make_aware(check_dt_start_naive, current_tz)
            
            # --- ИЗМЕНЕНИЕ: Вызываем метод сервиса ---
            availability_result = availability_service.check_slot_availability(
                check_datetime_start=check_dt_start_aware,
                capacity_needed=1, 
                exclude_order_id=exclude_order_id
            )
            # --- КОНЕЦ ИЗМЕНЕНИЯ ---

            if not availability_result["is_available"]:
                reason = availability_result.get("reason", "unknown")
                logger.info(
                    f"Slot booking conflict for facility {facility.id}: "
                    f"Date: {booking_date_obj}, Time: {slot_str}, Reason: {reason}, "
                    f"Details: {availability_result}"
                )
                return _("Конфликт для бронирования: {date} {time} (Причина: {reason_key})").format(
                    date=booking_date_obj.strftime('%d.%m.%Y'), 
                    time=slot_str, 
                    reason_key=reason
                )
    return None