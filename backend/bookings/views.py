# --- START OF FULL CORRECTED backend/bookings/views.py ---
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination 
from django.db import transaction as django_db_transaction
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.db.models.functions import Coalesce
from django.utils import timezone, translation 
from dateutil.relativedelta import relativedelta
from datetime import time, timedelta, datetime, date as dt_date
from decimal import Decimal
import uuid 
import logging

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from django.http import Http404
from django.utils.translation import gettext_lazy as _

from payme import Payme as PaymeInitializer # Для генерации ссылки

from .models import Order, PaymentTransaction, Facility # Facility для InputSerializer
from .serializers import OrderSerializer # Для OrderPaymentStatusView
from .order_utils import check_order_conflicts # Для PreparePaycomPaymentView
from .constants import DAYS_OF_WEEK_NUMERIC # Если используется в логике расчета

logger = logging.getLogger(__name__)

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50

class MyUnifiedOrderListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        status_group = self.request.query_params.get('status_group', None) 
        order_type_filter = self.request.query_params.get('order_type')
        queryset = Order.objects.filter(user=user).select_related(
            'facility', 'facility__university', 'payment_transaction_link'
        ).prefetch_related('facility__amenities', 'facility__images')
        if order_type_filter: queryset = queryset.filter(order_type=order_type_filter)
        today = timezone.localdate()
        if status_group == 'active':
            active_filter = Q(status=Order.STATUS_CONFIRMED)
            type_specific_active_conditions = Q() 
            type_specific_active_conditions |= (Q(order_type=Order.TYPE_SUBSCRIPTION) & Q(subscription_start_date__lte=today) & Q(subscription_end_date__gte=today))
            type_specific_active_conditions |= (Q(order_type__in=[Order.TYPE_SLOT_BOOKING, Order.TYPE_ENTRY_FEE]) & Q(booking_date__gte=today))
            queryset = queryset.filter(active_filter & type_specific_active_conditions)
            queryset = queryset.order_by(Coalesce('booking_date', 'subscription_start_date'), 'created_at')
        elif status_group == 'history':
            past_confirmed_subscriptions = Q(order_type=Order.TYPE_SUBSCRIPTION) & Q(status=Order.STATUS_CONFIRMED) & (Q(subscription_start_date__gt=today) | Q(subscription_end_date__lt=today))
            past_confirmed_bookings = Q(order_type__in=[Order.TYPE_SLOT_BOOKING, Order.TYPE_ENTRY_FEE]) & Q(status=Order.STATUS_CONFIRMED) & Q(booking_date__lt=today)
            non_confirmed_statuses = ~Q(status=Order.STATUS_CONFIRMED)
            queryset = queryset.filter(non_confirmed_statuses | past_confirmed_subscriptions | past_confirmed_bookings)
            queryset = queryset.order_by(Coalesce('booking_date', 'subscription_start_date').desc(), '-created_at')
        elif status_group is None:
             if not order_type_filter: logger.warning(f"MyUnifiedOrderListView: status_group is None and order_type_filter is None for user {user.id}. Returning all orders.")
             queryset = queryset.order_by(Coalesce('booking_date', 'subscription_start_date').desc(), '-created_at')
        else: queryset = queryset.none()
        return queryset

class PreparePaycomPaymentInputSerializer(serializers.Serializer):
    item_type = serializers.ChoiceField(choices=Order.ORDER_TYPE_CHOICES, required=True)
    facility_id = serializers.IntegerField(required=True)
    start_date = serializers.DateField(required=False, input_formats=['%Y-%m-%d', '%d.%m.%Y'])
    months = serializers.IntegerField(required=False, min_value=1)
    days_of_week = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=6), required=False, min_length=0, allow_empty=True)
    start_times = serializers.ListField(child=serializers.RegexField(r'^\d{2}:\d{2}$'), required=False, min_length=0, allow_empty=True)
    date = serializers.DateField(required=False, input_formats=['%Y-%m-%d', '%d.%m.%Y']) 
    slots = serializers.ListField(child=serializers.RegexField(r'^\d{2}:\d{2}$'), required=False, min_length=0, allow_empty=True)
    
    def validate(self, data):
        item_type = data.get('item_type'); facility_id = data.get('facility_id'); today = timezone.localdate()
        try:
            facility = Facility.objects.get(pk=facility_id, is_active=True, university__is_active=True)
            data['facility_instance'] = facility
        except Facility.DoesNotExist: raise serializers.ValidationError({'facility_id': _("Объект не найден, неактивен или его университет неактивен.")})
        if item_type == Order.TYPE_SUBSCRIPTION:
            if not all(k in data and (data[k] is not None and data[k] != []) for k in ['start_date', 'months', 'days_of_week', 'start_times']): raise serializers.ValidationError(_("Для подписки не указаны все необходимые параметры (дата начала, длительность, дни, время)."))
            if data['start_date'] < today: raise serializers.ValidationError({'start_date': _("Дата начала подписки не может быть в прошлом.")})
            if facility.booking_type == Facility.BOOKING_TYPE_ENTRY: raise serializers.ValidationError({'facility_id': _("Для этого объекта нельзя оформить подписку.")})
        elif item_type == Order.TYPE_SLOT_BOOKING:
            if not data.get('date') or not data.get('slots'): raise serializers.ValidationError(_("Для слотового бронирования не указаны дата или слоты."))
            if data['date'] < today: raise serializers.ValidationError({'date': _("Дата бронирования не может быть в прошлом.")})
            if facility.booking_type == Facility.BOOKING_TYPE_ENTRY: raise serializers.ValidationError({'facility_id': _("Этот объект предполагает только оплату за вход.")})
        elif item_type == Order.TYPE_ENTRY_FEE:
            if not data.get('date'): raise serializers.ValidationError(_("Для оплаты за вход не указана дата."))
            if data['date'] < today: raise serializers.ValidationError({'date': _("Дата посещения не может быть в прошлом.")})
            if facility.booking_type != Facility.BOOKING_TYPE_ENTRY: raise serializers.ValidationError({'facility_id': _("Этот объект не предполагает оплату за вход без слотов.")})
            if data.get('slots'): raise serializers.ValidationError({'slots': _("Для оплаты за вход не нужно указывать слоты.")})
        return data
    
class PreparePaycomPaymentView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PreparePaycomPaymentInputSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        validated_data = serializer.validated_data
        user = request.user
        item_type = validated_data['item_type']
        facility = validated_data['facility_instance']
        calculated_backend_amount = Decimal(0)
        item_parameters_for_tx = {
            'facility_id': facility.id, 'facility_name': facility.name,
            'price_per_hour_at_creation': str(facility.price_per_hour),
            'order_type_requested': item_type, 'university_id': facility.university_id,
            'university_name': facility.university.name, 'booking_type_at_creation': facility.booking_type,
            'max_capacity_at_creation': facility.max_capacity,
        }
        params_for_conflict_check = {'order_type': item_type}
        order_specific_data = {}
        if item_type == Order.TYPE_SUBSCRIPTION:
            start_date = validated_data['start_date']; months = validated_data['months']
            days_list_int = validated_data['days_of_week']; times_list_str = validated_data['start_times']
            end_date = start_date + relativedelta(months=months) - timedelta(days=1)
            occurrences = 0; current_date_iter = start_date
            if start_date <= end_date:
                while current_date_iter <= end_date:
                    if current_date_iter.weekday() in days_list_int: occurrences += 1
                    current_date_iter += timedelta(days=1)
            total_slots_in_subscription = occurrences * len(times_list_str)
            calculated_backend_amount = Decimal(total_slots_in_subscription) * facility.price_per_hour
            item_parameters_for_tx.update({'subscription_start_date': start_date.isoformat(), 'subscription_end_date': end_date.isoformat(),'months': months, 'days_of_week': days_list_int, 'subscription_times': times_list_str,'duration_per_slot_hours': 1, 'calculated_total_slots': total_slots_in_subscription,})
            params_for_conflict_check.update({'start_date': start_date.isoformat(), 'end_date': end_date.isoformat(),'days_of_week': days_list_int, 'start_times': times_list_str,})
            order_specific_data.update({'subscription_start_date': start_date, 'subscription_end_date': end_date,'days_of_week': ",".join(map(str, days_list_int)),'subscription_times': ",".join(times_list_str), 'duration_per_slot_hours': 1,})
        elif item_type == Order.TYPE_SLOT_BOOKING:
            booking_date_param = validated_data['date']; slots_list_param_str = validated_data.get('slots', [])
            calculated_backend_amount = facility.price_per_hour * len(slots_list_param_str)
            item_parameters_for_tx.update({'booking_date': booking_date_param.isoformat(), 'slots': slots_list_param_str})
            params_for_conflict_check.update({'date': booking_date_param.isoformat(), 'slots': slots_list_param_str})
            processed_slots = []
            for s_start_str in slots_list_param_str:
                s_start_time_obj = time.fromisoformat(s_start_str)
                s_end_time_obj = (datetime.combine(dt_date.min, s_start_time_obj) + timedelta(hours=1)).time()
                processed_slots.append({'start_time': s_start_str, 'end_time': s_end_time_obj.strftime('%H:%M')})
            order_specific_data.update({'booking_date': booking_date_param, 'slots': processed_slots})
        elif item_type == Order.TYPE_ENTRY_FEE:
            booking_date_param = validated_data['date']
            calculated_backend_amount = facility.price_per_hour
            item_parameters_for_tx.update({'booking_date': booking_date_param.isoformat()})
            params_for_conflict_check.update({'date': booking_date_param.isoformat()})
            order_specific_data.update({'booking_date': booking_date_param})
        item_parameters_for_tx['calculated_amount_decimal_sum'] = str(calculated_backend_amount)

        if item_type != Order.TYPE_ENTRY_FEE:
            conflict_message = check_order_conflicts(facility=facility, order_type=item_type, params_for_check=params_for_conflict_check, exclude_order_id=None, request_time_for_service=timezone.localtime(timezone.now()))
            if conflict_message: return Response({"error": conflict_message, "type": "conflict"}, status=status.HTTP_409_CONFLICT)
        
        try:
            with django_db_transaction.atomic():
                # 1. Создаем PaymentTransaction
                payment_transaction = PaymentTransaction.objects.create(
                    user=user,
                    item_type_at_creation=item_type,
                    item_parameters=item_parameters_for_tx,
                    amount=calculated_backend_amount,
                    status=PaymentTransaction.STATUS_AWAITING_PROVIDER_REDIRECT
                )
                # 2. Создаем Order и связываем с PaymentTransaction
                order_data_for_creation = {
                    'user': user, 'facility': facility, 'order_type': item_type,
                    'status': Order.STATUS_PENDING_PAYMENT,
                    'total_price': calculated_backend_amount,
                    'payment_transaction_link': payment_transaction, # Устанавливаем связь
                    **order_specific_data
                }
                new_order = Order(**order_data_for_creation)
                new_order.full_clean() # Валидация модели
                new_order.save() # order_code генерируется здесь
                
                # После сохранения Order, связь OneToOne (created_order на PaymentTransaction)
                # будет установлена автоматически Django, если payment_transaction_link был присвоен до save().
                # Дополнительно сохранять payment_transaction не нужно, если только мы не меняли другие его поля.

                logger.info(f"User {user.email} prepared Order {new_order.order_code} (ID: {new_order.id}) with PaymentTransaction {payment_transaction.transaction_id} for Paycom.")
                order_identifier_for_payme = getattr(new_order, settings.PAYME_ACCOUNT_FIELD, new_order.id)
                return Response({"order_identifier": order_identifier_for_payme}, status=status.HTTP_201_CREATED)

        except DjangoValidationError as e:
            logger.warning(f"ValidationError in PreparePaycomPaymentView for user {user.email}: {e.message_dict}")
            return Response({"error": e.message_dict}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error in PreparePaycomPaymentView for user {user.email}: {e}", exc_info=True)
            return Response({"error": _("Произошла внутренняя ошибка при подготовке заказа.")}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GetPaycomCheckoutLinkView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, order_identifier, format=None): # order_identifier из URL
        user = request.user
        order_identifier_field_name = settings.PAYME_ACCOUNT_FIELD
        try:
            order = get_object_or_404(Order, **{order_identifier_field_name: order_identifier, 'user': user})
        except Http404:
             return Response({"error": _("Заказ не найден или не принадлежит вам.")}, status=status.HTTP_404_NOT_FOUND)

        if order.status != Order.STATUS_PENDING_PAYMENT:
            return Response({"error": _("Этот заказ не может быть оплачен (статус: {status}).").format(status=order.get_status_display())}, status=status.HTTP_400_BAD_REQUEST)

        university_payme_id = order.facility.university.payme_cash_id
        if not university_payme_id:
            logger.error(f"Payme Cash ID not configured for university {order.facility.university.id} (Order: {order.id})")
            return Response({"error": _("Платежи для этого университета временно не настроены.")}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        our_order_id_for_callback_param = getattr(order, settings.PAYME_ACCOUNT_FIELD) # Это значение пойдет в :account.FIELD
        
        # Получаем текущий язык из запроса, чтобы построить правильный callback URL
        current_language_from_request = translation.get_language()
        if not current_language_from_request: # Фоллбэк, если язык не определен
            current_language_from_request = settings.LANGUAGE_CODE.split('-')[0] 
        else:
            current_language_from_request = current_language_from_request.split('-')[0]

        # URL, куда Payme вернет пользователя. Фронтенд извлечет order_identifier из пути.
        # Плейсхолдеры Payme (:transaction, :account.FIELD) здесь не обязательны, если фронт их не использует.
        callback_url_on_frontend = f"{settings.PAYCOM_CALLBACK_BASE_URL.rstrip('/')}/{current_language_from_request}/payment-status/{our_order_id_for_callback_param}/"
        
        try:
            payme_init = PaymeInitializer(
                payme_id=university_payme_id, 
                is_test_mode=settings.DEBUG 
            )
            identifier_for_paylink = getattr(order, settings.PAYME_ACCOUNT_FIELD)

            payment_link = payme_init.initializer.generate_pay_link(
                id=identifier_for_paylink, # Это значение пойдет в ac.{PAYME_ACCOUNT_FIELD}
                amount=order.total_price,   # Сумма в СУМАХ
                return_url=callback_url_on_frontend
            )
            
            logger.info(f"Generated Paycom link for Order {order.id} (User: {user.email}): {payment_link}")
            return Response({"payme_checkout_url": payment_link}, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Error generating Paycom link for Order {order.id}: {e}", exc_info=True)
            return Response({"error": _("Не удалось сформировать ссылку на оплату. Попробуйте позже.")}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class OrderPaymentStatusView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).select_related(
            'facility', 'facility__university', 'payment_transaction_link'
        )

    def get_object(self):
        order_identifier_from_url = self.kwargs.get('order_identifier')
        identifier_field_name = settings.PAYME_ACCOUNT_FIELD
        
        queryset = self.get_queryset()
        # Используем get_object_or_404 для автоматического 404, если не найдено
        obj = get_object_or_404(queryset, **{identifier_field_name: order_identifier_from_url})
        return obj

# --- END OF FULL CORRECTED backend/bookings/views.py ---