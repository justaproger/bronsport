# --- START OF FULL FILE backend/core/models.py ---
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
import uuid # Для генерации username, если потребуется

# Импортируем University только для type hinting в поле administered_university
# Это не создает циклического импорта на уровне выполнения
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from universities.models import University # type: ignore

class User(AbstractUser):
    """
    Кастомная модель пользователя. Расширяет AbstractUser.
    Использует email для входа, добавляет номер телефона.
    Поле 'administered_university' ЗДЕСЬ ОТСУТСТВУЕТ.
    Связь определяется в models.University.
    """
    # Username делаем не уникальным и не обязательным при создании через API,
    # но оставляем его для совместимости с Django и createsuperuser.
    username = models.CharField(
        _('username'),
        max_length=150,
        unique=False, # НЕ УНИКАЛЬНЫЙ
        help_text=_('Not used for login. Required by Django for admin/superuser compatibility.'),
        blank=True # Разрешаем быть пустым
    )
    email = models.EmailField(
        _('email address'),
        unique=True, # Email - уникальный идентификатор и логин
        help_text=_('Required. Used for login.')
    )
    phone_number = models.CharField(
        _('phone number'),
        max_length=20,
        blank=True, null=True # Телефон не обязателен
    )
    first_name = models.CharField(
        _('first name'),
        max_length=150,
        blank=False # Имя обязательно
    )
    last_name = models.CharField(
        _('last name'),
        max_length=150,
        blank=False # Фамилия обязательна
    )

    # Указываем, что поле email используется для аутентификации
    USERNAME_FIELD = 'email'
    # Обязательные поля при создании через createsuperuser (Django требует username)
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def __str__(self):
        # Возвращаем email как основное представление пользователя
        return self.email

    class Meta:
        verbose_name = _('Пользователь')
        verbose_name_plural = _('Пользователи')
        ordering = ['email'] # Сортировка по умолчанию

    def save(self, *args, **kwargs):
        """ Переопределение save для возможной генерации username, если он пуст. """
        if not self.username:
            # Простая генерация username на основе email, если он не задан
            # ВАЖНО: В реальном проекте нужна более надежная генерация уникального username
            base_username = self.email.split('@')[0].replace('.', '_').replace('-', '_')[:140] # Ограничение длины
            username_candidate = base_username
            counter = 1
            while User.objects.filter(username=username_candidate).exclude(pk=self.pk).exists():
                username_candidate = f"{base_username}_{counter}"
                counter += 1
                if counter > 1000: # Предотвращение бесконечного цикла
                    username_candidate = f"{base_username}_{uuid.uuid4().hex[:8]}"
                    break
            self.username = username_candidate
            print(f"Generated username for {self.email}: {self.username}")

        super().save(*args, **kwargs) # Вызываем стандартный метод сохранения

    # Свойство для доступа к администрируемому университету через обратную связь
    # Это свойство будет доступно только если в models.University
    # поле administrator определено с related_name='administered_university'
    # и является OneToOneField.
    # Мы НЕ определяем его здесь как поле модели.
    # Django создает его автоматически.

# --- END OF FULL FILE ---