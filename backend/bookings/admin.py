# --- START OF FULL MODIFIED backend/bookings/admin.py ---
from django.contrib import admin, messages
from django.utils.html import format_html
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
import json 
from datetime import datetime, time, date as dt_date, timedelta

from .models import Order, PaymentTransaction # Наши модели
from core.utils import get_admin_university_details # Хелпер для прав доступа

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id', 
        'order_code',
        'user_link',
        'facility_link',
        'order_type_display', 
        'display_order_dates', 
        'display_order_specifics',
        'status',
        'total_price_formatted',
        'created_at_formatted',
        'payment_transaction_status', # Отобразим статус связанной транзакции
    )
    list_filter = (
        'order_type',
        'status',
        'facility__university', 
        'facility',
        'user',
        'created_at', 
        'booking_date', 
        'subscription_start_date', 
    )
    search_fields = (
        'id', 'order_code', 'user__email', 'user__first_name', 'user__last_name', 'facility__name',
        'payment_transaction_link__transaction_id', # Поиск по ID нашей PaymentTransaction
        'payment_transaction_link__paycom_id',      # Поиск по ID транзакции Paycom
    )
    list_select_related = ('user', 'facility', 'facility__university', 'payment_transaction_link')
    autocomplete_fields = ('user', 'facility') # Оставляем, если удобно выбирать так
    
    date_hierarchy = 'created_at'
    list_per_page = 25

    fieldsets = (
        (None, {
            'fields': ('status', 'order_code', 'order_type', 'user', 'facility', 'total_price')
        }),
        (_('Детали бронирования/входа (если применимо)'), {
            'classes': ('collapse',), # Сворачиваемая секция
            'fields': ('booking_date', 'slots_formatted_display_admin') # Используем метод для JSON
        }),
        (_('Детали подписки (если применимо)'), {
            'classes': ('collapse',),
            'fields': ('subscription_start_date', 'subscription_end_date', 'days_of_week', 'subscription_times', 'duration_per_slot_hours')
        }),
        (_('Связанная транзакция и даты'), {
            'classes': ('collapse',),
            'fields': ('payment_transaction_link_display', 'created_at_formatted_form', 'updated_at_formatted_form')
        }),
    )

    @admin.display(description=_('Тип заказа'), ordering='order_type')
    def order_type_display(self, obj: Order):
        return obj.get_order_type_display()

    @admin.display(description=_('Даты/Период'))
    def display_order_dates(self, obj: Order):
        # ... (код этого метода без изменений) ...
        if obj.order_type == Order.TYPE_ENTRY_FEE or obj.order_type == Order.TYPE_SLOT_BOOKING:
            return obj.booking_date.strftime('%d.%m.%Y') if obj.booking_date else '-'
        elif obj.order_type == Order.TYPE_SUBSCRIPTION:
            start = obj.subscription_start_date.strftime('%d.%m.%Y') if obj.subscription_start_date else '?'
            end = obj.subscription_end_date.strftime('%d.%m.%Y') if obj.subscription_end_date else '?'
            return f"{start} - {end}"
        return '-'

    @admin.display(description=_('Детализация (Слоты/Время)'))
    def display_order_specifics(self, obj: Order):
        # ... (код этого метода без изменений, но можно улучшить читаемость для подписок) ...
        if obj.order_type == Order.TYPE_SLOT_BOOKING:
            return obj.get_ordered_slots_display() or "-"
        elif obj.order_type == Order.TYPE_SUBSCRIPTION:
            days_str_list = obj.get_parsed_days_of_week_display() 
            days_str = ", ".join(days_str_list) if days_str_list else '-'
            times_list = obj.get_parsed_subscription_times()
            times_str = "-"
            if times_list:
                duration = obj.duration_per_slot_hours or 1
                formatted_times_with_duration = []
                for t_str in times_list:
                    try:
                        start_time_obj = time.fromisoformat(t_str)
                        end_time_obj = (datetime.combine(dt_date.min, start_time_obj) + timedelta(hours=duration)).time()
                        formatted_times_with_duration.append(f"{start_time_obj.strftime('%H:%M')}-{end_time_obj.strftime('%H:%M')}")
                    except ValueError:
                        formatted_times_with_duration.append(t_str) 
                times_str = ", ".join(formatted_times_with_duration)
            return f"{_('Дни')}: {days_str}; {_('Время')}: {times_str or '-'}"
        return '-'
    
    @admin.display(description=_('Сумма'), ordering='total_price')
    def total_price_formatted(self, obj:Order):
        return f"{obj.total_price:,.0f} {_('сум')}".replace(",", " ") if obj.total_price is not None else "-"

    @admin.display(description=_('Создан'), ordering='created_at')
    def created_at_formatted(self, obj:Order):
        return obj.created_at.strftime('%d.%m.%Y %H:%M') if obj.created_at else "-"

    @admin.display(description=_('Пользователь'), ordering='user__email')
    def user_link(self, obj: Order):
        # ... (код без изменений) ...
        if obj.user:
            try: link = reverse("admin:core_user_change", args=[obj.user.id]); return format_html('<a href="{}">{}</a>', link, obj.user.get_full_name() or obj.user.email)
            except Exception: return obj.user.get_full_name() or obj.user.email
        return "-"

    @admin.display(description=_('Объект'), ordering='facility__name')
    def facility_link(self, obj: Order):
        # ... (код без изменений) ...
         if obj.facility:
            uni_name = obj.facility.university.short_name or obj.facility.university.name if obj.facility.university else _("Без университета")
            try: link = reverse("admin:facilities_facility_change", args=[obj.facility.id]); return format_html('<a href="{}">{} ({})</a>', link, obj.facility.name, uni_name)
            except Exception: return f"{obj.facility.name} ({uni_name})"
         return "-"

    @admin.display(description=_('Статус Транз.'))
    def payment_transaction_status(self, obj: Order):
        if obj.payment_transaction_link:
            return obj.payment_transaction_link.get_status_display()
        return _("Нет транзакции")
    payment_transaction_status.admin_order_field = 'payment_transaction_link__status'


    # --- Динамические поля и readonly поля для формы редактирования ---
    # get_fields и get_readonly_fields остаются в целом как были, 
    # но нужно убедиться, что они корректно обрабатывают отсутствие специфичных полей Stripe
    # и, возможно, отображают новые поля Paycom из PaymentTransaction, если это нужно.
    # Основная логика скрытия/отображения полей в зависимости от order_type остается.

    def get_fields(self, request, obj=None):
        base_fields = ['status', 'order_code', 'order_type', 'user_link_display', 'facility_link_display', 
                       'payment_transaction_link_display', 'total_price_display',
                       'created_at_formatted_form', 'updated_at_formatted_form']
        
        specific_fields = []
        if obj:
            if obj.order_type == Order.TYPE_ENTRY_FEE:
                specific_fields = ['booking_date']
            elif obj.order_type == Order.TYPE_SLOT_BOOKING:
                specific_fields = ['booking_date', 'slots_formatted_display_admin'] 
            elif obj.order_type == Order.TYPE_SUBSCRIPTION:
                specific_fields = [
                    'subscription_start_date', 'subscription_end_date', 
                    'days_of_week', 'subscription_times', 'duration_per_slot_hours'
                ]
        else: # Для страницы добавления (которая запрещена)
             specific_fields = ['booking_date', 'slots_formatted_display_admin', 'subscription_start_date', 
                                'subscription_end_date', 'days_of_week', 'subscription_times', 'duration_per_slot_hours']
        return base_fields + specific_fields

    def get_readonly_fields(self, request, obj=None):
        if not obj: # Для страницы добавления (запрещено)
            return [f for f in self.get_fields(request, obj) if f != 'status']

        readonly_set = {
            'order_code', 'order_type', 'user_link_display', 'facility_link_display', 
            'payment_transaction_link_display', 'total_price_display',
            'created_at_formatted_form', 'updated_at_formatted_form',
            'slots_formatted_display_admin'
        }
        # Поля, которые всегда readonly, кроме статуса (если есть права)
        always_readonly_model_fields = ['total_price'] 
        for f in always_readonly_model_fields: readonly_set.add(f)

        # Определяем, может ли текущий пользователь редактировать статус
        can_edit_status = False
        if request.user.is_superuser:
            can_edit_status = True
        else:
            admin_university_obj = get_admin_university_details(request.user)
            if obj.facility and hasattr(obj.facility, 'university') and obj.facility.university == admin_university_obj:
                can_edit_status = True
        
        if not can_edit_status:
            readonly_set.add('status')
        
        # Все специфичные для типа поля делаем readonly, если пользователь не суперюзер
        # или если это не "их" тип заказа
        type_specific_fields_map = {
            Order.TYPE_ENTRY_FEE: ['booking_date'],
            Order.TYPE_SLOT_BOOKING: ['booking_date', 'slots'], # 'slots' - это JSON поле
            Order.TYPE_SUBSCRIPTION: ['subscription_start_date', 'subscription_end_date', 
                                      'days_of_week', 'subscription_times', 'duration_per_slot_hours']
        }
        all_type_specific_model_fields = [item for sublist in type_specific_fields_map.values() for item in sublist]

        current_type_specific_fields = type_specific_fields_map.get(obj.order_type, [])
        
        for field_name in all_type_specific_model_fields:
            if field_name not in current_type_specific_fields: # Если поле не относится к текущему типу
                readonly_set.add(field_name)
            elif not request.user.is_superuser: # Если не суперюзер, все специфичные поля readonly
                readonly_set.add(field_name)
            
        return tuple(readonly_set)

    # Методы для отображения в форме (display_method_fields_for_form)
    @admin.display(description=_('Пользователь'))
    def user_link_display(self, obj: Order): return self.user_link(obj)
    
    @admin.display(description=_('Объект'))
    def facility_link_display(self, obj: Order): return self.facility_link(obj)

    @admin.display(description=_('Сумма'))
    def total_price_display(self, obj: Order): return self.total_price_formatted(obj)

    @admin.display(description=_('Платежная транзакция'))
    def payment_transaction_link_display(self, obj: Order):
        if obj.payment_transaction_link:
            ptx = obj.payment_transaction_link
            try:
                link = reverse("admin:bookings_paymenttransaction_change", args=[ptx.transaction_id])
                status_display = ptx.get_status_display()
                paycom_id_short = f" (Payme: ...{str(ptx.paycom_id)[-6:]})" if ptx.paycom_id else ""
                return format_html('<a href="{}">Транзакция {}... ({}){}</a>', 
                                   link, str(ptx.transaction_id)[:8], status_display, paycom_id_short)
            except Exception: 
                return f"Транзакция {str(ptx.transaction_id)[:8]}... ({ptx.get_status_display()})"
        return "-"
    payment_transaction_link_display.admin_order_field = 'payment_transaction_link'

    @admin.display(description=_('Забронированные слоты (JSON)'))
    def slots_formatted_display_admin(self, obj: Order): # Переименовал, чтобы не конфликтовать с list_display
        if obj.order_type == Order.TYPE_SLOT_BOOKING and obj.slots:
            try:
                if isinstance(obj.slots, list): # Проверяем, что это список
                    return format_html("<pre>{}</pre>", json.dumps(obj.slots, indent=2, ensure_ascii=False))
                elif isinstance(obj.slots, str): # Если вдруг строка
                     return format_html("<pre>{}</pre>", json.dumps(json.loads(obj.slots), indent=2, ensure_ascii=False))
            except (json.JSONDecodeError, TypeError): return str(obj.slots)
        return "-"
    
    @admin.display(description=_('Создан'))
    def created_at_formatted_form(self, obj:Order): return obj.created_at.strftime('%d.%m.%Y %H:%M:%S') if obj.created_at else "-"
    
    @admin.display(description=_('Обновлен'))
    def updated_at_formatted_form(self, obj:Order): return obj.updated_at.strftime('%d.%m.%Y %H:%M:%S') if obj.updated_at else "-"

    # --- Права доступа и queryset (остаются как были) ---
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        admin_university_obj = get_admin_university_details(request.user)
        if admin_university_obj is None: return qs
        elif admin_university_obj != -1: return qs.filter(facility__university=admin_university_obj)
        else: return qs.none()
    def has_add_permission(self, request): return False # Заказы создаются через платежную систему
    def has_change_permission(self, request, obj=None):
        # ... (логика как была)
        if not obj: return True 
        if request.user.is_superuser: return True
        admin_university_obj = get_admin_university_details(request.user)
        if obj.facility and hasattr(obj.facility, 'university') and obj.facility.university == admin_university_obj:
            return True
        return False
    def has_delete_permission(self, request, obj=None):
        # ... (логика как была)
        if request.user.is_superuser: return True
        admin_university_obj = get_admin_university_details(request.user)
        if not admin_university_obj or admin_university_obj == -1: return False
        if obj is not None: 
            return obj.facility and hasattr(obj.facility, 'university') and obj.facility.university == admin_university_obj
        return True # Разрешаем массовое удаление для админа ВУЗа (если выбраны только его заказы)

@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = (
        'transaction_id_short', 'user_link', 
        'related_order_code_link', # Ссылка на связанный Order
        'item_type_at_creation_display', 
        'amount_formatted', 'status_display', 
        'paycom_id_short', # ID транзакции Paycom
        'paycom_state_display', # Статус в Paycom
        'created_at_formatted', 
    )
    list_filter = ('status', 'item_type_at_creation', 'user', 'created_at', 'paycom_state')
    search_fields = (
        'transaction_id__iexact', 'user__email', 
        'created_order__order_code__iexact', # Поиск по коду заказа
        'paycom_id__iexact',
        # Убираем поиск по полям Stripe
        # 'stripe_session_id__iexact', 'stripe_payment_intent_id__iexact',
    )
    list_select_related = ('user', 'created_order', 'created_order__facility', 'created_order__facility__university') 
    
    readonly_fields = (
        'transaction_id', 'user_link_display', 'created_order_link_display',
        'item_type_at_creation_display_form', 'amount', 
        'item_parameters_formatted',
        'paycom_id', 'paycom_time_created_ms_formatted', 'paycom_state_display_form',
        # Убираем поля Stripe
        # 'stripe_session_id', 'stripe_payment_intent_id', 
        # 'stripe_charge_id', 'stripe_refund_id', 
        'expires_at_formatted', # Оставляем, если поле есть
        'created_at_formatted_form', 'updated_at_formatted_form',
    )
    
    # Поля для формы редактирования (в основном readonly)
    # Статус можно сделать редактируемым для суперюзера
    def get_fields(self, request, obj=None):
        base_fields = [
            'transaction_id', 'user_link_display', 
            'created_order_link_display',
            'item_type_at_creation_display_form', 'amount', 
            'item_parameters_formatted',
            'paycom_id', 'paycom_time_created_ms_formatted', 
            'expires_at_formatted', 
            'created_at_formatted_form', 'updated_at_formatted_form',
        ]
        if request.user.is_superuser:
            return ['status', 'paycom_state'] + base_fields # Позволяем менять статус и состояние Paycom
        else:
            return ['status_display_form', 'paycom_state_display_form'] + base_fields

    list_per_page = 25

    def has_add_permission(self, request): return False # Транзакции создаются системой
    def has_change_permission(self, request, obj=None): return request.user.is_superuser # Только суперюзер может менять
    def has_delete_permission(self, request, obj=None): return request.user.is_superuser

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            admin_uni_obj = get_admin_university_details(request.user)
            if admin_uni_obj and admin_uni_obj != -1:
                # Показываем транзакции, связанные с заказами этого университета
                return qs.filter(created_order__facility__university=admin_uni_obj)
            return qs.none() 
        return qs

    @admin.display(description=_('ID'), ordering='transaction_id')
    def transaction_id_short(self, obj: PaymentTransaction): return str(obj.transaction_id)[:8] + "..."

    @admin.display(description=_('Пользователь'), ordering='user__email')
    def user_link(self, obj: PaymentTransaction):
        if obj.user:
            try: link = reverse("admin:core_user_change", args=[obj.user.id]); return format_html('<a href="{}">{}</a>', link, obj.user.email)
            except Exception: return obj.user.email
        return "-"
    @admin.display(description=_('Пользователь')) # Для формы
    def user_link_display(self, obj: PaymentTransaction): return self.user_link(obj)

    @admin.display(description=_('Заказ'), ordering='created_order__order_code')
    def related_order_code_link(self, obj: PaymentTransaction):
        if obj.created_order:
            order = obj.created_order
            try: 
                url = reverse(f"admin:bookings_order_change", args=[order.pk])
                return format_html('<a href="{}">{}</a>', url, order.order_code or f"ID: {order.pk}")
            except Exception: return order.order_code or f"ID: {order.pk}"
        return "-"
    @admin.display(description=_('Связанный заказ')) # Для формы
    def created_order_link_display(self, obj: PaymentTransaction): return self.related_order_code_link(obj)


    @admin.display(description=_('Тип (при создании)'), ordering='item_type_at_creation')
    def item_type_at_creation_display(self, obj: PaymentTransaction):
        return obj.get_item_type_at_creation_display()
    @admin.display(description=_('Тип (при создании)')) # Для формы
    def item_type_at_creation_display_form(self, obj: PaymentTransaction): return self.item_type_at_creation_display(obj)

    @admin.display(description=_('Сумма'), ordering='amount')
    def amount_formatted(self, obj: PaymentTransaction):
        return f"{obj.amount:,.0f} {_('сум')}".replace(",", " ") if obj.amount is not None else "-"

    @admin.display(description=_('Статус Bronsport'), ordering='status')
    def status_display(self, obj: PaymentTransaction):
        return obj.get_status_display()
    @admin.display(description=_('Статус Bronsport')) # Для формы
    def status_display_form(self, obj: PaymentTransaction): return self.status_display(obj)

    @admin.display(description=_('Paycom ID'))
    def paycom_id_short(self, obj: PaymentTransaction):
        if obj.paycom_id: return f"...{str(obj.paycom_id)[-10:]}" # Показываем последние 10 символов
        return "-"
    
    @admin.display(description=_('Paycom State'), ordering='paycom_state')
    def paycom_state_display(self, obj: PaymentTransaction):
        if obj.paycom_state is not None:
            # Можно добавить маппинг кодов состояний Paycom на текст
            # 1: создана, 2: завершена, -1: отменена до, -2: отменена после
            state_map = {1: _("Создана (Paycom)"), 2: _("Завершена (Paycom)"), 
                         -1: _("Отменена до пров. (Paycom)"), -2: _("Отменена после пров. (Paycom)")}
            return state_map.get(obj.paycom_state, str(obj.paycom_state))
        return "-"
    @admin.display(description=_('Состояние в Paycom')) # Для формы
    def paycom_state_display_form(self, obj: PaymentTransaction): return self.paycom_state_display(obj)


    @admin.display(description=_('Параметры заказа (JSON)'))
    def item_parameters_formatted(self, obj: PaymentTransaction):
        try:
            params_dict = obj.item_parameters
            if isinstance(params_dict, str): params_dict = json.loads(params_dict)
            return format_html("<pre>{}</pre>", json.dumps(params_dict, indent=2, ensure_ascii=False))
        except (json.JSONDecodeError, TypeError): return str(obj.item_parameters)

    @admin.display(description=_('Создана'), ordering='created_at')
    def created_at_formatted(self, obj: PaymentTransaction): return obj.created_at.strftime('%d.%m.%Y %H:%M') if obj.created_at else "-"
    
    # Для формы
    @admin.display(description=_('Создана'))
    def created_at_formatted_form(self, obj:PaymentTransaction): return obj.created_at.strftime('%d.%m.%Y %H:%M:%S') if obj.created_at else "-"
    @admin.display(description=_('Обновлена'))
    def updated_at_formatted_form(self, obj:PaymentTransaction): return obj.updated_at.strftime('%d.%m.%Y %H:%M:%S') if obj.updated_at else "-"
    @admin.display(description=_('Истекает в (если применимо)'))
    def expires_at_formatted(self, obj:PaymentTransaction): return obj.expires_at.strftime('%d.%m.%Y %H:%M:%S') if obj.expires_at else "-"
    @admin.display(description=_('Время создания в Paycom (мс)'))
    def paycom_time_created_ms_formatted(self, obj:PaymentTransaction):
        if obj.paycom_time_created_ms:
            try: # Попытка конвертировать timestamp в читаемую дату
                dt_object = datetime.fromtimestamp(obj.paycom_time_created_ms / 1000)
                return timezone.localtime(dt_object).strftime('%d.%m.%Y %H:%M:%S.%f')[:-3] # До миллисекунд
            except: return str(obj.paycom_time_created_ms)
        return "-"

# --- END OF FULL MODIFIED backend/bookings/admin.py ---