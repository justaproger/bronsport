# --- START OF FULL FILE backend/universities/serializers.py ---
from rest_framework import serializers
from .models import University, Staff, SportClub, UniversityImage
# Импортируем gettext_lazy для возможных переводов в будущем
from django.utils.translation import gettext_lazy as _

# Сериализатор для Staff (без изменений)
class StaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        fields = ['id', 'full_name', 'position', 'photo', 'bio', 'phone', 'email']

# Сериализатор для SportClub (без изменений)
class SportClubSerializer(serializers.ModelSerializer):
    coach_full_name = serializers.StringRelatedField(source='coach', read_only=True)
    class Meta:
        model = SportClub
        fields = [
            'id', 'name', 'sport_type', 'icon_class', 'description',
            'schedule_info', 'coach_full_name', 'coach_name_manual',
            'contact_info', 'image', 'is_active'
        ]

# Сериализатор для UniversityImage (без изменений)
class UniversityImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = UniversityImage
        fields = ['id', 'image', 'caption']

# Сериализатор для списка University (без изменений)
class UniversityListSerializer(serializers.ModelSerializer):
    class Meta:
        model = University
        fields = ['id', 'name', 'short_name', 'city', 'logo', 'campus_image']


# --- ИЗМЕНЕНИЕ: Сериализатор для деталей University ---
class UniversityDetailSerializer(serializers.ModelSerializer):
    """ Сериализатор для детальной информации об университете. """
    # --- НОВЫЕ ПОЛЯ ДЛЯ СЧЕТЧИКОВ ---
    active_facilities_count = serializers.SerializerMethodField(read_only=True)
    staff_count = serializers.SerializerMethodField(read_only=True)
    active_clubs_count = serializers.SerializerMethodField(read_only=True)
    # ---------------------------------
    # Вложенный сериализатор для галереи
    gallery_images = UniversityImageSerializer(many=True, read_only=True)

    class Meta:
        model = University
        # Включаем все поля модели University + новые поля счетчиков
        fields = [
            'id', 'name', 'short_name', 'city', 'address', 'description',
            'logo', 'campus_image',
            'website', 'phone_number', 'email', 'established_year',
            'administrator', # ID администратора
            'working_hours',
            'is_active',
            # --- НОВЫЕ ПОЛЯ ---
            'active_facilities_count',
            'staff_count',
            'active_clubs_count',
            # -----------------
            'gallery_images', # Список изображений галереи
        ]
        # Указываем поля только для чтения явно
        read_only_fields = (
            'active_facilities_count',
            'staff_count',
            'active_clubs_count',
            'gallery_images'
        )

    # --- НОВЫЕ МЕТОДЫ ДЛЯ ПОДСЧЕТА ---
    def get_active_facilities_count(self, obj):
         """ Подсчитывает количество АКТИВНЫХ объектов. """
         if hasattr(obj, 'facilities'):
             return obj.facilities.filter(is_active=True).count()
         return 0

    def get_staff_count(self, obj):
        """ Подсчитывает количество сотрудников. """
        if hasattr(obj, 'staff_members'):
            return obj.staff_members.count()
        return 0

    def get_active_clubs_count(self, obj):
        """ Подсчитывает количество АКТИВНЫХ кружков. """
        if hasattr(obj, 'sport_clubs'):
            return obj.sport_clubs.filter(is_active=True).count()
        return 0
    # ---------------------------------

# --- END OF FULL FILE ---