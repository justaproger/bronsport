from rest_framework import serializers
from .models import Facility, Amenity, FacilityImage
try:
    from universities.serializers import UniversityListSerializer
    UNIVERSITY_SERIALIZER_IMPORTED = True
except ImportError:
    UniversityListSerializer = serializers.StringRelatedField # type: ignore
    UNIVERSITY_SERIALIZER_IMPORTED = False
    print("Warning [facilities.serializers]: Could not import UniversityListSerializer.")

from django.utils.translation import gettext_lazy as _

class AmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Amenity
        fields = ['id', 'name', 'icon_class']

class FacilityImageSerializer(serializers.ModelSerializer):
     class Meta:
         model = FacilityImage
         fields = ['id', 'image', 'caption']

class FacilityListSerializer(serializers.ModelSerializer):
    university = UniversityListSerializer(read_only=True)
    city = serializers.CharField(source='university.city', read_only=True)
    # facility_type_display УБРАНО, используем facility_type и переводим на фронте

    class Meta:
        model = Facility
        fields = [
            'id', 'name', 'university', 'facility_type', # Оставляем facility_type (код)
            'price_per_hour', 'main_image', 'city',
            'open_time', 'close_time', 'booking_type', # Оставляем booking_type (код)
            # 'working_days' можно оставить, если фронт его парсит, или создать display на фронте
        ]
        read_only_fields = fields

class FacilityDetailSerializer(serializers.ModelSerializer):
    university = UniversityListSerializer(read_only=True)
    amenities = AmenitySerializer(many=True, read_only=True)
    images = FacilityImageSerializer(many=True, read_only=True)
    # facility_type_display УБРАНО
    # booking_type_display УБРАНО
    responsible_person_details = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Facility
        fields = [
            'id', 'name', 'university', 'facility_type', # Оставляем facility_type
            'description', 'price_per_hour', 'size', 'location_details',
            'open_time', 'close_time', 'working_days', 'contact_phone',
            'responsible_person', 'responsible_person_details',
            'amenities', 'is_active', 'main_image', 'images',
            'booking_type', # Оставляем booking_type
            'max_capacity',
        ]
        read_only_fields = (
            'university', 'amenities', 'images',
            'responsible_person_details',
        )

    def get_responsible_person_details(self, obj):
        if obj.responsible_person:
            full_name = obj.responsible_person.get_full_name()
            return full_name if full_name else obj.responsible_person.email
        return None