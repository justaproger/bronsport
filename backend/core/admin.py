# --- START OF FULL FILE backend/core/admin.py ---
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from django.utils.html import format_html
from django.urls import reverse
# Виджет AutocompleteSelect может понадобиться для других полей в будущем, оставляем импорт
from django.contrib.admin.widgets import AutocompleteSelect
# Импортируем University ТОЛЬКО для проверки типа и генерации ссылки
try:
    from universities.models import University
    UNIVERSITY_MODEL_IMPORTED = True
except ImportError:
    University = None
    UNIVERSITY_MODEL_IMPORTED = False
    print("Warning [core.admin]: Could not import University model for UserAdmin display link.")


User = get_user_model() # Получаем нашу кастомную модель core.User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Кастомизация отображения User модели в админке."""
    model = User # Указываем модель для корректной работы проверок Django Admin

    # Поля, отображаемые в списке пользователей
    list_display = (
        'email',
        # 'username', # Раскомментируйте, если хотите видеть username в списке
        'first_name',
        'last_name',
        'phone_number',
        'is_staff',
        'is_active',
        'is_superuser',
        'display_groups', # Показываем группы
        'administered_university_link', # Отображение ВУЗа (через обратную связь)
        'date_joined'
    )
    # Фильтры
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'groups')
    # Поля для поиска
    search_fields = ('email', 'username', 'first_name', 'last_name', 'phone_number', 'administered_university__name') # Поиск по ВУЗу (через обратную связь)
    # Сортировка
    ordering = ('-date_joined', 'email',)
    # Поля только для чтения
    readonly_fields = ('last_login', 'date_joined')
    # Виджеты для M2M
    filter_horizontal = ('groups', 'user_permissions')

    # --- Fieldsets: Базовые из UserAdmin + phone_number ---
    # Убираем поле administered_university отсюда
    try:
        # Преобразуем кортежи в списки для модификации
        fieldsets_list = [list(fs) for fs in BaseUserAdmin.fieldsets]

        # Добавляем phone_number в 'Personal info'
        personal_info_index = -1
        for i, fieldset in enumerate(fieldsets_list):
            if str(fieldset[0]) == str(_('Personal info')):
                personal_info_index = i
                break
        if personal_info_index != -1:
            personal_info_dict = fieldsets_list[personal_info_index][1]
            personal_info_fields = list(personal_info_dict.get('fields', []))
            if 'phone_number' not in personal_info_fields:
                try:
                     last_name_idx = personal_info_fields.index('last_name')
                     personal_info_fields.insert(last_name_idx + 1, 'phone_number')
                except ValueError:
                     personal_info_fields.append('phone_number')
                personal_info_dict['fields'] = tuple(personal_info_fields)
        else:
             print("Warning [core.admin]: 'Personal info' fieldset not found. Cannot add phone_number.")

        # Убеждаемся, что 'administered_university' удалено из секции 'Permissions'
        permissions_index = -1
        for i, fieldset in enumerate(fieldsets_list):
            if str(fieldset[0]) == str(_('Permissions')):
                permissions_index = i
                break
        if permissions_index != -1:
            permissions_dict = fieldsets_list[permissions_index][1]
            permissions_fields = list(permissions_dict.get('fields', []))
            # Удаляем поле, если оно там есть
            permissions_fields = [f for f in permissions_fields if f != 'administered_university']
            permissions_dict['fields'] = tuple(permissions_fields)
        # else:
            # Если секции Permissions нет, то и поля там быть не могло

        # Преобразуем обратно в кортеж кортежей
        fieldsets = tuple(tuple(fs) for fs in fieldsets_list)

    except Exception as e:
        print(f"Error customizing UserAdmin fieldsets: {e}. Falling back to default.")
        fieldsets = BaseUserAdmin.fieldsets
    # ---------------------------------------------------------------------------


    # --- Add_fieldsets: Базовые + email, first_name, last_name, phone_number (БЕЗ username и administered_university) ---
    try:
        # Начинаем с кортежа, содержащего стандартные поля для пароля
        add_fieldsets_list = [
            (None, {
                'classes': ('wide',),
                'fields': ('email', 'first_name', 'last_name', 'phone_number', 'password1', 'password2'),
            }),
        ]
        # Добавляем стандартные секции прав из BaseUserAdmin.add_fieldsets, если они есть
        # Это нужно, чтобы при создании суперюзера можно было сразу назначить права
        if len(BaseUserAdmin.add_fieldsets) > 1:
            add_fieldsets_list.extend(list(BaseUserAdmin.add_fieldsets)[1:])

        add_fieldsets = tuple(tuple(fs) for fs in add_fieldsets_list)

    except Exception as e:
         print(f"Error customizing UserAdmin add_fieldsets: {e}. Falling back to default.")
         add_fieldsets = BaseUserAdmin.add_fieldsets
    # -----------------------------------------

    # --- Методы для отображения ссылок и групп ---
    @admin.display(description=_('Группы'))
    def display_groups(self, obj):
        """Отображает группы пользователя через запятую."""
        groups = obj.groups.all()
        return format_html("{}", ", ".join([group.name for group in groups]) if groups else "-")

    @admin.display(description=_('Администрируемый ВУЗ'), ordering='administered_university__name')
    def administered_university_link(self, obj):
        """Отображает ссылку на администрируемый ВУЗ (через обратную связь)."""
        # Проверяем наличие обратной связи (может отсутствовать, если связь не OneToOne)
        # и что модель University импортирована
        if UNIVERSITY_MODEL_IMPORTED and hasattr(obj, 'administered_university'):
            uni = obj.administered_university # Получаем объект University через обратную связь
            if uni: # Проверяем, что университет действительно назначен
                try:
                    link = reverse("admin:universities_university_change", args=[uni.id])
                    return format_html('<a href="{}">{}</a>', link, uni.short_name or uni.name)
                except Exception as e:
                     print(f"Error generating university link for User {obj.id}: {e}")
                     return uni.short_name or uni.name # Fallback
        return "-" # Возвращаем прочерк, если ВУЗ не назначен или модель не импортирована
    # ------------------------------------------------------------

# --- END OF FULL FILE ---