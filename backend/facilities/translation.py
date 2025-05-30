from modeltranslation.translator import register, TranslationOptions
from .models import Facility, Amenity

@register(Facility)
class FacilityTranslationOptions(TranslationOptions):
    fields = ('name', 'description', 'location_details', 'size') # Добавил 'size'
    # 'working_days' не переводим, т.к. там теперь числа, а отображение на фронте

@register(Amenity)
class AmenityTranslationOptions(TranslationOptions):
    fields = ('name',)