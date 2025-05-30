# --- START OF FULL FILE backend/universities/models.py ---
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.text import slugify # Для генерации слага
import uuid # Для уникальности слага

from core.models import User 
# Импортируем University только для type hinting в поле administered_university модели User (если есть такая связь)
# и Facility для обратных связей, если они есть.
# Для прямого использования в полях ForeignKey лучше использовать строки 'app_label.ModelName'
# чтобы избежать циклических импортов при запуске.

class University(models.Model):
    name = models.CharField(
        _("Название университета"),
        max_length=255,
        unique=True
    )
    short_name = models.CharField(
        _("Сокращенное название"),
        max_length=50,
        blank=True, null=True
    )
    city = models.CharField(
        _("Город"),
        max_length=100,
        db_index=True
    )
    address = models.CharField(
        _("Адрес"),
        max_length=255
    )
    description = models.TextField(
        _("Описание"),
        blank=True
    )
    logo = models.ImageField(
        _("Логотип (квадратный)"),
        upload_to='university_logos/',
        blank=True, null=True,
        help_text=_("Рекомендуется квадратное изображение для лучшего отображения.")
    )
    campus_image = models.ImageField(
        _("Фоновое изображение (кампус)"),
        upload_to='university_campus/',
        blank=True, null=True,
        help_text=_("Горизонтальное изображение для карточки и шапки страницы университета.")
    )
    website = models.URLField(
        _("Веб-сайт"),
        blank=True, null=True
    )
    phone_number = models.CharField(
        _("Телефон"),
        max_length=50,
        blank=True, null=True
    )
    email = models.EmailField(
        _("Email"),
        blank=True, null=True
    )
    established_year = models.PositiveSmallIntegerField(
        _("Год основания"),
        blank=True, null=True
    )
    working_hours = models.CharField(
        _("Часы работы (общие)"),
        max_length=100,
        blank=True, null=True,
        default="Пн-Сб: 8:00 - 20:00"
    )
    administrator = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'is_staff': True},
        related_name='administered_university',
        verbose_name=_("Администратор")
    )
    is_active = models.BooleanField(
        _("Активен"),
        default=True,
        db_index=True,
        help_text=_("Отображается ли университет на платформе и доступны ли его объекты.")
    )
    created_at = models.DateTimeField(_("Дата создания"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Дата обновления"), auto_now=True)

    # --- Поля для Payme ---
    payme_cash_id = models.CharField(
        _("ID кассы университета в Payme (Merchant ID)"), 
        max_length=255, 
        blank=True, null=True,
        help_text=_("ID кассы из личного кабинета Payme Business, используется для приема платежей.")
    )
    # TODO: Зашифровать это поле в базе данных (например, с помощью django-cryptography)
    payme_secret_key = models.CharField(
        _("Секретный ключ кассы Payme"),
        max_length=255,
        blank=True, null=True,
        help_text=_("Секретный ключ кассы из личного кабинета Payme Business, используется для авторизации вебхуков.")
    )
    webhook_slug = models.SlugField(
        _("Слаг для URL вебхука Payme"),
        max_length=100,
        unique=True,
        blank=True, null=True, # Сделаем blank=True, null=True, чтобы можно было генерировать при сохранении
        help_text=_("Уникальный идентификатор для URL вебхука, например, 'tashkent-state-university'. Генерируется автоматически, если не указан.")
    )
    # platform_commission_percentage УБРАЛИ, так как комиссия отменена

    class Meta:
        verbose_name = _("Университет")
        verbose_name_plural = _("Университеты")
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.webhook_slug and self.name:
            base_slug = slugify(self.name)
            slug_candidate = base_slug
            counter = 1
            # Обеспечиваем уникальность слага
            while University.objects.filter(webhook_slug=slug_candidate).exclude(pk=self.pk).exists():
                slug_candidate = f"{base_slug}-{counter}"
                counter += 1
                if counter > 10: # Предохранитель от бесконечного цикла
                    slug_candidate = f"{base_slug}-{uuid.uuid4().hex[:6]}"
                    break
            self.webhook_slug = slug_candidate
        super().save(*args, **kwargs)

class UniversityImage(models.Model):
    university = models.ForeignKey(
        University,
        on_delete=models.CASCADE,
        related_name='gallery_images',
        verbose_name=_("Университет")
    )
    image = models.ImageField(_("Изображение"), upload_to='university_gallery/')
    caption = models.CharField(_("Подпись"), max_length=255, blank=True)
    uploaded_at = models.DateTimeField(_("Дата загрузки"), auto_now_add=True)

    class Meta:
         verbose_name = _("Изображение галереи")
         verbose_name_plural = _("Галерея университета")
         ordering = ['-uploaded_at']

    def __str__(self):
        uni_name = self.university.short_name or self.university.name if self.university else 'N/A'
        return f"Image for {uni_name} ({self.id})"

class Staff(models.Model):
    university = models.ForeignKey(
        University,
        on_delete=models.CASCADE,
        related_name='staff_members',
        verbose_name=_("Университет")
    )
    full_name = models.CharField(_("ФИО"), max_length=255)
    position = models.CharField(_("Должность"), max_length=150)
    photo = models.ImageField(_("Фото"), upload_to='staff_photos/', blank=True, null=True)
    bio = models.TextField(_("Краткая биография"), blank=True)
    phone = models.CharField(_("Телефон"), max_length=50, blank=True)
    email = models.EmailField(_("Email"), blank=True)
    created_at = models.DateTimeField(_("Добавлено"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Обновлено"), auto_now=True)

    class Meta:
        verbose_name = _("Сотрудник спорт. отдела")
        verbose_name_plural = _("Сотрудники спорт. отдела")
        ordering = ['university', 'full_name']

    def __str__(self):
        return f"{self.full_name} ({self.position})"

class SportClub(models.Model):
    university = models.ForeignKey(
        University,
        on_delete=models.CASCADE,
        related_name='sport_clubs',
        verbose_name=_("Университет")
    )
    name = models.CharField(_("Название кружка"), max_length=200)
    sport_type = models.CharField(_("Вид спорта"), max_length=100, db_index=True)
    icon_class = models.CharField(
        _("Класс иконки FontAwesome"),
        max_length=50, blank=True,
        help_text=_("Например, 'fas fa-futbol'")
    )
    description = models.TextField(_("Описание"), blank=True)
    schedule_info = models.TextField(
        _("Информация о расписании"), blank=True,
        help_text=_("Пример: Пн, Ср, Пт: 18:00 - 20:00, Спортзал А")
    )
    coach = models.ForeignKey(
        Staff,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name=_("Тренер (из персонала)")
    )
    coach_name_manual = models.CharField(
        _("Тренер (текст)"), max_length=255, blank=True,
        help_text=_("Используйте, если тренера нет в списке персонала")
    )
    contact_info = models.CharField(_("Контактная информация (тел/email)"), max_length=200, blank=True)
    image = models.ImageField(_("Изображение"), upload_to='club_images/', blank=True, null=True)
    is_active = models.BooleanField(_("Активен"), default=True, db_index=True)
    created_at = models.DateTimeField(_("Добавлено"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Обновлено"), auto_now=True)

    class Meta:
        verbose_name = _("Спортивный кружок")
        verbose_name_plural = _("Спортивные кружки")
        ordering = ['university', 'name']

    def __str__(self):
        uni_name = self.university.short_name or self.university.name if self.university else 'N/A'
        return f"{self.name} ({uni_name})"
# --- END OF FULL FILE ---