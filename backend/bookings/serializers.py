from rest_framework import serializers
from django.utils.translation import gettext_lazy as _
from datetime import time, timedelta, date as dt_date, datetime
from decimal import Decimal

from .models import Order, PaymentTransaction # Импортируем новые модели
# FacilityListSerializer будет использоваться для вложенного представления объекта
# Предполагаем, что он останется в facilities.serializers или будет доступен
try:
    from facilities.serializers import FacilityListSerializer as BaseFacilityListSerializerForOrder
    # Переименовываем, чтобы избежать путаницы, если FacilityListSerializer есть и здесь
except ImportError:
    print("Warning [bookings.serializers.Order]: Could not import FacilityListSerializer from facilities.serializers. Using simple string representation for facility.")
    # Заглушка, если сериализатор объекта недоступен
    class BaseFacilityListSerializerForOrder(serializers.ModelSerializer): # type: ignore
        class Meta:
            model = None # Должен быть Facility, но он не импортирован
            fields = ['id', 'name'] # Минимальный набор
    # В реальном проекте нужно убедиться, что этот импорт работает

# Сериализатор для объекта Facility, используемый внутри OrderSerializer
# Можно взять существующий SimpleFacilitySerializerForBooking и адаптировать,
# или создать новый, если нужны другие поля.
# Оставим SimpleFacilitySerializerForBooking, так как он уже содержит нужные поля.
class SimpleFacilitySerializerForOrder(serializers.ModelSerializer):
     university_id = serializers.IntegerField(source='university.id', read_only=True, allow_null=True)
     university_name = serializers.CharField(source='university.name', read_only=True, allow_null=True)
     university_short_name = serializers.CharField(source='university.short_name', read_only=True, allow_null=True)
     # Добавим поля, которые могут быть полезны для отображения заказа
     main_image = serializers.ImageField(read_only=True, allow_null=True)
     facility_type = serializers.CharField(read_only=True, allow_null=True) # Код типа
     booking_type = serializers.CharField(read_only=True, allow_null=True)  # Код типа бронирования
     open_time = serializers.TimeField(read_only=True, allow_null=True)
     close_time = serializers.TimeField(read_only=True, allow_null=True)
     
     class Meta:
         # Убедимся, что модель Facility доступна здесь
         # Если Facility не импортирован глобально, нужно будет это обработать
         model = Order.facility.field.related_model # Получаем модель Facility через связь
         fields = [
             'id', 'name', 
             'university_id', 'university_name', 'university_short_name',
             'main_image', 'facility_type', 'booking_type',
             'price_per_hour', # Цена объекта (может отличаться от цены заказа, если были скидки/наценки)
             'open_time', 'close_time',
         ]

class OrderSerializer(serializers.ModelSerializer):
    """
    Универсальный сериализатор для модели Order.
    Включает поля, специфичные для каждого типа заказа, которые будут null/отсутствовать, если не применимы.
    """
    user_email = serializers.EmailField(source='user.email', read_only=True)
    facility = SimpleFacilitySerializerForOrder(read_only=True)
    
    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    # Поля для SLOT_BOOKING
    # `slots` уже есть в модели, будет сериализован как JSON

    # Поля для SUBSCRIPTION
    # `days_of_week` и `subscription_times` уже есть в модели
    # Добавим отображаемые значения для дней и времени подписки
    subscription_days_display = serializers.SerializerMethodField(read_only=True)
    subscription_times_display = serializers.SerializerMethodField(read_only=True)
    
    # Поле для отображения основного времени/диапазона заказа
    display_time_range = serializers.SerializerMethodField(read_only=True)
    # Поле для отображения основной даты/периода заказа
    display_date_period = serializers.SerializerMethodField(read_only=True)


    class Meta:
        model = Order
        fields = [
            'id', 'order_code', 'user_email', 'facility', 
            'order_type', 'order_type_display',
            'status', 'status_display', 
            'total_price', 
            'payment_transaction_link_id', # ID транзакции
            'created_at', 'updated_at',

            # Поля для бронирований (entry_fee, slot_booking)
            'booking_date', 
            
            # Поля для slot_booking
            'slots', 
            
            # Поля для subscription
            'subscription_start_date', 'subscription_end_date',
            'days_of_week', 'subscription_times', 'duration_per_slot_hours',
            'subscription_days_display', 'subscription_times_display',

            # Общие отображаемые поля
            'display_time_range', 'display_date_period',
        ]
        read_only_fields = [
            'id', 'order_code', 'user_email', 'facility', 
            'order_type_display', 'status_display', 
            'payment_transaction_link_id', 'created_at', 'updated_at',
            'subscription_days_display', 'subscription_times_display',
            'display_time_range', 'display_date_period',
        ]
        # Глубина для вложенных объектов не нужна, т.к. используем кастомные сериализаторы
        # depth = 1 

    def get_subscription_days_display(self, obj: Order) -> str:
        if obj.order_type == Order.TYPE_SUBSCRIPTION:
            # Используем метод модели, если он есть, или реализуем логику здесь
            # Предполагаем, что в модели Order будет метод get_parsed_days_of_week_display()
            if hasattr(obj, 'get_parsed_days_of_week_display'):
                 # get_parsed_days_of_week_display должен возвращать список строк
                 return ", ".join(obj.get_parsed_days_of_week_display())
            # Fallback, если метода нет
            parsed_days = obj.get_parsed_days_of_week()
            if parsed_days:
                # Нужна карта дней для перевода (можно импортировать или определить локально)
                # Для примера, используем простую карту
                day_map_temp = {0: _("Пн"), 1: _("Вт"), 2: _("Ср"), 3: _("Чт"), 4: _("Пт"), 5: _("Сб"), 6: _("Вс")}
                return ", ".join(str(day_map_temp.get(d, '?')) for d in parsed_days)
        return ""

    def get_subscription_times_display(self, obj: Order) -> str:
        if obj.order_type == Order.TYPE_SUBSCRIPTION:
            parsed_times = obj.get_parsed_subscription_times() # Список строк HH:MM
            if parsed_times:
                duration_hours = obj.duration_per_slot_hours or 1
                return ", ".join(
                    f"{t_str}-{(datetime.combine(dt_date.min, time.fromisoformat(t_str)) + timedelta(hours=duration_hours)).time().strftime('%H:%M')}"
                    for t_str in parsed_times
                )
        return ""

    def get_display_time_range(self, obj: Order) -> str:
        if obj.order_type == Order.TYPE_SLOT_BOOKING:
            return obj.get_ordered_slots_display() # Используем метод модели
        elif obj.order_type == Order.TYPE_ENTRY_FEE:
            if obj.facility and obj.facility.open_time and obj.facility.close_time:
                return f"{obj.facility.open_time.strftime('%H:%M')} - {obj.facility.close_time.strftime('%H:%M')}"
        elif obj.order_type == Order.TYPE_SUBSCRIPTION:
            return self.get_subscription_times_display(obj) # Используем уже вычисленное поле
        return "-"

    def get_display_date_period(self, obj: Order) -> str:
        if obj.order_type == Order.TYPE_ENTRY_FEE or obj.order_type == Order.TYPE_SLOT_BOOKING:
            return obj.booking_date.strftime('%d.%m.%Y') if obj.booking_date else "-"
        elif obj.order_type == Order.TYPE_SUBSCRIPTION:
            start = obj.subscription_start_date.strftime('%d.%m.%Y') if obj.subscription_start_date else "?"
            end = obj.subscription_end_date.strftime('%d.%m.%Y') if obj.subscription_end_date else "?"
            return f"{start} - {end}"
        return "-"

# Сериализатор для PaymentTransaction (адаптируем, если нужно)
class PaymentTransactionSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    item_type_at_creation_display = serializers.CharField(source='get_item_type_at_creation_display', read_only=True)
    
    # Ссылка на созданный Order (если есть)
    # created_order = OrderSerializer(read_only=True) # Можно вложить, если нужно много деталей
    created_order_id = serializers.PrimaryKeyRelatedField(source='created_order.id', read_only=True)
    created_order_code = serializers.CharField(source='created_order.order_code', read_only=True, allow_null=True)


    class Meta:
        model = PaymentTransaction
        fields = [
            'transaction_id', 'user_email', 
            'item_type_at_creation', 'item_type_at_creation_display', 
            'item_parameters', # Это JSON с параметрами на момент создания сессии Stripe
            'amount', 
            'stripe_session_id', 'stripe_payment_intent_id', 'stripe_charge_id', 'stripe_refund_id',
            'status', 'status_display', 
            'expires_at', 'created_at', 'updated_at',
            'created_order_id', 'created_order_code' # Ссылки на Order
        ]
        read_only_fields = fields