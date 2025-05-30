# --- START OF FULL FILE backend/universities/admin.py ---
from modeltranslation.admin import TranslationAdmin
from django.contrib import admin, messages
from django.urls import path, reverse # path не используется здесь напрямую, но reverse да
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

from .models import University, Staff, SportClub, UniversityImage
from core.models import User 
from core.utils import get_admin_university_details

try:
    from facilities.models import Facility
    FACILITY_APP_AVAILABLE = True
except ImportError:
    FACILITY_APP_AVAILABLE = False; Facility = None
    # print("Warning: Could not import Facility model for inline display in UniversityAdmin.")

class UniversityImageInline(admin.TabularInline):
    model = UniversityImage; extra = 1; readonly_fields = ('uploaded_at',)
    fields = ('image', 'caption', 'uploaded_at'); classes = ('collapse',)
    verbose_name = _("Изображение галереи"); verbose_name_plural = _("Галерея")

if FACILITY_APP_AVAILABLE:
    class FacilityInline(admin.TabularInline):
        model = Facility # type: ignore
        extra = 0; fields = ('name', 'facility_type', 'price_per_hour', 'is_active')
        readonly_fields = fields; can_delete = False; show_change_link = True
        verbose_name = _("Спортивный объект"); verbose_name_plural = _("Спортивные объекты (просмотр)")
        classes = ('collapse',); ordering = ('name',)
        def has_change_permission(self, request, obj=None): return False
        def has_add_permission(self, request, obj=None): return False
        def get_queryset(self, request):
            qs = super().get_queryset(request)
            parent_obj_id = None
            # Получение parent_obj_id из URL для инлайнов (стандартная практика)
            if hasattr(request, 'resolver_match') and request.resolver_match and 'object_id' in request.resolver_match.kwargs:
                 try: parent_obj_id = int(request.resolver_match.kwargs['object_id'])
                 except (ValueError, TypeError): pass
            
            if parent_obj_id: return qs.filter(university_id=parent_obj_id)
            
            # Если это не инлайн или object_id не найден, применяем стандартную фильтрацию
            admin_university_obj = get_admin_university_details(request.user)
            if admin_university_obj is None: return qs
            elif admin_university_obj != -1: return qs.filter(university=admin_university_obj) # Для админа ВУЗа
            
            return qs.none() # Для других staff без назначенного ВУЗа
else: FacilityInline = None


@admin.register(University)
class UniversityAdmin(TranslationAdmin): # Наследуемся от TranslationAdmin
    list_display = (
        'name', 'city', 'administrator_link', 'is_active', 
        'payme_cash_id', # Новое поле
        'webhook_slug',  # Новое поле
        'facilities_count_display', 'staff_count_display', 'clubs_count_display'
    )
    list_filter = ('city', 'is_active')
    search_fields = ('name', 'city', 'short_name', 'administrator__email', 'administrator__username', 'payme_cash_id', 'webhook_slug')
    autocomplete_fields = ('administrator',)
    
    # readonly_fields теперь будет управляться динамически через get_readonly_fields
    # но 'created_at', 'updated_at', 'webhook_slug' всегда readonly
    base_readonly_fields = ('created_at', 'updated_at', 'webhook_slug')

    # Определяем базовые fieldsets, включая новые поля
    # Переводные поля (name_uz, name_ru и т.д.) TranslationAdmin добавит автоматически
    fieldsets = (
        (None, {'fields': ('name', 'short_name', 'logo', 'campus_image')}),
        (_('Основная информация'), {'fields': ('description', 'established_year', 'is_active')}),
        (_('Контакты и Расположение'), {'fields': ('city', 'address', 'phone_number', 'email', 'website', 'working_hours')}),
        # Секция для Payme и администрирования
        (_('Администрирование и Платежи'), {
            'fields': ('administrator', 'payme_cash_id', 'payme_secret_key', 'webhook_slug'),
            'classes': ('collapse',), # Можно сделать сворачиваемой
            'description': _("Поля для интеграции с Payme и назначения администратора ВУЗа.")
        }),
        (_('Даты'), {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
    
    inlines = [inline for inline in [UniversityImageInline, FacilityInline] if inline is not None]
    list_select_related = ('administrator',)

    def get_readonly_fields(self, request, obj=None):
        readonly = list(self.base_readonly_fields)
        if not request.user.is_superuser:
            # Для не-суперюзеров делаем поля Payme и administrator только для чтения
            readonly.extend(['administrator', 'payme_cash_id', 'payme_secret_key'])
        return tuple(set(readonly)) # Используем set для уникальности

    # Метод get_fieldsets из вашего файла был для скрытия/показа поля administrator.
    # Теперь мы управляем видимостью/редактируемостью полей Payme и administrator через get_readonly_fields
    # и тем, что не-суперюзеры не смогут менять чужие университеты.
    # Если нужно полностью скрыть секцию для не-суперюзеров, можно сделать так:
    def get_fieldsets(self, request, obj=None):
        fieldsets_to_return = super().get_fieldsets(request, obj) # Получаем fieldsets, как их сформировал TranslationAdmin
        if not request.user.is_superuser:
            # Убираем секцию "Администрирование и Платежи" для не-суперюзеров
            fieldsets_to_return = [
                fs for fs in fieldsets_to_return 
                if fs[0] != _('Администрирование и Платежи')
            ]
            # Если администратор ВУЗа должен видеть своего administrator и webhook_slug (но не менять)
            # можно добавить их в другую секцию как readonly.
            # Но проще оставить их в общей секции и сделать readonly через get_readonly_fields,
            # а саму секцию не скрывать, если там есть что-то полезное для админа ВУЗа (например, просмотр administrator).
            # Однако, если там только поля, которые он не должен видеть/менять, то скрытие секции - хороший вариант.
            # В текущей конфигурации (administrator, payme_cash_id, payme_secret_key, webhook_slug)
            # админу ВУЗа, возможно, полезно видеть только своего администратора (если это он сам) и слаг.
            # Но так как мы сделали эти поля readonly для него, он не сможет их изменить.
            # Полное скрытие секции для не-суперюзеров:
            # fieldsets_to_return = [fs for fs in self.fieldsets if fs[0] != _('Администрирование и Платежи')]
            # Это более простой вариант, если не-суперюзеру не нужно видеть эти поля вообще.
            # Давайте остановимся на варианте, где секция есть, но поля readonly для не-суперюзера.
            # Это достигается через get_readonly_fields.
            # А если нужно полностью скрыть, то код выше (fieldsets_to_return = [...])
            pass # Оставляем fieldsets как есть, get_readonly_fields сделает свое дело.
            # Если все же нужно скрыть всю секцию для не-суперюзеров:
            if not request.user.is_superuser:
                 current_fieldsets = list(super().get_fieldsets(request, obj))
                 # Ищем секцию по заголовку. Заголовок должен точно совпадать.
                 admin_payment_section_title = _('Администрирование и Платежи')
                 new_fieldsets = []
                 for title, options in current_fieldsets:
                     if title == admin_payment_section_title:
                         # Если это секция администрирования, и пользователь не суперюзер,
                         # мы можем либо полностью ее убрать, либо оставить только разрешенные поля.
                         # В данном случае, так как все поля в ней для суперюзера, просто пропускаем ее.
                         continue
                     new_fieldsets.append((title, options))
                 return tuple(new_fieldsets)

        return fieldsets_to_return


    # Права доступа и queryset остаются как в вашем текущем файле
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        admin_university_obj = get_admin_university_details(request.user)
        if admin_university_obj is None: return qs
        elif admin_university_obj != -1: return qs.filter(pk=admin_university_obj.pk)
        else: return qs.none()

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
         if request.user.is_superuser: return True
         if obj is not None: return get_admin_university_details(request.user) == obj
         # Админ вуза не может зайти на страницу списка и выбрать "изменить" для другого вуза,
         # т.к. get_queryset вернет только его вуз.
         # Эта проверка нужна, если бы он как-то получил доступ к URL изменения чужого вуза.
         return get_admin_university_details(request.user) != -1 

    @admin.display(description=_('Администратор'), ordering='administrator__email')
    def administrator_link(self, obj):
        if obj.administrator:
            try:
                link = reverse("admin:core_user_change", args=[obj.administrator.id])
                return format_html('<a href="{}">{}</a>', link, obj.administrator.email)
            except Exception: return obj.administrator.email
        return '-'

    @admin.display(description=_('Активных Объектов'))
    def facilities_count_display(self, obj):
        if FACILITY_APP_AVAILABLE and hasattr(obj, 'facilities'):
            return obj.facilities.filter(is_active=True).count()
        return 0
    
    @admin.display(description=_('Персонал'))
    def staff_count_display(self, obj):
        if hasattr(obj, 'staff_members'): return obj.staff_members.count()
        return 0

    @admin.display(description=_('Активных Кружков'))
    def clubs_count_display(self, obj):
        if hasattr(obj, 'sport_clubs'): return obj.sport_clubs.filter(is_active=True).count()
        return 0

# StaffAdmin и SportClubAdmin остаются без изменений по сравнению с вашим текущим файлом
# (я добавил только поля modeltranslation в их fieldsets для полноты, как это должно быть с TranslationAdmin)
@admin.register(Staff)
class StaffAdmin(TranslationAdmin):
    list_display = ('full_name', 'university_link', 'position', 'phone', 'email')
    list_filter = ('university__city', 'university', 'position')
    search_fields = ('full_name', 'position', 'university__name', 'email', 'phone')
    list_select_related = ('university',)
    readonly_fields = ('created_at', 'updated_at')
    autocomplete_fields = ('university',)
    fieldsets = (
        (None, {'fields': ('full_name', # Поля modeltranslation будут добавлены автоматически
                           'university', 
                           'position')}),
        (_('Фото и Био'), {'fields': ('photo', 'bio'), 'classes': ('collapse',)}),
        (_('Контакты'), {'fields': ('phone', 'email')}),
        (_('Даты'), {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
    # ... (остальные методы как у вас) ...
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        admin_university_obj = get_admin_university_details(request.user)
        if admin_university_obj is None: return qs
        elif admin_university_obj != -1: return qs.filter(university=admin_university_obj)
        else: return qs.none()

    def save_model(self, request, obj, form, change):
         if not change: 
             admin_university_obj = get_admin_university_details(request.user)
             if admin_university_obj and admin_university_obj != -1: obj.university = admin_university_obj
             elif not request.user.is_superuser and not form.cleaned_data.get('university'):
                 messages.error(request, _("Не суперпользователь должен иметь назначенный университет или выбрать его, если это разрешено."))
                 return 
             elif request.user.is_superuser and not form.cleaned_data.get('university'):
                 messages.error(request, _("Суперпользователь должен выбрать ВУЗ для нового сотрудника."))
                 return
         super().save_model(request, obj, form, change)

    def get_form(self, request, obj=None, **kwargs):
        original_autocomplete_fields = list(self.autocomplete_fields or []) # Преобразуем в список
        form_class = super().get_form(request, obj, **kwargs) # Получаем класс формы
        
        # Создаем копию base_fields, чтобы не изменять класс формы напрямую
        # Это более безопасный подход, чем form.base_fields.copy() внутри __init__ формы
        # Но для ModelAdmin правильнее переопределить виджеты или queryset в самом классе формы,
        # или динамически менять поля в form_class._meta.fields или form_class.base_fields
        # перед созданием экземпляра формы.
        # Однако, Django Admin обычно создает форму один раз.

        # Простой способ для ModelAdmin - модифицировать form_class.base_fields напрямую,
        # т.к. get_form вызывается для каждого запроса на форму.
        
        current_autocomplete_fields = list(original_autocomplete_fields) # Работаем с копией

        if 'university' in form_class.base_fields:
            if not request.user.is_superuser:
                 form_class.base_fields['university'].disabled = True
                 form_class.base_fields['university'].required = False
                 if 'university' in current_autocomplete_fields: current_autocomplete_fields.remove('university')
            else:
                 if 'university' not in current_autocomplete_fields: current_autocomplete_fields.append('university')
                 if University: form_class.base_fields['university'].queryset = University.objects.filter(is_active=True)
        
        self.autocomplete_fields = tuple(current_autocomplete_fields) # Обновляем для текущего запроса
        return form_class # Возвращаем измененный класс формы
    
    def has_add_permission(self, request):
        has_perm = super().has_add_permission(request)
        return has_perm and (request.user.is_superuser or (get_admin_university_details(request.user) != -1))
    def has_change_permission(self, request, obj=None):
        has_perm = super().has_change_permission(request, obj)
        if not has_perm: return False
        if request.user.is_superuser: return True
        if obj is not None: return get_admin_university_details(request.user) == obj.university
        return get_admin_university_details(request.user) != -1 
    def has_delete_permission(self, request, obj=None):
        has_perm = super().has_delete_permission(request, obj)
        if not has_perm: return False
        if request.user.is_superuser: return True
        if obj is not None: return get_admin_university_details(request.user) == obj.university
        return False

    @admin.display(description=_('Университет'), ordering='university__name')
    def university_link(self, obj):
        if obj.university:
            try:
                link = reverse("admin:universities_university_change", args=[obj.university.id])
                return format_html('<a href="{}">{}</a>', link, obj.university.short_name or obj.university.name)
            except Exception: return obj.university.short_name or obj.university.name
        return "-"


@admin.register(SportClub)
class SportClubAdmin(TranslationAdmin):
    list_display = ('name', 'university_link', 'sport_type', 'get_coach_display', 'is_active')
    list_filter = ('university__city', 'university', 'sport_type', 'is_active')
    search_fields = ('name', 'sport_type', 'university__name', 'coach__full_name', 'coach_name_manual', 'contact_info')
    list_select_related = ('university', 'coach')
    autocomplete_fields = ('university', 'coach',)
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
         (None, {'fields': ('name', # Поля modeltranslation будут добавлены автоматически
                            'university', 
                            'sport_type', 
                            'is_active')}),
         (_('Детали'), {'fields': ('description', 
                                  'schedule_info', 
                                  'image', 'icon_class'), 'classes': ('collapse',)}),
         (_('Тренер и Контакты'), {'fields': ('coach', 
                                           'coach_name_manual',
                                           'contact_info')}),
         (_('Даты'), {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
    # ... (остальные методы как у вас) ...
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        admin_university_obj = get_admin_university_details(request.user)
        if admin_university_obj is None: return qs
        elif admin_university_obj != -1: return qs.filter(university=admin_university_obj)
        else: return qs.none()

    def save_model(self, request, obj, form, change):
         if not change:
             admin_university_obj = get_admin_university_details(request.user)
             if admin_university_obj and admin_university_obj != -1: obj.university = admin_university_obj
             elif not request.user.is_superuser and not form.cleaned_data.get('university'):
                 messages.error(request, _("Не суперпользователь должен иметь назначенный университет или выбрать его, если это разрешено."))
                 return
             elif request.user.is_superuser and not form.cleaned_data.get('university'):
                 messages.error(request, _("Суперпользователь должен выбрать ВУЗ для нового кружка."))
                 return
         super().save_model(request, obj, form, change)

    def get_form(self, request, obj=None, **kwargs):
        original_autocomplete_fields = list(self.autocomplete_fields or [])
        form_class = super().get_form(request, obj, **kwargs)
        admin_university_obj = get_admin_university_details(request.user)
        
        current_autocomplete_fields = list(original_autocomplete_fields)

        if 'university' in form_class.base_fields:
            if not request.user.is_superuser:
                 form_class.base_fields['university'].disabled = True
                 form_class.base_fields['university'].required = False
                 if 'university' in current_autocomplete_fields: current_autocomplete_fields.remove('university')
            else:
                 if 'university' not in current_autocomplete_fields: current_autocomplete_fields.append('university')
                 if University: form_class.base_fields['university'].queryset = University.objects.filter(is_active=True)

        if 'coach' in form_class.base_fields and Staff is not None:
             target_university_for_coach_filter = None
             if obj and obj.university:
                 target_university_for_coach_filter = obj.university
             elif not request.user.is_superuser and admin_university_obj and admin_university_obj != -1:
                 target_university_for_coach_filter = admin_university_obj
             elif request.user.is_superuser and not obj: # Для нового объекта суперюзером
                 # Если ВУЗ уже выбран в форме (например, при ошибке валидации и перезагрузке формы)
                 form_uni_id = request.POST.get('university') if request.method == 'POST' else request.GET.get('university')
                 if form_uni_id:
                     try: target_university_for_coach_filter = University.objects.get(pk=form_uni_id)
                     except (University.DoesNotExist, ValueError, TypeError): pass
            
             if target_university_for_coach_filter:
                 form_class.base_fields['coach'].queryset = Staff.objects.filter(university=target_university_for_coach_filter).order_by('full_name')
             elif request.user.is_superuser and not target_university_for_coach_filter:
                form_class.base_fields['coach'].queryset = Staff.objects.all().order_by('university__name', 'full_name')
             else:
                form_class.base_fields['coach'].queryset = Staff.objects.none()
        
        self.autocomplete_fields = tuple(current_autocomplete_fields)
        return form_class
        
    def has_add_permission(self, request):
        has_perm = super().has_add_permission(request)
        return has_perm and (request.user.is_superuser or (get_admin_university_details(request.user) != -1))
    def has_change_permission(self, request, obj=None):
        has_perm = super().has_change_permission(request, obj)
        if not has_perm: return False
        if request.user.is_superuser: return True
        if obj is not None: return get_admin_university_details(request.user) == obj.university
        return get_admin_university_details(request.user) != -1
    def has_delete_permission(self, request, obj=None):
        has_perm = super().has_delete_permission(request, obj)
        if not has_perm: return False
        if request.user.is_superuser: return True
        if obj is not None: return get_admin_university_details(request.user) == obj.university
        return False

    @admin.display(description=_('Университет'), ordering='university__name')
    def university_link(self, obj):
         if obj.university:
            try:
                link = reverse("admin:universities_university_change", args=[obj.university.id])
                return format_html('<a href="{}">{}</a>', link, obj.university.short_name or obj.university.name)
            except Exception: return obj.university.short_name or obj.university.name
         return "-"
    @admin.display(description=_('Тренер'), ordering='coach__full_name')
    def get_coach_display(self, obj):
        coach_name = '-'
        if obj.coach:
            coach_name = obj.coach.full_name
            try:
                link = reverse("admin:universities_staff_change", args=[obj.coach.id])
                coach_name = format_html('<a href="{}">{}</a>', link, coach_name)
            except Exception: pass 
        elif obj.coach_name_manual: 
            # Для modeltranslation, нужно будет указать переводимые поля coach_name_manual в fieldsets
            coach_name = obj.coach_name_manual + _(" (вручную)")
        return coach_name
# --- END OF FULL FILE ---