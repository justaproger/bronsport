from modeltranslation.translator import register, TranslationOptions
from .models import University, Staff, SportClub

@register(University)
class UniversityTranslationOptions(TranslationOptions):
    fields = ('name', 'short_name', 'city', 'address', 'description', 'working_hours')

@register(Staff)
class StaffTranslationOptions(TranslationOptions):
    fields = ('full_name', 'position', 'bio')

@register(SportClub)
class SportClubTranslationOptions(TranslationOptions):
    fields = ('name', 'sport_type', 'description', 'schedule_info', 'coach_name_manual', 'contact_info')