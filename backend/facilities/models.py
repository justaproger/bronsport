from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from datetime import time

# Импортируем модели из других приложений правильно
try:
    from universities.models import University
    UNIVERSITY_IMPORTED = True
except ImportError:
    University = None
    UNIVERSITY_IMPORTED = False
    print("Warning [facilities.models]: Could not import University model.")

try:
    # Используем settings.AUTH_USER_MODEL для большей гибкости
    from django.conf import settings
    User = settings.AUTH_USER_MODEL
    USER_IMPORTED = True
except ImportError:
    User = None # Fallback, если settings не настроен (маловероятно в Django проекте)
    USER_IMPORTED = False
    print("Warning [facilities.models]: Could not import User model via settings.AUTH_USER_MODEL.")


# CHOICES для дней недели (число -> отображаемое имя)
# Используется для удобства в коде и для генерации виджета в админке
DAYS_OF_WEEK_NUMERIC = [
    (0, _('Понедельник')), (1, _('Вторник')), (2, _('Среда')),
    (3, _('Четверг')), (4, _('Пятница')), (5, _('Суббота')),
    (6, _('Воскресенье')),
]


class Amenity(models.Model):
    """ Модель удобств (душ, раздевалка и т.д.) """
    name = models.CharField(_("Название удобства"), max_length=100, unique=True)
    icon_class = models.CharField(
        _("Класс иконки FontAwesome"),
        max_length=50,
        blank=True,
        help_text="Например, 'fas fa-shower' или 'fa-solid fa-wifi'"
    )

    class Meta:
        verbose_name = _("Удобство")
        verbose_name_plural = _("Удобства")
        ordering = ['name']

    def __str__(self):
        return self.name

class Facility(models.Model):
    """ Модель спортивного объекта """
    TYPE_FOOTBALL = 'football'
    TYPE_BASKETBALL = 'basketball'
    TYPE_TENNIS = 'tennis'
    TYPE_VOLLEYBALL = 'volleyball'
    TYPE_SWIMMING = 'swimming'
    TYPE_GYM = 'gym'
    TYPE_OTHER = 'other'

    FACILITY_TYPES = [
        (TYPE_FOOTBALL, _('Футбольное поле')),
        (TYPE_BASKETBALL, _('Баскетбольная площадка')),
        (TYPE_TENNIS, _('Теннисный корт')),
        (TYPE_VOLLEYBALL, _('Волейбольная площадка')),
        (TYPE_SWIMMING, _('Бассейн')),
        (TYPE_GYM, _('Тренажерный зал')),
        (TYPE_OTHER, _('Другое')),
    ]

    BOOKING_TYPE_EXCLUSIVE = 'exclusive_slot'
    BOOKING_TYPE_OVERLAPPING = 'overlapping_slot'
    BOOKING_TYPE_ENTRY = 'entry_fee'

    BOOKING_TYPES = [
        (BOOKING_TYPE_EXCLUSIVE, _('Эксклюзивный слот (1 бронь на время)')),
        (BOOKING_TYPE_OVERLAPPING, _('Пересекающийся слот (несколько броней, нужна вместимость)')),
        (BOOKING_TYPE_ENTRY, _('Оплата за вход (без временных слотов)')),
    ]

    booking_type = models.CharField(
        _("Тип бронирования"),
        max_length=20,
        choices=BOOKING_TYPES,
        default=BOOKING_TYPE_EXCLUSIVE,
        help_text=_("Определяет, как пользователи могут бронировать этот объект.")
    )
    max_capacity = models.PositiveIntegerField(
        _("Макс. вместимость слота"),
        null=True, blank=True,
        validators=[MinValueValidator(1)],
        help_text=_("Укажите максимальное количество одновременных броней для одного временного слота (только для типа 'Пересекающийся слот').")
    )

    name = models.CharField(_("Название объекта"), max_length=200)
    university = models.ForeignKey(
        'universities.University' if not UNIVERSITY_IMPORTED else University,
        on_delete=models.CASCADE,
        related_name='facilities',
        verbose_name=_("Университет")
    )
    facility_type = models.CharField(
        _("Тип объекта"),
        max_length=50,
        choices=FACILITY_TYPES
    )
    description = models.TextField(_("Описание"), blank=True)
    price_per_hour = models.DecimalField(
        _("Цена за час/вход (сум)"),
        max_digits=10,
        decimal_places=0,
        help_text=_("Цена за 1 час для почасового бронирования или цена за вход для типа 'Оплата за вход'.")
    )
    size = models.CharField(_("Размеры/Площадь"), max_length=100, blank=True, null=True)
    location_details = models.CharField(
        _("Детали расположения"),
        max_length=255,
        blank=True,
        help_text="Например, 'Спорткомплекс, Корпус Б, 2 этаж'"
    )
    open_time = models.TimeField(_("Время открытия"))
    close_time = models.TimeField(_("Время закрытия"))

    # --- ИЗМЕНЕНИЕ: Поле working_days ---
    working_days = models.CharField(
        _("Рабочие дни"),
        max_length=20, # "0,1,2,3,4,5,6" (13 символов) + запас
        default="0,1,2,3,4,5", # Пн, Вт, Ср, Чт, Пт, Сб (0-5)
        help_text=_("Числа дней недели через запятую (Пн=0, Вт=1, ..., Вс=6).")
    )
    # -----------------------------------

    contact_phone = models.CharField(_("Контактный телефон объекта"), max_length=50, blank=True)
    responsible_person = models.ForeignKey(
        User, # Используем User из settings.AUTH_USER_MODEL
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'is_staff': True},
        related_name='responsible_facilities',
        verbose_name=_("Ответственное лицо")
    )
    amenities = models.ManyToManyField(
        Amenity,
        blank=True,
        verbose_name=_("Удобства")
    )
    is_active = models.BooleanField(
        _("Доступен для бронирования"),
        default=True,
        help_text="Снимите галочку, чтобы временно скрыть объект из каталога и запретить бронирование."
    )
    created_at = models.DateTimeField(_("Дата создания"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Дата обновления"), auto_now=True)
    main_image = models.ImageField(
        _("Главное изображение"),
        upload_to='facility_images/',
        blank=True,
        null=True
    )

    class Meta:
        verbose_name = _("Спортивный объект")
        verbose_name_plural = _("Спортивные объекты")
        ordering = ['university', 'name']

    def __str__(self):
        uni_name = self.university.short_name or self.university.name if self.university else 'N/A'
        return f"{self.name} ({uni_name})"

    def get_working_days_list(self) -> list[int]:
        """Возвращает отсортированный список целых чисел рабочих дней (0=Пн, ..., 6=Вс)."""
        if not self.working_days:
            return []
        try:
            # Преобразуем в int, фильтруем нечисловые значения, убираем дубликаты и сортируем
            return sorted(list(set(int(d.strip()) for d in self.working_days.split(',') if d.strip().isdigit())))
        except ValueError:
            print(f"Warning: Could not parse working_days for Facility {self.id}: '{self.working_days}'")
            return []

    def is_working_on_day(self, day_index: int) -> bool:
        """
        Проверяет, работает ли объект в указанный день недели.
        day_index: 0 для Понедельника, ..., 6 для Воскресенья (соответствует Python weekday()).
        """
        return day_index in self.get_working_days_list()

    def clean(self):
        super().clean()
        if self.open_time and self.close_time:
             if self.close_time != time(0, 0) and self.close_time <= self.open_time:
                  raise ValidationError(
                      {'close_time': _('Время закрытия должно быть позже времени открытия (переход через полночь пока не поддерживается). Используйте 00:00 для работы до конца дня.')}
                  )
        if self.booking_type == self.BOOKING_TYPE_OVERLAPPING and not self.max_capacity:
            raise ValidationError(
                {'max_capacity': _("Необходимо указать максимальную вместимость для типа бронирования 'Пересекающийся слот'.")}
            )
        if self.booking_type != self.BOOKING_TYPE_OVERLAPPING and self.max_capacity is not None:
             raise ValidationError(
                 {'max_capacity': _("Максимальная вместимость указывается только для типа бронирования 'Пересекающийся слот'.")}
             )
        # Валидация working_days (числа от 0 до 6)
        if self.working_days:
            try:
                days_list = [int(d.strip()) for d in self.working_days.split(',') if d.strip()]
                if not all(0 <= day <= 6 for day in days_list):
                    raise ValueError("Day index out of range")
                # Сохраняем в отсортированном виде без дубликатов для консистентности
                self.working_days = ",".join(map(str, sorted(list(set(days_list)))))
            except ValueError:
                raise ValidationError(
                    {'working_days': _("Неверный формат рабочих дней. Используйте числа от 0 до 6 через запятую (Пн=0, ..., Вс=6).")}
                )

class FacilityImage(models.Model):
    facility = models.ForeignKey(
        Facility,
        on_delete=models.CASCADE,
        related_name='images',
        verbose_name=_("Объект")
    )
    image = models.ImageField(
        _("Изображение"),
        upload_to='facility_images/'
    )
    caption = models.CharField(_("Подпись"), max_length=255, blank=True)
    uploaded_at = models.DateTimeField(_("Дата загрузки"), auto_now_add=True)

    class Meta:
        verbose_name = _("Изображение объекта")
        verbose_name_plural = _("Изображения объектов")
        ordering = ['uploaded_at']

    def __str__(self):
        facility_name = self.facility.name if self.facility else 'N/A'
        return f"Image for {facility_name} ({self.id})"