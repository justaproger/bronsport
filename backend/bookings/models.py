# --- START OF FULL MODIFIED backend/bookings/models.py ---
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError as DjangoValidationError # Переименовали для ясности
from datetime import time, date as dt_date, timedelta, datetime
from django.utils import timezone
import uuid 
from django.conf import settings
from django.core.validators import MinValueValidator

from .constants import DAYS_OF_WEEK_NUMERIC 

try:
    from core.models import User
except ImportError:
    User = settings.AUTH_USER_MODEL # type: ignore

try:
    from facilities.models import Facility
    FACILITY_IMPORTED = True
except ImportError:
    Facility = None # type: ignore
    FACILITY_IMPORTED = False
    # print("Warning [bookings.models.Order]: Could not import Facility model.")


class Order(models.Model):
    TYPE_ENTRY_FEE = 'entry_fee'
    TYPE_SLOT_BOOKING = 'slot_booking'
    TYPE_SUBSCRIPTION = 'subscription'
    ORDER_TYPE_CHOICES = [
        (TYPE_ENTRY_FEE, _('Оплата за вход')),
        (TYPE_SLOT_BOOKING, _('Слотовое бронирование')),
        (TYPE_SUBSCRIPTION, _('Подписка/Абонемент')),
    ]

    STATUS_PENDING_PAYMENT = 'pending_payment'      # Заказ создан, ожидает инициации/завершения оплаты
    STATUS_CONFIRMED = 'confirmed'                  # Оплата прошла, заказ активен
    STATUS_COMPLETED = 'completed'                  # Услуга предоставлена/использована
    STATUS_CANCELLED_USER = 'cancelled_user'        # Отменен пользователем (функционал будущего)
    STATUS_CANCELLED_ADMIN = 'cancelled_admin'      # Отменен системой/администратором (например, по таймауту Paycom до оплаты)
    STATUS_PAYMENT_FAILED = 'payment_failed'        # Платеж не прошел на стороне платежной системы
    STATUS_EXPIRED_AWAITING_PAYMENT = 'expired_awaiting_payment' # Истекло время ожидания оплаты (наш внутренний таймаут или от Paycom)
    STATUS_REFUND_INITIATED = 'refund_initiated'    # Процесс возврата запущен
    STATUS_REFUNDED = 'refunded'                    # Средства успешно возвращены

    ORDER_STATUS_CHOICES = [
        (STATUS_PENDING_PAYMENT, _('Ожидает оплаты')),
        (STATUS_CONFIRMED, _('Подтвержден/Активен')),
        (STATUS_COMPLETED, _('Завершен/Использован')),
        (STATUS_CANCELLED_USER, _('Отменен пользователем')),
        (STATUS_CANCELLED_ADMIN, _('Отменен системой/администратором')),
        (STATUS_PAYMENT_FAILED, _('Ошибка оплаты')),
        (STATUS_EXPIRED_AWAITING_PAYMENT, _('Истекло время ожидания оплаты')),
        (STATUS_REFUND_INITIATED, _('Возврат инициирован')),
        (STATUS_REFUNDED, _('Возвращено')),
    ]
    # Статусы, которые должны учитываться при проверке конфликтов доступности
    STATUS_CREATES_CONFLICT = [STATUS_CONFIRMED, STATUS_PENDING_PAYMENT]

    id = models.BigAutoField(primary_key=True, verbose_name=_("ID Заказа"))
    order_code = models.CharField(
        _("Код заказа"), max_length=30, unique=True, blank=True, db_index=True
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='orders', verbose_name=_("Пользователь")
    )
    facility = models.ForeignKey(
        'facilities.Facility' if not FACILITY_IMPORTED else Facility,
        on_delete=models.CASCADE, related_name='orders', verbose_name=_("Спортивный объект")
    )
    order_type = models.CharField(
        _("Тип заказа"), max_length=20, choices=ORDER_TYPE_CHOICES, db_index=True
    )
    status = models.CharField(
        _("Статус заказа"), max_length=30, choices=ORDER_STATUS_CHOICES,
        default=STATUS_PENDING_PAYMENT, db_index=True # Новый заказ по умолчанию ожидает оплаты
    )
    total_price = models.DecimalField( # Хранится в СУМАХ
        _("Итоговая стоимость (сум)"), max_digits=14, decimal_places=0 
    )
    payment_transaction_link = models.OneToOneField(
        'PaymentTransaction', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_order', verbose_name=_("Связанная платежная транзакция")
    )
    created_at = models.DateTimeField(_("Создано"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Обновлено"), auto_now=True)

    # Поля, специфичные для типов заказов
    booking_date = models.DateField(_("Дата бронирования/входа"), null=True, blank=True, db_index=True)
    slots = models.JSONField(
        _("Забронированные слоты"), null=True, blank=True,
        help_text=_("Для SLOT_BOOKING: [{'start_time': 'HH:MM', 'end_time': 'HH:MM'}, ...]")
    )
    subscription_start_date = models.DateField(_("Дата начала подписки"), null=True, blank=True, db_index=True)
    subscription_end_date = models.DateField(_("Дата окончания подписки"), null=True, blank=True, db_index=True)
    days_of_week = models.CharField(
        _("Дни недели (для подписки)"), max_length=15, null=True, blank=True, help_text=_("Пн=0, Вс=6. Пример: '0,1,2'")
    )
    subscription_times = models.TextField(
        _("Время начала слотов (для подписки)"), null=True, blank=True, help_text=_("HH:MM через запятую. Пример: '18:00,19:00'")
    )
    duration_per_slot_hours = models.PositiveSmallIntegerField(
        _("Длительность 1 слота подписки (часы)"), default=1, null=True, blank=True
    )

    class Meta:
        verbose_name = _("Заказ")
        verbose_name_plural = _("Заказы")
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['facility', 'order_type', 'status']),
            models.Index(fields=['order_code']),
            models.Index(fields=['facility', 'booking_date', 'status']),
            models.Index(fields=['facility', 'subscription_start_date', 'subscription_end_date', 'status']),
        ]

    def __str__(self):
        return f"Заказ {self.order_code or self.pk} ({self.get_order_type_display()})"

    # --- Методы для парсинга и отображения данных заказа ---
    def get_parsed_slots(self) -> list:
        if self.order_type == self.TYPE_SLOT_BOOKING and isinstance(self.slots, list):
            return self.slots
        return []

    def get_ordered_slots_display(self) -> str:
        if self.order_type != self.TYPE_SLOT_BOOKING or not self.slots: return "-"
        try:
            parsed_slots = self.get_parsed_slots()
            if not parsed_slots: return "-"
            valid_slots_data = [s for s in parsed_slots if isinstance(s, dict) and 'start_time' in s and isinstance(s['start_time'], str) and 'end_time' in s]
            if not valid_slots_data: return "-"
            sorted_slots_data = sorted(valid_slots_data, key=lambda s: time.fromisoformat(s['start_time']))
            return ", ".join([f"{s['start_time']}-{s['end_time']}" for s in sorted_slots_data])
        except (ValueError, TypeError, KeyError) as e:
            # logger.error(f"Error formatting slots for Order {self.id} ({self.order_code}): {e}, slots: {self.slots}")
            return str(_("Ошибка формата слотов"))

    def get_parsed_days_of_week(self) -> list[int]:
        if self.order_type == self.TYPE_SUBSCRIPTION and self.days_of_week:
            try: return sorted(list(set(int(d.strip()) for d in self.days_of_week.split(',') if d.strip().isdigit())))
            except ValueError: pass
        return []

    def get_parsed_subscription_times(self) -> list[str]:
        if self.order_type == self.TYPE_SUBSCRIPTION and self.subscription_times:
            return sorted(list(set(t.strip() for t in self.subscription_times.split(',') if t.strip() and len(t.strip()) == 5)))
        return []
    
    def get_parsed_subscription_times_joined(self) -> str: # Новый метод для QR
        if self.order_type == self.TYPE_SUBSCRIPTION:
            parsed_times = self.get_parsed_subscription_times()
            if parsed_times:
                duration_hours = self.duration_per_slot_hours or 1
                return ", ".join(
                    f"{t_str}-{(datetime.combine(dt_date.min, time.fromisoformat(t_str)) + timedelta(hours=duration_hours)).time().strftime('%H:%M')}"
                    for t_str in parsed_times
                )
        return "-"


    def get_parsed_days_of_week_display(self) -> list[str]:
        if self.order_type == self.TYPE_SUBSCRIPTION and self.days_of_week:
            try:
                day_map_display = dict(DAYS_OF_WEEK_NUMERIC) 
                days_int = self.get_parsed_days_of_week()
                return [str(day_map_display.get(d, str(d))) for d in days_int]
            except Exception as e:
                # logger.error(f"Error in get_parsed_days_of_week_display for Order {self.id} ({self.order_code}): {e}")
                return [str(d) for d in self.get_parsed_days_of_week()]
        return []

    def is_active_for_conflict_check(self, check_date: dt_date, check_time: time) -> bool:
        if self.status not in self.STATUS_CREATES_CONFLICT:
            return False
        if self.order_type == self.TYPE_SLOT_BOOKING:
            if self.booking_date == check_date:
                for slot_item in self.get_parsed_slots():
                    try:
                        if isinstance(slot_item, dict) and 'start_time' in slot_item and \
                           time.fromisoformat(slot_item['start_time']) == check_time:
                            return True
                    except (ValueError, KeyError): continue
            return False
        elif self.order_type == self.TYPE_SUBSCRIPTION:
            if not (self.subscription_start_date and self.subscription_end_date): return False
            if not (self.subscription_start_date <= check_date <= self.subscription_end_date): return False
            parsed_days = self.get_parsed_days_of_week()
            parsed_times = self.get_parsed_subscription_times()
            if check_date.weekday() not in parsed_days: return False
            # Проверяем, что check_time совпадает с одним из времен начала слотов подписки
            if check_time.strftime('%H:%M') not in parsed_times: return False 
            return True
        # Для TYPE_ENTRY_FEE, если статус PENDING_PAYMENT или CONFIRMED, он создает конфликт на весь день
        elif self.order_type == self.TYPE_ENTRY_FEE:
            return self.booking_date == check_date 
        return False

    def clean(self):
        super().clean()
        # ... (вся ваша существующая логика clean() остается здесь без изменений)
        if not self.user_id: raise DjangoValidationError({'user': _("Пользователь обязателен.")})
        if not self.facility_id: raise DjangoValidationError({'facility': _("Объект обязателен.")})
        # ... и так далее ...

    def save(self, *args, **kwargs):
        if not self.order_code:
            prefix = "ORD"; date_part_str = timezone.now().strftime('%y%m%d%H%M')
            if self.order_type == self.TYPE_ENTRY_FEE:
                prefix = "E"; date_part_str = self.booking_date.strftime('%y%m%d') if self.booking_date else date_part_str
            elif self.order_type == self.TYPE_SLOT_BOOKING:
                prefix = "SB"; date_part_str = self.booking_date.strftime('%y%m%d') if self.booking_date else date_part_str
            elif self.order_type == self.TYPE_SUBSCRIPTION:
                prefix = "S"; date_part_str = self.subscription_start_date.strftime('%y%m%d') if self.subscription_start_date else date_part_str
            unique_suffix = str(uuid.uuid4().hex)[:6].upper()
            self.order_code = f"{prefix}-{date_part_str}-{unique_suffix}"
            while Order.objects.filter(order_code=self.order_code).exclude(pk=self.pk).exists():
                 unique_suffix = str(uuid.uuid4().hex)[:6].upper()
                 self.order_code = f"{prefix}-{date_part_str}-{unique_suffix}"
        # print(f"--- Вызван save() для Order ID: {self.pk}, Code: {self.order_code}, Status: {self.status} ---")
        super().save(*args, **kwargs)

    # --- НОВЫЕ МЕТОДЫ ДЛЯ QR-СЕРИАЛИЗАТОРА (из вашего предыдущего кода) ---
    def get_display_date_period_for_qr(self) -> str:
        if self.order_type == self.TYPE_ENTRY_FEE or self.order_type == self.TYPE_SLOT_BOOKING:
            return self.booking_date.strftime('%d.%m.%Y') if self.booking_date else "-"
        elif self.order_type == self.TYPE_SUBSCRIPTION:
            start = self.subscription_start_date.strftime('%d.%m.%Y') if self.subscription_start_date else "?"
            end = self.subscription_end_date.strftime('%d.%m.%Y') if self.subscription_end_date else "?"
            return f"{start} - {end}"
        return "-"

    def get_display_time_range_for_qr(self) -> str:
        if self.order_type == self.TYPE_SLOT_BOOKING:
            return self.get_ordered_slots_display()
        elif self.order_type == self.TYPE_ENTRY_FEE:
            if self.facility and self.facility.open_time and self.facility.close_time:
                return f"{self.facility.open_time.strftime('%H:%M')} - {self.facility.close_time.strftime('%H:%M')}"
        elif self.order_type == self.TYPE_SUBSCRIPTION:
            return self.get_parsed_subscription_times_joined()
        return "-"


# --- ОБНОВЛЕННАЯ МОДЕЛЬ PaymentTransaction ---
def default_payment_transaction_expires_at(): # Это было для Stripe
    # Для Paycom нет явного expires_at для сессии, которую мы создаем.
    # Paycom имеет свой таймаут на проведение транзакции (12 часов после CreateTransaction).
    # Можно установить это поле на +12 часов от создания PaymentTransaction, если это нужно для нашей логики.
    # Или оставить null=True, blank=True и не использовать активно для Paycom.
    # Пока оставим как есть, но сделаем поле expires_at опциональным.
    return timezone.now() + timedelta(minutes=30) # Примерный таймаут для Stripe был 30 мин

class PaymentTransaction(models.Model):
    transaction_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, verbose_name=_("ID Внутренней Транзакции"))
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payment_transactions', verbose_name=_("Пользователь"))
    
    # Связь с Order теперь в Order.payment_transaction_link (OneToOne)
    # created_order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment_details') # Уже есть в Order

    item_type_at_creation = models.CharField(
        _("Тип заказа при создании"), max_length=20, 
        choices=Order.ORDER_TYPE_CHOICES, db_index=True,
        help_text=_("Тип заказа, для которого создавалась эта транзакция")
    )
    item_parameters = models.JSONField(
        _("Параметры заказа на момент инициации оплаты"),
        help_text=_("Содержит facility_id, даты, слоты, дни, цену и т.д. для сверки.")
    )
    amount = models.DecimalField(_("Сумма (сум)"), max_digits=14, decimal_places=0)

    # --- Поля для Paycom ---
    paycom_id = models.CharField(
        _("ID транзакции в Paycom"), 
        max_length=255, 
        unique=True, null=True, blank=True, db_index=True,
        help_text=_("Уникальный идентификатор транзакции от Paycom (из CreateTransaction).")
    )
    paycom_time_created_ms = models.BigIntegerField(
        _("Время создания транзакции в Paycom (мс)"),
        null=True, blank=True, 
        help_text=_("Timestamp от Paycom из метода CreateTransaction (params.time).")
    )
    paycom_state = models.IntegerField(
        _("Состояние транзакции в Paycom"), 
        null=True, blank=True,
        help_text=_("1: создана, 2: завершена, -1: отменена до проведения, -2: отменена после проведения.")
    )
    # --- Конец полей для Paycom ---

    # --- Поля Stripe (оставляем как опциональные для исторических данных) ---
    stripe_session_id = models.CharField(_("Stripe Session ID (архив)"), max_length=255, blank=True, null=True, db_index=True, unique=True)
    stripe_payment_intent_id = models.CharField(_("Stripe Payment Intent ID (архив)"), max_length=255, blank=True, null=True, db_index=True, unique=True)
    stripe_charge_id = models.CharField(_("Stripe Charge ID (архив)"), max_length=255, blank=True, null=True, db_index=True)
    stripe_refund_id = models.CharField(_("Stripe Refund ID (архив)"), max_length=255, blank=True, null=True, db_index=True)
    # --- Конец полей Stripe ---

    STATUS_AWAITING_PROVIDER_REDIRECT = 'awaiting_provider_redirect'
    STATUS_PROVIDER_PROCESSING = 'provider_processing'        
    STATUS_PROVIDER_PAYMENT_FAILED = 'provider_payment_failed'  
    STATUS_PROVIDER_EXPIRED = 'provider_expired'            
    STATUS_ORDER_CONFIRMED_BY_PROVIDER = 'order_confirmed_by_provider'
    STATUS_ORDER_CONFIRMATION_FAILED = 'order_confirmation_failed' 
    STATUS_REFUND_PROCESSING = 'refund_processing'            
    STATUS_REFUNDED = 'refunded'                              

    TRANSACTION_STATUS_CHOICES = [
        (STATUS_AWAITING_PROVIDER_REDIRECT, _('Ожидание перехода к оплате')),
        (STATUS_PROVIDER_PROCESSING, _('Обработка платежным провайдером')),
        (STATUS_PROVIDER_PAYMENT_FAILED, _('Ошибка/Отмена оплаты (у провайдера)')),
        (STATUS_PROVIDER_EXPIRED, _('Истек срок оплаты (у провайдера)')),
        (STATUS_ORDER_CONFIRMED_BY_PROVIDER, _('Заказ успешно оплачен и подтвержден')),
        (STATUS_ORDER_CONFIRMATION_FAILED, _('Ошибка подтверждения заказа (требуется возврат)')),
        (STATUS_REFUND_PROCESSING, _('Обработка возврата')),
        (STATUS_REFUNDED, _('Возвращено')),
    ]
    status = models.CharField(
        _("Статус транзакции"), max_length=35, choices=TRANSACTION_STATUS_CHOICES, 
        default=STATUS_AWAITING_PROVIDER_REDIRECT, 
        db_index=True
    )
    
    expires_at = models.DateTimeField(
        _("Время истечения (для неоплаченных)"), 
        null=True, blank=True, # Сделали опциональным
        help_text=_("Если транзакция не будет оплачена до этого времени, она может быть автоматически отменена системой.")
    )
    created_at = models.DateTimeField(_("Создано"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Обновлено"), auto_now=True)

    class Meta:
        verbose_name = _("Платежная транзакция")
        verbose_name_plural = _("Платежные транзакции")
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['status', 'expires_at']),
            models.Index(fields=['paycom_id']),
            models.Index(fields=['stripe_session_id']), 
            models.Index(fields=['stripe_payment_intent_id']),
        ]

    def __str__(self):
        order_code_str = self.created_order.order_code if hasattr(self, 'created_order') and self.created_order else "N/A"
        return f"Транзакция {self.transaction_id} для Заказа {order_code_str} ({self.user.email}) - {self.get_status_display()}"

    def get_order_link(self): # Этот метод уже есть в вашем коде, оставляем
        if hasattr(self, 'created_order') and self.created_order:
            return self.created_order
        return None
    
    # is_stripe_session_expired() - удаляем, т.к. специфично для Stripe
    # def is_stripe_session_expired(self):
    #     return self.stripe_session_id and self.status == 'intent_created' and self.expires_at and timezone.now() > self.expires_at

# --- END OF FULL MODIFIED backend/bookings/models.py ---