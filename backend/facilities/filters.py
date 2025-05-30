import django_filters
from django.utils.translation import gettext_lazy as _

from .models import Facility

class FacilityFilter(django_filters.FilterSet):
    # Для фильтрации по диапазону цен (если нужно будет явно определить)
    # price_min = django_filters.NumberFilter(field_name="price_per_hour", lookup_expr='gte', label=_("Минимальная цена"))
    # price_max = django_filters.NumberFilter(field_name="price_per_hour", lookup_expr='lte', label=_("Максимальная цена"))

    # Фильтр для university (по ID) - стандартный
    university = django_filters.NumberFilter(field_name="university__id", lookup_expr='exact')
    
    # Фильтр для города университета (по частичному совпадению без учета регистра)
    university__city = django_filters.CharFilter(field_name="university__city", lookup_expr='icontains')

    # --- ИЗМЕНЕНИЕ: Явное определение фильтра для facility_type ---
    # Используем BaseInFilter, который по умолчанию разделяет значения по запятой
    facility_type = django_filters.BaseInFilter(field_name="facility_type", lookup_expr='in')
    # --------------------------------------------------------------

    # Фильтр для amenities (по ID, для ManyToMany) - стандартный
    amenities = django_filters.ModelMultipleChoiceFilter(
        field_name='amenities__id',
        to_field_name='id',
        queryset=Facility.amenities.field.related_model.objects.all(), # queryset для удобств
        conjoined=False, # Используем OR для нескольких удобств (объект должен иметь хотя бы одно из выбранных)
                        # Если нужно AND (все выбранные), то conjoined=True
        label=_("Удобства (ID)")
    )
    # Если фронтенд шлет ID удобств через запятую, можно использовать BaseInFilter и для amenities:
    # amenities_in = django_filters.BaseInFilter(field_name="amenities__id", lookup_expr='in')


    # Фильтр для booking_type (если нужно несколько)
    booking_type = django_filters.BaseInFilter(field_name="booking_type", lookup_expr='in')


    class Meta:
        model = Facility
        fields = {
            # 'facility_type': ['exact', 'in'], # Убрали отсюда, т.к. определили явно выше
            'price_per_hour': ['gte', 'lte', 'exact'],
            # 'university': ['exact'], # Определили явно выше
            # 'university__city': ['icontains'], # Определили явно выше
            # 'amenities': ['exact'], # Определили явно выше как ModelMultipleChoiceFilter
            # 'booking_type': ['exact', 'in'] # Определили явно выше
        }
        # Добавляем поля, которые не были явно определены, но нужны из старого filterset_fields
        # Если поле уже определено выше, его не нужно дублировать здесь в fields.
        # fields = ['price_per_hour'] # Оставляем только те, что не определены явно