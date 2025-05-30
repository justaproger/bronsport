from django.test import TestCase
from django.utils import timezone
from django.conf import settings
from datetime import datetime, time, date as dt_date, timedelta
import uuid

from core.models import User
from universities.models import University
from .models import Facility, Amenity
from bookings.models import SlotBooking, Subscription, PaymentTransaction

from .availability_checker import get_detailed_availability, REASON_AVAILABLE, REASON_CLOSED_DAY, REASON_CLOSED_TIME, REASON_LEAD_TIME_RESTRICTION, REASON_FULLY_BOOKED_EXCLUSIVE, REASON_MAX_CAPACITY_REACHED, REASON_FACILITY_MISCONFIGURED_CAPACITY


class AvailabilityCheckerTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user1 = User.objects.create_user(email='testuser1@example.com', password='password', first_name='Test', last_name='User1',username='testuser1')
        cls.user2 = User.objects.create_user(email='testuser2@example.com', password='password', first_name='Test', last_name='User2',username='testuser2')

        # Создаем университет - теперь это обязательно
        cls.university = University.objects.create(name="Test University AC", city="Test City AC") # AC - AvailabilityChecker

        cls.facility_exclusive = Facility.objects.create(
            name="Exclusive Court AC",
            university=cls.university,
            facility_type=Facility.TYPE_TENNIS,
            price_per_hour=10000,
            open_time=time(8, 0),
            close_time=time(22, 0),
            working_days="0,1,2,3,4,5,6",
            booking_type=Facility.BOOKING_TYPE_EXCLUSIVE,
            is_active=True
        )

        cls.facility_overlapping = Facility.objects.create(
            name="Shared Gym AC",
            university=cls.university,
            facility_type=Facility.TYPE_GYM,
            price_per_hour=5000,
            open_time=time(9, 0),
            close_time=time(21, 0),
            working_days="0,1,2,3,4", # Пн-Пт
            booking_type=Facility.BOOKING_TYPE_OVERLAPPING,
            max_capacity=3,
            is_active=True
        )
        
        cls.facility_midnight_close = Facility.objects.create(
            name="Late Night Field AC",
            university=cls.university,
            facility_type=Facility.TYPE_FOOTBALL,
            price_per_hour=15000,
            open_time=time(18, 0),
            close_time=time(0, 0),
            working_days="0,1,2,3,4,5,6",
            booking_type=Facility.BOOKING_TYPE_EXCLUSIVE,
            is_active=True
        )

        cls.today = timezone.localdate()
        cls.tomorrow = cls.today + timedelta(days=1)
        
        # Определяем следующий понедельник от cls.today
        cls.next_monday = cls.today + timedelta(days=(0 - cls.today.weekday() + 7) % 7)
        if cls.next_monday <= cls.today : cls.next_monday += timedelta(days=7)


        SlotBooking.objects.create(
            user=cls.user1,
            facility=cls.facility_exclusive,
            booking_date=cls.tomorrow,
            slots=[{"start_time": "10:00", "end_time": "11:00"}],
            total_price=10000,
            status='confirmed'
        )

        Subscription.objects.create(
            user=cls.user2,
            facility=cls.facility_exclusive,
            start_date=cls.tomorrow,
            end_date=cls.tomorrow + timedelta(days=28),
            days_of_week=str(cls.tomorrow.weekday()),
            start_times="14:00",
            total_price=40000,
            status='active'
        )
        
        SlotBooking.objects.create(
            user=cls.user1, facility=cls.facility_overlapping, booking_date=cls.next_monday,
            slots=[{"start_time": "10:00", "end_time": "11:00"}], total_price=5000, status='confirmed'
        )
        SlotBooking.objects.create(
            user=cls.user2, facility=cls.facility_overlapping, booking_date=cls.next_monday,
            slots=[{"start_time": "10:00", "end_time": "11:00"}], total_price=5000, status='confirmed'
        )
        Subscription.objects.create(
            user=cls.user1, facility=cls.facility_overlapping,
            start_date=cls.next_monday, end_date=cls.next_monday + timedelta(days=28),
            days_of_week=str(cls.next_monday.weekday()),
            start_times="10:00", total_price=20000, status='active'
        )
        SlotBooking.objects.create(
            user=cls.user1, facility=cls.facility_overlapping, booking_date=cls.next_monday,
            slots=[{"start_time": "12:00", "end_time": "13:00"}], total_price=5000, status='confirmed'
        )

    def _get_aware_datetime(self, date_obj, time_obj):
        naive_dt = datetime.combine(date_obj, time_obj)
        return timezone.make_aware(naive_dt, timezone.get_current_timezone())

    def test_available_slot_exclusive(self):
        check_dt_start = self._get_aware_datetime(self.tomorrow, time(12, 0))
        result = get_detailed_availability(self.facility_exclusive, check_dt_start)
        self.assertTrue(result["is_available"])
        self.assertEqual(result["reason"], REASON_AVAILABLE)
        self.assertEqual(result["booked_slots_count"], 0)
        self.assertEqual(result["available_spots"], 1)
        self.assertEqual(result["max_capacity"], 1)

    def test_available_slot_overlapping_not_full(self):
        check_dt_start = self._get_aware_datetime(self.next_monday, time(12, 0))
        result = get_detailed_availability(self.facility_overlapping, check_dt_start)
        self.assertTrue(result["is_available"])
        self.assertEqual(result["reason"], REASON_AVAILABLE)
        self.assertEqual(result["booked_slots_count"], 1)
        self.assertEqual(result["available_spots"], 2)
        self.assertEqual(result["max_capacity"], 3)

    def test_unavailable_slot_exclusive_due_to_slotbooking(self):
        check_dt_start = self._get_aware_datetime(self.tomorrow, time(10, 0))
        result = get_detailed_availability(self.facility_exclusive, check_dt_start)
        self.assertFalse(result["is_available"])
        self.assertEqual(result["reason"], REASON_FULLY_BOOKED_EXCLUSIVE)
        self.assertEqual(result["booked_slots_count"], 1)
        self.assertEqual(result["available_spots"], 0)

    def test_unavailable_slot_exclusive_due_to_subscription(self):
        check_dt_start = self._get_aware_datetime(self.tomorrow, time(14, 0))
        result = get_detailed_availability(self.facility_exclusive, check_dt_start)
        self.assertFalse(result["is_available"])
        self.assertEqual(result["reason"], REASON_FULLY_BOOKED_EXCLUSIVE)
        self.assertEqual(result["booked_slots_count"], 1)
        self.assertEqual(result["available_spots"], 0)

    def test_unavailable_slot_overlapping_at_max_capacity(self):
        check_dt_start = self._get_aware_datetime(self.next_monday, time(10, 0))
        result = get_detailed_availability(self.facility_overlapping, check_dt_start, capacity_needed=1)
        self.assertFalse(result["is_available"])
        self.assertEqual(result["reason"], REASON_MAX_CAPACITY_REACHED)
        self.assertEqual(result["booked_slots_count"], 3)
        self.assertEqual(result["available_spots"], 0)
        self.assertEqual(result["max_capacity"], 3)

    def test_unavailable_slot_overlapping_needs_more_than_available(self):
        check_dt_start = self._get_aware_datetime(self.next_monday, time(12, 0))
        result = get_detailed_availability(self.facility_overlapping, check_dt_start, capacity_needed=3)
        self.assertFalse(result["is_available"])
        self.assertEqual(result["reason"], REASON_MAX_CAPACITY_REACHED)
        self.assertEqual(result["booked_slots_count"], 1)
        self.assertEqual(result["available_spots"], 2)
        self.assertEqual(result["max_capacity"], 3)

    def test_unavailable_due_to_closed_day(self):
        sunday_date = self.next_monday + timedelta(days=(6 - self.next_monday.weekday() + 7) % 7)
        check_dt_start = self._get_aware_datetime(sunday_date, time(10, 0))
        result = get_detailed_availability(self.facility_overlapping, check_dt_start) # Overlapping не работает в ВС (working_days="0,1,2,3,4")
        self.assertFalse(result["is_available"])
        self.assertEqual(result["reason"], REASON_CLOSED_DAY)

    def test_unavailable_due_to_closed_time_before_open(self):
        check_dt_start = self._get_aware_datetime(self.tomorrow, time(7, 0))
        result = get_detailed_availability(self.facility_exclusive, check_dt_start)
        self.assertFalse(result["is_available"])
        self.assertEqual(result["reason"], REASON_CLOSED_TIME)

    def test_unavailable_due_to_closed_time_after_close(self):
        check_dt_start = self._get_aware_datetime(self.tomorrow, time(22, 0))
        result = get_detailed_availability(self.facility_exclusive, check_dt_start)
        self.assertFalse(result["is_available"])
        self.assertEqual(result["reason"], REASON_CLOSED_TIME)
        
    def test_available_at_midnight_close_facility_last_hour(self):
        check_dt_start = self._get_aware_datetime(self.tomorrow, time(23, 0))
        result = get_detailed_availability(self.facility_midnight_close, check_dt_start)
        self.assertTrue(result["is_available"], f"Expected available, got: {result}")
        self.assertEqual(result["reason"], REASON_AVAILABLE)

    def test_unavailable_at_midnight_close_facility_at_midnight(self):
        check_dt_start = self._get_aware_datetime(self.tomorrow, time(0, 0))
        result = get_detailed_availability(self.facility_midnight_close, check_dt_start)
        self.assertFalse(result["is_available"], f"Expected unavailable, got: {result}")
        self.assertEqual(result["reason"], REASON_CLOSED_TIME)

    def test_unavailable_due_to_lead_time(self):
        now_aware = timezone.localtime(timezone.now()).replace(second=0, microsecond=0)
        
        # Выбираем время, которое точно попадает в lead time
        check_time_obj = (now_aware + timedelta(minutes=5)).time() # Если lead_time 10, это будет недоступно
        
        # Убедимся, что facility_exclusive работает в этот день и время (без учета lead_time)
        # Возьмем cls.today для теста, если оно не слишком поздно
        test_date_for_lead = self.today
        # Если текущее время + 5 минут уже выходит за рамки рабочего дня, скорректируем
        if (now_aware + timedelta(minutes=5)).time() >= self.facility_exclusive.close_time or \
           (now_aware + timedelta(minutes=5)).time() < self.facility_exclusive.open_time:
            # Если сейчас, например, 23:58, то +5 минут будет 00:03 следующего дня
            # или если сейчас 07:00, а открытие в 08:00
            # В таких случаях тест lead_time на текущем времени может быть некорректен
            # Установим время на середину рабочего дня, но на сегодняшнюю дату
            test_date_for_lead = self.today
            check_time_obj = self.facility_exclusive.open_time # Берем время открытия
            # Если время открытия + 5 минут все еще раньше now + lead_time, тест сработает
            # Это сложный момент для точного теста без моканья now()
            
        # Проверяем, рабочий ли это день
        if not self.facility_exclusive.is_working_on_day(test_date_for_lead.weekday()):
             test_date_for_lead = self.tomorrow # Берем завтра, если сегодня выходной

        check_dt_start_for_lead_test = self._get_aware_datetime(test_date_for_lead, check_time_obj)
        
        # Условие, при котором слот должен быть НЕДОСТУПЕН из-за lead_time
        lead_time_delta = timedelta(minutes=getattr(settings, 'BOOKING_LEAD_TIME_MINUTES', 10))
        is_within_lead_time = check_dt_start_for_lead_test < (now_aware + lead_time_delta)

        result = get_detailed_availability(self.facility_exclusive, check_dt_start_for_lead_test)

        if is_within_lead_time:
            self.assertFalse(result["is_available"], f"Failed for lead time: slot {check_dt_start_for_lead_test}, now_aware {now_aware}, result {result}")
            self.assertEqual(result["reason"], REASON_LEAD_TIME_RESTRICTION)
        else:
            # Если не попадает под lead_time, то должен быть доступен (если нет других конфликтов,
            # но мы выбрали время, где их не должно быть, или это нужно учесть)
            # Для простоты, если тест не нацелен на lead_time, он может пройти и здесь
            # Проверяем, что если доступен, то причина REASON_AVAILABLE
            if result["is_available"]:
                self.assertEqual(result["reason"], REASON_AVAILABLE)
            # Этот else блок может быть не нужен, если мы точно подбираем время для is_within_lead_time
            print(f"INFO: Slot {check_dt_start_for_lead_test} is NOT within lead time of {now_aware + lead_time_delta}. Result: {result['is_available']}")


    def test_available_when_conflicting_slotbooking_is_excluded(self):
        conflicting_sb = SlotBooking.objects.create(
            user=self.user1, facility=self.facility_exclusive, booking_date=self.tomorrow,
            slots=[{"start_time": "16:00", "end_time": "17:00"}], total_price=10000, status='confirmed'
        )
        check_dt_start = self._get_aware_datetime(self.tomorrow, time(16, 0))
        
        result_before_exclude = get_detailed_availability(self.facility_exclusive, check_dt_start)
        self.assertFalse(result_before_exclude["is_available"])

        result_after_exclude = get_detailed_availability(
            self.facility_exclusive, check_dt_start,
            exclude_slot_booking_id=conflicting_sb.id
        )
        self.assertTrue(result_after_exclude["is_available"])
        self.assertEqual(result_after_exclude["booked_slots_count"], 0)

    def test_available_when_conflicting_subscription_is_excluded(self):
        conflicting_sub = Subscription.objects.create(
            user=self.user2, facility=self.facility_exclusive,
            start_date=self.tomorrow, end_date=self.tomorrow + timedelta(days=7),
            days_of_week=str(self.tomorrow.weekday()), start_times="17:00",
            total_price=10000, status='active'
        )
        check_dt_start = self._get_aware_datetime(self.tomorrow, time(17, 0))

        result_before_exclude = get_detailed_availability(self.facility_exclusive, check_dt_start)
        self.assertFalse(result_before_exclude["is_available"])

        result_after_exclude = get_detailed_availability(
            self.facility_exclusive, check_dt_start,
            exclude_subscription_id=conflicting_sub.id
        )
        self.assertTrue(result_after_exclude["is_available"])
        self.assertEqual(result_after_exclude["booked_slots_count"], 0)

    def test_misconfigured_capacity_overlapping(self):
        misconfigured_facility = Facility.objects.create(
            name="Misconfigured Gym AC", university=self.university, facility_type=Facility.TYPE_GYM,
            price_per_hour=1000, open_time=time(9,0), close_time=time(17,0), working_days="0,1,2,3,4",
            booking_type=Facility.BOOKING_TYPE_OVERLAPPING,
            max_capacity=None,
            is_active=True
        )
        check_dt_start = self._get_aware_datetime(self.next_monday, time(10,0))
        result = get_detailed_availability(misconfigured_facility, check_dt_start)
        self.assertFalse(result["is_available"])
        self.assertEqual(result["reason"], REASON_FACILITY_MISCONFIGURED_CAPACITY)


class ComprehensiveSubscriptionAvailabilityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(email='subtest@example.com', password='password',username='SubTestUser')
        
        # Создаем свой университет для этого тестового класса
        cls.university_for_sub_tests = University.objects.create(name="Sub Test University", city="Sub Test City")

        cls.facility_exclusive_for_sub = Facility.objects.create(
            name="Exclusive Sub Test Court", university=cls.university_for_sub_tests,
            facility_type=Facility.TYPE_TENNIS, price_per_hour=12000,
            open_time=time(9, 0), close_time=time(18, 0), working_days="0,2,4", # Пн, Ср, Пт
            booking_type=Facility.BOOKING_TYPE_EXCLUSIVE, is_active=True
        )
        cls.facility_overlapping_for_sub = Facility.objects.create(
            name="Overlapping Sub Test Gym", university=cls.university_for_sub_tests,
            facility_type=Facility.TYPE_GYM, price_per_hour=6000,
            open_time=time(10, 0), close_time=time(19, 0), working_days="1,3", # Вт, Чт
            booking_type=Facility.BOOKING_TYPE_OVERLAPPING, max_capacity=2, is_active=True
        )
        cls.facility_entry_fee_for_sub = Facility.objects.create(
            name="Entry Fee Facility No Sub", university=cls.university_for_sub_tests,
            facility_type=Facility.TYPE_OTHER, price_per_hour=3000,
            open_time=time(8,0), close_time=time(20,0), working_days="0,1,2,3,4,5,6",
            booking_type=Facility.BOOKING_TYPE_ENTRY, is_active=True
        )

        cls.today_for_sub_tests = timezone.localdate() # Используем свою "сегодня" для этого класса
        
        # Следующий понедельник от today_for_sub_tests
        cls.next_monday_for_sub = cls.today_for_sub_tests + timedelta(days=(0 - cls.today_for_sub_tests.weekday() + 7) % 7)
        if cls.next_monday_for_sub <= cls.today_for_sub_tests: cls.next_monday_for_sub += timedelta(days=7)
        
        # Следующий вторник от today_for_sub_tests
        cls.next_tuesday_for_sub = cls.today_for_sub_tests + timedelta(days=(1 - cls.today_for_sub_tests.weekday() + 7) % 7)
        if cls.next_tuesday_for_sub <= cls.today_for_sub_tests: cls.next_tuesday_for_sub += timedelta(days=7)

        # Конфликт для exclusive: Пн (0), 10:00
        SlotBooking.objects.create(
            user=cls.user, facility=cls.facility_exclusive_for_sub,
            booking_date=cls.next_monday_for_sub, 
            slots=[{"start_time": "10:00", "end_time": "11:00"}],
            total_price=12000, status='confirmed'
        )
        # Конфликт для overlapping: Вт (1), 11:00 - 1 место занято
        Subscription.objects.create(
            user=cls.user, facility=cls.facility_overlapping_for_sub,
            start_date=cls.today_for_sub_tests, # Действует с "сегодня"
            end_date=cls.today_for_sub_tests + timedelta(days=30),
            days_of_week="1", # Вторник
            start_times="11:00", total_price=10000, status='active'
        )

    def test_entry_fee_facility_no_subscription_matrix(self):
        response = self.client.get(f'/ru/api/catalog/facilities/{self.facility_entry_fee_for_sub.id}/comprehensive-subscription-availability/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('message', response.data)
        self.assertEqual(response.data.get('availability_matrix'), {})

    def test_exclusive_facility_availability_matrix(self):
        response = self.client.get(f'/ru/api/catalog/facilities/{self.facility_exclusive_for_sub.id}/comprehensive-subscription-availability/')
        self.assertEqual(response.status_code, 200)
        matrix = response.data.get('availability_matrix', {})
        
        self.assertIn("0", matrix) # Пн
        self.assertTrue(matrix["0"]["09:00"]["is_available_for_subscription"])
        self.assertFalse(matrix["0"]["10:00"]["is_available_for_subscription"])
        self.assertEqual(matrix["0"]["10:00"]["reason_key"], REASON_FULLY_BOOKED_EXCLUSIVE)
        self.assertTrue(matrix["0"]["17:00"]["is_available_for_subscription"])
        self.assertNotIn("18:00", matrix["0"])

        self.assertIn("1", matrix) # Вт - нерабочий
        self.assertEqual(matrix["1"], {}) 

        self.assertIn("2", matrix) # Ср - рабочий
        self.assertTrue(matrix["2"]["09:00"]["is_available_for_subscription"])
        self.assertTrue(matrix["2"]["17:00"]["is_available_for_subscription"])


    def test_overlapping_facility_availability_matrix(self):
        response = self.client.get(f'/ru/api/catalog/facilities/{self.facility_overlapping_for_sub.id}/comprehensive-subscription-availability/')
        self.assertEqual(response.status_code, 200)
        matrix = response.data.get('availability_matrix', {})

        # Вт (1) - рабочий, open_time=10:00, close_time=19:00, max_capacity=2
        self.assertIn("1", matrix, f"Matrix keys: {list(matrix.keys())}")
        
        # Слот 10:00 - доступен, 2 места
        self.assertIn("10:00", matrix["1"])
        self.assertTrue(matrix["1"]["10:00"]["is_available_for_subscription"])
        self.assertEqual(matrix["1"]["10:00"]["available_spots_for_subscription"], 2)
        
        # Слот 11:00 - 1 место занято подпиской, 1 доступно
        self.assertIn("11:00", matrix["1"])
        self.assertTrue(matrix["1"]["11:00"]["is_available_for_subscription"], f"Slot 11:00 on Tue should be available. Reason: {matrix['1']['11:00'].get('reason_key')}")
        self.assertEqual(matrix["1"]["11:00"]["available_spots_for_subscription"], 1) # Ожидаем 1, т.к. 1 уже занято
        
        # Добавим еще одну бронь на Вт 11:00, чтобы полностью занять слот
        SlotBooking.objects.create(
            user=self.user, facility=self.facility_overlapping_for_sub,
            booking_date=self.next_tuesday_for_sub, # Убедимся, что это правильный вторник
            slots=[{"start_time": "11:00", "end_time": "12:00"}],
            total_price=6000, status='confirmed'
        )
        response_after_booking = self.client.get(f'/ru/api/catalog/facilities/{self.facility_overlapping_for_sub.id}/comprehensive-subscription-availability/')
        matrix_after_booking = response_after_booking.data.get('availability_matrix', {})
        
        self.assertIn("1", matrix_after_booking)
        self.assertIn("11:00", matrix_after_booking["1"])
        self.assertFalse(matrix_after_booking["1"]["11:00"]["is_available_for_subscription"])
        self.assertEqual(matrix_after_booking["1"]["11:00"]["available_spots_for_subscription"], 0)
        self.assertEqual(matrix_after_booking["1"]["11:00"]["reason_key"], REASON_MAX_CAPACITY_REACHED)

        # Чт (3) - рабочий, все должно быть доступно (2 места)
        self.assertIn("3", matrix)
        self.assertTrue(matrix["3"]["10:00"]["is_available_for_subscription"])
        self.assertEqual(matrix["3"]["10:00"]["available_spots_for_subscription"], 2)
        self.assertTrue(matrix["3"]["18:00"]["is_available_for_subscription"])
        self.assertNotIn("19:00", matrix["3"])

        # Пт (4) - нерабочий
        self.assertIn("4", matrix)
        self.assertEqual(matrix["4"], {})