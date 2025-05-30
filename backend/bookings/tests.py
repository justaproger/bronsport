from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from datetime import datetime, time, date as dt_date, timedelta
from decimal import Decimal
import uuid
import json
from unittest import mock # Для моканья Stripe API

from rest_framework import status
from rest_framework.test import APIClient

from core.models import User
from universities.models import University
from facilities.models import Facility
from .models import PaymentTransaction, SlotBooking, Subscription, Booking
# Импортируем константы причин для проверки сообщений об ошибках
from facilities.availability_checker import REASON_MAX_CAPACITY_REACHED, REASON_FULLY_BOOKED_EXCLUSIVE


# Мокаем stripe перед импортом views, если stripe используется на уровне модуля views
# Но лучше мокать его внутри каждого тестового метода или в setUp/tearDown.
# Здесь мы будем мокать конкретные вызовы Stripe внутри тестов.

@override_settings(
    STRIPE_PUBLISHABLE_KEY='pk_test_dummy',
    STRIPE_SECRET_KEY='sk_test_dummy',
    STRIPE_WEBHOOK_SECRET='whsec_dummy',
    FRONTEND_BASE_URL='http://testfrontend.com',
    STRIPE_CHECKOUT_SESSION_TIMEOUT_MINUTES=30
)
class CreateCheckoutSessionViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(email='test@example.com', password='password123', first_name='Test', last_name='User', username='testuser')
        cls.university = University.objects.create(name="Test Uni for Checkout", city="Checkout City")

        cls.facility_exclusive = Facility.objects.create(
            name="Exclusive Checkout Court", university=cls.university, facility_type=Facility.TYPE_TENNIS,
            price_per_hour=100000, open_time=time(8, 0), close_time=time(22, 0),
            working_days="0,1,2,3,4,5,6", booking_type=Facility.BOOKING_TYPE_EXCLUSIVE, is_active=True
        )
        cls.facility_overlapping = Facility.objects.create(
            name="Overlapping Checkout Gym", university=cls.university, facility_type=Facility.TYPE_GYM,
            price_per_hour=50000, open_time=time(10, 0), close_time=time(20, 0),
            working_days="0,1,2,3,4", booking_type=Facility.BOOKING_TYPE_OVERLAPPING, max_capacity=2, is_active=True
        )
        cls.facility_entry = Facility.objects.create(
            name="Entry Fee Checkout Pool", university=cls.university, facility_type=Facility.TYPE_SWIMMING,
            price_per_hour=20000, open_time=time(7,0), close_time=time(21,0),
            working_days="0,1,2,3,4,5,6", booking_type=Facility.BOOKING_TYPE_ENTRY, is_active=True
        )

        cls.tomorrow = timezone.localdate() + timedelta(days=1)
        cls.next_monday = cls.tomorrow + timedelta(days=(0 - cls.tomorrow.weekday() + 7) % 7)
        if cls.next_monday <= cls.tomorrow : cls.next_monday += timedelta(days=7)


        # Создаем конфликт для facility_exclusive на завтра 10:00
        SlotBooking.objects.create(
            user=cls.user, facility=cls.facility_exclusive, booking_date=cls.tomorrow,
            slots=[{"start_time": "10:00", "end_time": "11:00"}], total_price=100000, status='confirmed'
        )

        # Создаем конфликты для facility_overlapping на следующий понедельник 12:00 (2 брони)
        SlotBooking.objects.create(
            user=cls.user, facility=cls.facility_overlapping, booking_date=cls.next_monday,
            slots=[{"start_time": "12:00", "end_time": "13:00"}], total_price=50000, status='confirmed'
        )
        Subscription.objects.create(
            user=cls.user, facility=cls.facility_overlapping,
            start_date=cls.next_monday, end_date=cls.next_monday + timedelta(days=28),
            days_of_week=str(cls.next_monday.weekday()), start_times="12:00",
            total_price=200000, status='active'
        ) # Это заполнит facility_overlapping в Пн 12:00 (2/2)

        cls.client = APIClient()
        cls.create_session_url = reverse('bookings:create-checkout-session') # Используем имя из urls.py приложения

    def setUp(self):
        # Логиним пользователя перед каждым тестом
        self.client.force_authenticate(user=self.user)

    @mock.patch('stripe.checkout.Session.create')
    def test_create_session_slot_booking_exclusive_success(self, mock_stripe_session_create):
        mock_stripe_session_create.return_value = mock.Mock(id='cs_test_123', payment_intent='pi_test_123')
        
        data = {
            "item_type": "booking",
            "facility_id": self.facility_exclusive.id,
            "date": self.tomorrow.isoformat(),
            "slots": ["12:00", "13:00"] # Свободные слоты
        }
        response = self.client.post(self.create_session_url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('sessionId', response.data)
        self.assertEqual(response.data['sessionId'], 'cs_test_123')
        self.assertTrue(PaymentTransaction.objects.exists())
        pt = PaymentTransaction.objects.first()
        self.assertEqual(pt.user, self.user)
        self.assertEqual(pt.item_type, "booking")
        self.assertEqual(pt.amount, Decimal('200000')) # 2 * 100000
        self.assertEqual(pt.status, 'intent_created')
        self.assertEqual(pt.stripe_session_id, 'cs_test_123')
        mock_stripe_session_create.assert_called_once()

    @mock.patch('stripe.checkout.Session.create')
    def test_create_session_slot_booking_exclusive_conflict(self, mock_stripe_session_create):
        data = {
            "item_type": "booking",
            "facility_id": self.facility_exclusive.id,
            "date": self.tomorrow.isoformat(),
            "slots": ["10:00"] # Этот слот занят
        }
        response = self.client.post(self.create_session_url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('error', response.data)
        # Проверяем, что сообщение об ошибке содержит информацию о причине
        self.assertTrue(REASON_FULLY_BOOKED_EXCLUSIVE in response.data['error'].lower() or "занят" in response.data['error'].lower())
        self.assertFalse(PaymentTransaction.objects.exists())
        mock_stripe_session_create.assert_not_called()

    @mock.patch('stripe.checkout.Session.create')
    def test_create_session_slot_booking_overlapping_success(self, mock_stripe_session_create):
        mock_stripe_session_create.return_value = mock.Mock(id='cs_test_overlap_ok', payment_intent='pi_test_overlap_ok')
        # facility_overlapping имеет max_capacity=2. На Пн 12:00 уже 2 занято.
        # Пробуем забронировать на Пн 14:00 (свободно)
        data = {
            "item_type": "booking",
            "facility_id": self.facility_overlapping.id,
            "date": self.next_monday.isoformat(),
            "slots": ["14:00"]
        }
        response = self.client.post(self.create_session_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('sessionId', response.data)
        pt = PaymentTransaction.objects.first()
        self.assertEqual(pt.amount, Decimal('50000'))

    @mock.patch('stripe.checkout.Session.create')
    def test_create_session_slot_booking_overlapping_conflict_max_capacity(self, mock_stripe_session_create):
        # Пытаемся забронировать на Пн 12:00, где уже занято 2/2.
        data = {
            "item_type": "booking",
            "facility_id": self.facility_overlapping.id,
            "date": self.next_monday.isoformat(),
            "slots": ["12:00"]
        }
        response = self.client.post(self.create_session_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('error', response.data)
        self.assertTrue(REASON_MAX_CAPACITY_REACHED in response.data['error'].lower() or "вместимость" in response.data['error'].lower())

    @mock.patch('stripe.checkout.Session.create')
    def test_create_session_subscription_exclusive_success(self, mock_stripe_session_create):
        mock_stripe_session_create.return_value = mock.Mock(id='cs_test_sub_ok', payment_intent='pi_test_sub_ok')
        # Подписка на facility_exclusive, Пн 16:00 (свободно)
        data = {
            "item_type": "subscription",
            "facility_id": self.facility_exclusive.id,
            "start_date": self.next_monday.isoformat(),
            "months": 1,
            "days_of_week": [0], # Понедельник
            "start_times": ["16:00"]
        }
        response = self.client.post(self.create_session_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(PaymentTransaction.objects.exists())
        pt = PaymentTransaction.objects.first()
        # Цена: 4 или 5 понедельников в месяце * 1 слот * 100000
        # Точную сумму здесь сложно предсказать без точного расчета occurrences,
        # но она должна быть положительной и кратной 100000.
        self.assertTrue(pt.amount > 0)
        self.assertEqual(pt.item_parameters['days_of_week'], [0])


    @mock.patch('stripe.checkout.Session.create')
    def test_create_session_subscription_exclusive_conflict(self, mock_stripe_session_create):
        # Подписка на facility_exclusive, Пн 10:00 (занято SlotBooking)
        data = {
            "item_type": "subscription",
            "facility_id": self.facility_exclusive.id,
            "start_date": self.tomorrow.isoformat(), # Завтра (когда есть конфликт)
            "months": 1,
            "days_of_week": [self.tomorrow.weekday()], # День недели "завтра"
            "start_times": ["10:00"] # Конфликтное время
        }
        response = self.client.post(self.create_session_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('error', response.data)
        self.assertTrue(REASON_FULLY_BOOKED_EXCLUSIVE in response.data['error'].lower() or "занят" in response.data['error'].lower())

    @mock.patch('stripe.checkout.Session.create')
    def test_create_session_entry_fee_success(self, mock_stripe_session_create):
        mock_stripe_session_create.return_value = mock.Mock(id='cs_test_entry_ok', payment_intent='pi_test_entry_ok')
        data = {
            "item_type": "booking",
            "facility_id": self.facility_entry.id,
            "date": self.tomorrow.isoformat()
            # "slots" не указываем для entry_fee
        }
        response = self.client.post(self.create_session_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(PaymentTransaction.objects.exists())
        pt = PaymentTransaction.objects.first()
        self.assertEqual(pt.amount, self.facility_entry.price_per_hour) # 20000

    def test_create_session_facility_params_changed_conflict(self):
        # Сохраняем текущую цену
        original_price = self.facility_exclusive.price_per_hour
        
        # Формируем данные для запроса (пользователь видит эту цену)
        data = {
            "item_type": "booking",
            "facility_id": self.facility_exclusive.id,
            "date": self.tomorrow.isoformat(),
            "slots": ["12:00"] # Свободный слот
        }
        
        # Имитируем изменение цены на бэкенде *перед* вызовом _check_conflicts
        # Это сложно сделать точно в unit-тесте без моканья Facility.objects.select_for_update().get()
        # Но мы можем проверить логику сравнения, если она есть в _check_conflicts
        # В текущей реализации _check_conflicts сравнивает параметры facility, переданного в него,
        # с параметрами locked_facility_for_check.
        # Чтобы этот тест сработал, нам нужно, чтобы facility, переданный в _check_conflicts,
        # имел старую цену, а locked_facility_for_check - новую.
        # Это означает, что facility в post методе должен быть получен до select_for_update.

        # В текущей реализации post метода:
        # 1. facility = Facility.objects.get(pk=facility_id)
        # 2. ... расчет item_parameters на основе этого facility ...
        # 3. with transaction.atomic():
        # 4.   locked_facility_for_check = Facility.objects.select_for_update().get(pk=facility.id)
        # 5.   сравнение locked_facility_for_check с facility (из п.1)
        # 6.   _check_conflicts(locked_facility_for_check, ...)

        # Чтобы симулировать изменение, мы можем изменить facility в БД между п.1 и п.4.
        # Но это больше похоже на интеграционный тест.
        # Для unit-теста _check_conflicts, мы бы передавали разные facility и locked_facility.

        # Протестируем текущую логику в post:
        Facility.objects.filter(pk=self.facility_exclusive.id).update(price_per_hour=original_price + Decimal(1000))
        
        response = self.client.post(self.create_session_url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("Данные объекта изменились", response.data['error'])
        
        # Возвращаем цену обратно для других тестов
        Facility.objects.filter(pk=self.facility_exclusive.id).update(price_per_hour=original_price)

    # TODO: Добавить тесты на валидацию InputSerializer (неверные даты, отсутствующие поля и т.д.)
    def test_create_session_invalid_input_data(self):
        # Отсутствует facility_id
        data = {"item_type": "booking", "date": self.tomorrow.isoformat(), "slots": ["12:00"]}
        response = self.client.post(self.create_session_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('facility_id', response.data)

        # Неверный item_type
        data = {"item_type": "invalid_type", "facility_id": self.facility_exclusive.id}
        response = self.client.post(self.create_session_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('item_type', response.data)

        # Для подписки отсутствуют обязательные поля
        data = {"item_type": "subscription", "facility_id": self.facility_exclusive.id, "start_date": self.tomorrow.isoformat()}
        response = self.client.post(self.create_session_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('months', response.data) # Пример
        self.assertIn('days_of_week', response.data)
        self.assertIn('start_times', response.data)


# Тесты для StripeWebhookView будут сложнее из-за необходимости мокать Stripe Webhook event
# и проверять создание заказов / инициацию возвратов.
# @override_settings(...) # Аналогично для StripeWebhookViewTests
class StripeWebhookViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(email='webhookuser@example.com', password='password123', username='webhookuser')
        cls.university = University.objects.create(name="Webhook Uni", city="Webhook City")
        cls.facility = Facility.objects.create(
            name="Webhook Facility", university=cls.university, facility_type=Facility.TYPE_GYM,
            price_per_hour=50000, open_time=time(10,0), close_time=time(20,0),
            working_days="0,1,2,3,4", booking_type=Facility.BOOKING_TYPE_OVERLAPPING, max_capacity=3, is_active=True
        )
        cls.webhook_url = reverse('stripe-webhook') # Имя из корневого urls.py
        cls.tomorrow = timezone.localdate() + timedelta(days=1)

    def setUp(self):
        self.client = APIClient() # Не аутентифицируем, т.к. вебхук доступен всем

    def _generate_stripe_event_payload(self, event_type, data_object, stripe_signature="dummy_sig"):
        # Упрощенная генерация payload, в реальности структура сложнее
        payload = {
            "id": f"evt_{uuid.uuid4().hex[:14]}",
            "object": "event",
            "api_version": "2020-08-27", # Пример
            "created": int(timezone.now().timestamp()),
            "data": {
                "object": data_object
            },
            "livemode": False,
            "pending_webhooks": 0,
            "request": {"id": None, "idempotency_key": None},
            "type": event_type
        }
        return json.dumps(payload), {"HTTP_STRIPE_SIGNATURE": stripe_signature}

    @mock.patch('stripe.Webhook.construct_event')
    @mock.patch('bookings.views.CreateCheckoutSessionView._check_conflicts') # Мокаем проверку конфликтов для изоляции
    @mock.patch('bookings.views.StripeWebhookView._create_refund') # Мокаем создание возврата
    def test_webhook_checkout_session_completed_slot_booking_success(
        self, mock_create_refund, mock_check_conflicts, mock_construct_event):
        
        # 1. Создаем PaymentTransaction, как будто CreateCheckoutSessionView его создал
        item_params_for_booking = {
            'facility_id': self.facility.id, 'facility_name': self.facility.name,
            'university_id': self.facility.university.id, 'university_name': self.facility.university.name,
            'price_per_hour_at_creation': str(self.facility.price_per_hour),
            'booking_type_at_creation': self.facility.booking_type,
            'max_capacity_at_creation': self.facility.max_capacity,
            'date': self.tomorrow.isoformat(),
            'slots': ["14:00", "15:00"],
            'calculated_amount_decimal': str(self.facility.price_per_hour * 2)
        }
        payment_transaction = PaymentTransaction.objects.create(
            user=self.user, item_type='booking', item_parameters=item_params_for_booking,
            amount=self.facility.price_per_hour * 2, status='intent_created', # Или 'succeeded' если Stripe уже подтвердил
            stripe_session_id='cs_test_webhook_success', # Важно для поиска
            stripe_payment_intent_id='pi_test_webhook_success'
        )

        # 2. Мокаем stripe.Webhook.construct_event
        #    Он должен вернуть объект, имитирующий событие Stripe
        mock_event_data_object = {
            "id": payment_transaction.stripe_session_id, # ID сессии Stripe
            "object": "checkout.session",
            "client_reference_id": str(payment_transaction.transaction_id), # Наш ID транзакции
            "payment_intent": payment_transaction.stripe_payment_intent_id,
            "payment_status": "paid",
            "status": "complete",
            # ... другие поля сессии Stripe, если они используются ...
        }
        mock_event = {"type": "checkout.session.completed", "data": {"object": mock_event_data_object}}
        mock_construct_event.return_value = mock_event

        # 3. Мокаем _check_conflicts, чтобы он вернул None (нет конфликтов)
        mock_check_conflicts.return_value = None

        # 4. Отправляем POST запрос на вебхук
        payload_str, headers = self._generate_stripe_event_payload("checkout.session.completed", mock_event_data_object)
        response = self.client.post(self.webhook_url, data=payload_str, content_type='application/json', **headers)
        
        # 5. Проверяем результат
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        payment_transaction.refresh_from_db()
        self.assertEqual(payment_transaction.status, 'order_created')
        
        self.assertTrue(SlotBooking.objects.filter(payment_transaction_link=payment_transaction).exists())
        slot_booking = SlotBooking.objects.get(payment_transaction_link=payment_transaction)
        self.assertEqual(slot_booking.user, self.user)
        self.assertEqual(slot_booking.facility, self.facility)
        self.assertEqual(slot_booking.booking_date, self.tomorrow)
        self.assertEqual(len(slot_booking.slots), 2)
        self.assertEqual(slot_booking.slots[0]['start_time'], "14:00")
        self.assertEqual(slot_booking.status, 'confirmed')
        
        mock_check_conflicts.assert_called_once()
        mock_create_refund.assert_not_called()


    @mock.patch('stripe.Webhook.construct_event')
    @mock.patch('bookings.views.CreateCheckoutSessionView._check_conflicts')
    @mock.patch('bookings.views.StripeWebhookView._create_refund')
    def test_webhook_checkout_session_completed_conflict_detected(
        self, mock_create_refund, mock_check_conflicts, mock_construct_event):
        
        item_params_for_conflict = {
            'facility_id': self.facility.id, # ... (аналогично предыдущему тесту)
            'price_per_hour_at_creation': str(self.facility.price_per_hour),
            'booking_type_at_creation': self.facility.booking_type,
            'max_capacity_at_creation': self.facility.max_capacity,
            'date': self.tomorrow.isoformat(), 'slots': ["10:00"], # Время, которое станет конфликтным
            'calculated_amount_decimal': str(self.facility.price_per_hour)
        }
        payment_transaction = PaymentTransaction.objects.create(
            user=self.user, item_type='booking', item_parameters=item_params_for_conflict,
            amount=self.facility.price_per_hour, status='intent_created',
            stripe_session_id='cs_test_webhook_conflict',
            stripe_payment_intent_id='pi_test_webhook_conflict'
        )

        mock_event_data_object = { "id": payment_transaction.stripe_session_id, "client_reference_id": str(payment_transaction.transaction_id), "payment_intent": payment_transaction.stripe_payment_intent_id, "payment_status": "paid", "status": "complete" }
        mock_event = {"type": "checkout.session.completed", "data": {"object": mock_event_data_object}}
        mock_construct_event.return_value = mock_event

        # Мокаем _check_conflicts, чтобы он ВЕРНУЛ сообщение о конфликте
        mock_check_conflicts.return_value = "Слот уже занят (симуляция конфликта в вебхуке)"
        
        # Мокаем _create_refund, чтобы он вернул "успешный" ID возврата и статус
        mock_create_refund.return_value = ('re_test_dummy_refund_id', 'refund_initiated')

        payload_str, headers = self._generate_stripe_event_payload("checkout.session.completed", mock_event_data_object)
        response = self.client.post(self.webhook_url, data=payload_str, content_type='application/json', **headers)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        payment_transaction.refresh_from_db()
        self.assertEqual(payment_transaction.status, 'refund_initiated') # Ожидаем, что статус изменился на "возврат инициирован"
        self.assertEqual(payment_transaction.stripe_refund_id, 're_test_dummy_refund_id')
        
        self.assertFalse(SlotBooking.objects.filter(payment_transaction_link=payment_transaction).exists()) # Заказ не должен быть создан
        
        mock_check_conflicts.assert_called_once()
        mock_create_refund.assert_called_once_with(payment_transaction.stripe_payment_intent_id, reason_code=mock.ANY) # Проверяем, что возврат был вызван

    @mock.patch('stripe.Webhook.construct_event')
    @mock.patch('bookings.views.StripeWebhookView._create_refund')
    def test_webhook_facility_params_changed_initiates_refund(
        self, mock_create_refund, mock_construct_event):
        
        # Параметры, с которыми пользователь "создавал" сессию
        item_params_original = {
            'facility_id': self.facility.id,
            'price_per_hour_at_creation': str(self.facility.price_per_hour), # 50000
            'booking_type_at_creation': self.facility.booking_type,         # overlapping
            'max_capacity_at_creation': self.facility.max_capacity,         # 2
            'date': self.tomorrow.isoformat(), 'slots': ["15:00"], # Свободный слот
            'calculated_amount_decimal': str(self.facility.price_per_hour)
        }
        payment_transaction = PaymentTransaction.objects.create(
            user=self.user, item_type='booking', item_parameters=item_params_original,
            amount=self.facility.price_per_hour, status='intent_created',
            stripe_session_id='cs_test_params_changed', stripe_payment_intent_id='pi_test_params_changed'
        )

        # Имитируем изменение цены объекта в БД ПОСЛЕ создания сессии, но ДО вебхука
        facility_db = Facility.objects.get(pk=self.facility.id)
        facility_db.price_per_hour = Decimal('60000') # Цена изменилась
        facility_db.save()

        mock_event_data_object = { "id": payment_transaction.stripe_session_id, "client_reference_id": str(payment_transaction.transaction_id), "payment_intent": payment_transaction.stripe_payment_intent_id, "payment_status": "paid", "status": "complete" }
        mock_event = {"type": "checkout.session.completed", "data": {"object": mock_event_data_object}}
        mock_construct_event.return_value = mock_event
        mock_create_refund.return_value = ('re_test_refund_params_changed', 'refund_initiated')

        payload_str, headers = self._generate_stripe_event_payload("checkout.session.completed", mock_event_data_object)
        response = self.client.post(self.webhook_url, data=payload_str, content_type='application/json', **headers)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment_transaction.refresh_from_db()
        self.assertEqual(payment_transaction.status, 'refund_initiated')
        self.assertFalse(SlotBooking.objects.filter(payment_transaction_link=payment_transaction).exists())
        mock_create_refund.assert_called_once()

        # Возвращаем цену для других тестов
        facility_db.price_per_hour = Decimal('50000')
        facility_db.save()

    @mock.patch('stripe.Webhook.construct_event')
    def test_webhook_charge_refunded_event(self, mock_construct_event):
        payment_transaction = PaymentTransaction.objects.create(
            user=self.user, item_type='booking', 
            item_parameters={'facility_id': self.facility.id, 'date': self.tomorrow.isoformat(), 'slots': ["17:00"]},
            amount=Decimal('50000'), status='refund_initiated', # Статус уже "возврат инициирован"
            stripe_payment_intent_id='pi_test_charge_refunded',
            stripe_refund_id='re_temp_id_before_webhook' # Может быть временный ID или None
        )

        mock_refund_data_object = {
            "id": "re_actual_stripe_refund_id", # ID самого объекта Refund
            "object": "refund",
            "payment_intent": payment_transaction.stripe_payment_intent_id,
            "status": "succeeded", # или "pending", "failed"
            # ... другие поля refund ...
        }
        mock_event = {"type": "charge.refunded", "data": {"object": mock_refund_data_object}} # Используем charge.refunded
        mock_construct_event.return_value = mock_event
        
        payload_str, headers = self._generate_stripe_event_payload("charge.refunded", mock_refund_data_object)
        response = self.client.post(self.webhook_url, data=payload_str, content_type='application/json', **headers)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment_transaction.refresh_from_db()
        self.assertEqual(payment_transaction.status, 'refunded')
        self.assertEqual(payment_transaction.stripe_refund_id, 're_actual_stripe_refund_id')

    # TODO: Тесты для других типов событий (payment_intent.succeeded, payment_intent.payment_failed)
    # TODO: Тесты для идемпотентности (повторная отправка того же вебхука checkout.session.completed)
    # TODO: Тесты для создания Subscription и Booking (entry_fee) через вебхук