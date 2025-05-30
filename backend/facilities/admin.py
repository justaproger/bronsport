from modeltranslation.admin import TranslationAdmin
from django import forms
from django.contrib import admin, messages
from django.utils.html import format_html
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from bookings.constants import DAYS_OF_WEEK_NUMERIC 
from .models import Facility, Amenity, FacilityImage

# --- ИЗМЕНЕНИЕ: Импортируем из core.utils ---
from core.utils import get_admin_university_details
# --- КОНЕЦ ИЗМЕНЕНИЯ ---

try:
    # from universities.admin import get_admin_university # Старый импорт не нужен
    from universities.models import Staff, University # Staff нужен для фильтрации responsible_person
    UNIVERSITY_APP_AVAILABLE = True
except ImportError:
    print("Warning: Could not import Staff/University models from universities app in facilities/admin.py.")
    Staff = None # type: ignore
    University = None # type: ignore
    UNIVERSITY_APP_AVAILABLE = False

User = get_user_model()


class FacilityImageInline(admin.TabularInline):
    model = FacilityImage
    extra = 1; readonly_fields = ('uploaded_at',); fields = ('image', 'caption', 'uploaded_at')
    classes = ('collapse',); verbose_name = _("Доп. изображение"); verbose_name_plural = _("Галерея объекта")

class FacilityAdminForm(forms.ModelForm):
    working_days_selection = forms.MultipleChoiceField(
        choices=DAYS_OF_WEEK_NUMERIC, widget=forms.CheckboxSelectMultiple,
        label=_("Рабочие дни (выбор)"), required=False, help_text=_("Выберите рабочие дни недели.")
    )
    class Meta: model = Facility; fields = '__all__'
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk and self.instance.working_days:
            try: self.initial['working_days_selection'] = [str(d) for d in self.instance.get_working_days_list()]
            except ValueError: self.initial['working_days_selection'] = []
        elif not self.instance.pk and self.instance.working_days: # Для нового объекта с default
            try: self.initial['working_days_selection'] = [str(d) for d in self.instance.get_working_days_list()]
            except ValueError: self.initial['working_days_selection'] = []
    def save(self, commit=True):
        selected_days_list = self.cleaned_data.get('working_days_selection', [])
        self.instance.working_days = ",".join(map(str, sorted([int(day) for day in selected_days_list]))) if selected_days_list else ""
        return super().save(commit=commit)

@admin.register(Facility)
class FacilityAdmin(TranslationAdmin):
    form = FacilityAdminForm
    list_display = ('name', 'university_link', 'facility_type', 'booking_type', 'price_per_hour', 'max_capacity', 'is_active', 'responsible_person_link', 'display_working_days_short')
    list_filter = ('is_active', 'facility_type', 'booking_type', 'university__city', 'university', 'amenities') # Добавил city
    search_fields = ('name', 'description', 'university__name', 'university__short_name', 'responsible_person__first_name', 'responsible_person__last_name', 'responsible_person__email')
    readonly_fields = ('created_at', 'updated_at', 'working_days')
    autocomplete_fields = ('university', 'responsible_person',)
    fieldsets = (
        (None, {'fields': ('name', 'university', 'facility_type')}),
        (_('Описание и Изображения'), {'fields': ('description', 'main_image'), 'classes': ('collapse',)}),
        (_('Детали и Доступность'), {'fields': ('price_per_hour', 'booking_type', 'max_capacity', 'size', 'location_details', ('open_time', 'close_time'), 'working_days_selection', 'working_days', 'is_active')}),
        (_('Контакты и Удобства'), {'fields': ('contact_phone', 'responsible_person', 'amenities')}),
        (_('Даты'), {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
    filter_horizontal = ('amenities',)
    inlines = [FacilityImageInline]; list_select_related = ('university', 'responsible_person'); list_per_page = 25

    @admin.display(description=_('Раб. дни (кратко)'))
    def display_working_days_short(self, obj):
        days_list = obj.get_working_days_list()
        if not days_list: return "-"
        day_map_short = dict(DAYS_OF_WEEK_NUMERIC)
        return ", ".join(str(day_map_short.get(day_idx, '?')) for day_idx in days_list)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        admin_university_obj = get_admin_university_details(request.user) # Используем новую функцию
        if admin_university_obj is None: return qs
        elif admin_university_obj != -1: return qs.filter(university=admin_university_obj)
        else: return qs.none()

    def save_model(self, request, obj, form, change):
         if not obj.pk:
             admin_university_obj = get_admin_university_details(request.user) # Используем новую функцию
             if admin_university_obj and admin_university_obj != -1: obj.university = admin_university_obj
             elif not request.user.is_superuser and not form.cleaned_data.get('university'):
                 messages.error(request, _("Суперпользователь должен выбрать университет для нового объекта.")); return 
             elif not request.user.is_superuser and admin_university_obj is None:
                 messages.error(request, _("Невозможно создать объект, т.к. ваш аккаунт не привязан к университету.")); return
         super().save_model(request, obj, form, change)

    def get_form(self, request, obj=None, **kwargs):
        kwargs['form'] = self.form
        form_class = super().get_form(request, obj, **kwargs)
        # Создаем копию base_fields, чтобы не изменять класс формы напрямую
        current_base_fields = {k: v for k, v in form_class.base_fields.items()}
        admin_university_obj = get_admin_university_details(request.user) # Используем новую функцию
        current_autocomplete_fields = list(self.autocomplete_fields or [])

        if 'university' in current_base_fields:
            if not request.user.is_superuser:
                 current_base_fields['university'].disabled = True
                 current_base_fields['university'].required = False
                 if 'university' in current_autocomplete_fields: current_autocomplete_fields.remove('university')
            else:
                 if 'university' not in current_autocomplete_fields: current_autocomplete_fields.append('university')
                 if University and hasattr(current_base_fields['university'], 'queryset'):
                     current_base_fields['university'].queryset = University.objects.filter(is_active=True)

        if 'responsible_person' in current_base_fields and User is not None:
             target_university_for_staff_filter = None
             if obj and obj.university: target_university_for_staff_filter = obj.university
             elif admin_university_obj and admin_university_obj != -1: target_university_for_staff_filter = admin_university_obj
             
             if target_university_for_staff_filter and Staff: # Убедимся, что Staff импортирован
                 # Показываем сотрудников (is_staff Users) этого университета
                 # Это потребует связи User <-> Staff или фильтрации User по staff_profile__university
                 # Пока оставим фильтрацию User.is_staff, если Staff не используется для прямой связи с User
                 # Если есть модель Staff, связанная с User, то лучше фильтровать по ней:
                 # staff_user_ids = Staff.objects.filter(university=target_university_for_staff_filter).values_list('user_account_id', flat=True)
                 # current_base_fields['responsible_person'].queryset = User.objects.filter(pk__in=staff_user_ids, is_staff=True)
                 # Упрощенный вариант: все is_staff, если не админ ВУЗа
                 if not request.user.is_superuser and request.user.is_staff:
                     current_base_fields['responsible_person'].queryset = User.objects.filter(pk=request.user.pk)
                 else: # Суперюзер или если нет Staff
                     current_base_fields['responsible_person'].queryset = User.objects.filter(is_staff=True).order_by('last_name', 'first_name')
             elif request.user.is_superuser and obj is None:
                  current_base_fields['responsible_person'].queryset = User.objects.filter(is_staff=True).order_by('last_name', 'first_name')
             else: 
                  current_base_fields['responsible_person'].queryset = User.objects.none()
        
        admin_site_ref = self.admin_site # Сохраняем ссылку
        class DynamicFacilityForm(form_class):
            def __init__(self, *args, **kwargs_form):
                super().__init__(*args, **kwargs_form)
                self.fields.update(current_base_fields) # Применяем измененные поля
                # Обновляем виджеты для autocomplete
                if hasattr(self._meta, 'model') and self._meta.model:
                    self.Meta.widgets = {
                        f_name: admin.widgets.AutocompleteSelect(self._meta.model._meta.get_field(f_name), admin_site_ref)
                        for f_name in current_autocomplete_fields 
                        if hasattr(self._meta.model._meta.get_field(f_name), 'remote_field')
                    }
        return DynamicFacilityForm

    def has_add_permission(self, request):
        has_perm = request.user.has_perm('facilities.add_facility')
        return has_perm and (request.user.is_superuser or (get_admin_university_details(request.user) != -1))
    def has_change_permission(self, request, obj=None):
        has_perm = request.user.has_perm('facilities.change_facility')
        if not has_perm: return False
        if request.user.is_superuser: return True
        if obj is not None: return get_admin_university_details(request.user) == obj.university
        return get_admin_university_details(request.user) != -1
    def has_delete_permission(self, request, obj=None):
        has_perm = request.user.has_perm('facilities.delete_facility')
        if not has_perm: return False
        if request.user.is_superuser: return True
        if obj is not None: return get_admin_university_details(request.user) == obj.university
        return obj is not None if not request.user.is_superuser else True # Массовое удаление для суперюзера

    @admin.display(description=_('Университет'), ordering='university__name')
    def university_link(self, obj):
        if obj.university:
            try:
                link = reverse("admin:universities_university_change", args=[obj.university.id])
                return format_html('<a href="{}">{}</a>', link, obj.university.short_name or obj.university.name)
            except Exception: return obj.university.short_name or obj.university.name
        return '-'
    @admin.display(description=_('Ответственный'), ordering='responsible_person__last_name')
    def responsible_person_link(self, obj):
        if obj.responsible_person:
            try:
                link = reverse("admin:core_user_change", args=[obj.responsible_person.id])
                display_name = obj.responsible_person.get_full_name() or obj.responsible_person.email
                return format_html('<a href="{}">{}</a>', link, display_name)
            except Exception: return obj.responsible_person.email
        return '-'

@admin.register(Amenity)
class AmenityAdmin(TranslationAdmin): # Изменено на TranslationAdmin
    list_display = ('name', 'icon_class')
    search_fields = ('name',)
    def has_module_permission(self, request): return request.user.is_superuser
    def has_view_permission(self, request, obj=None): return request.user.is_superuser
    def has_add_permission(self, request): return request.user.is_superuser
    def has_change_permission(self, request, obj=None): return request.user.is_superuser
    def has_delete_permission(self, request, obj=None): return request.user.is_superuser