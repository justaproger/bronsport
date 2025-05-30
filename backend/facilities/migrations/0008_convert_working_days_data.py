from django.db import migrations
from django.utils.translation import gettext_lazy as _ # Если используется в карте

# Карта для конвертации старых строковых значений в числа
# Ключи должны быть в нижнем регистре для надежности
OLD_DAYS_MAP = {
    # Русские
    'пн': 0, 'пон': 0, 'понедельник': 0,
    'вт': 1, 'вто': 1, 'вторник': 1,
    'ср': 2, 'сре': 2, 'среда': 2,
    'чт': 3, 'чет': 3, 'четверг': 3,
    'пт': 4, 'пят': 4, 'пятница': 4,
    'сб': 5, 'суб': 5, 'суббота': 5,
    'вс': 6, 'вос': 6, 'воскресенье': 6,
    # Узбекские (латиница) - если вдруг такие есть
    'du': 0, 'dushanba': 0,
    'se': 1, 'seshanba': 1,
    'ch': 2, 'chor': 2, 'chorshanba': 2,
    'pa': 3, 'pay': 3, 'payshanba': 3,
    'ju': 4, 'juma': 4,
    'sh': 5, 'shan': 5, 'shanba': 5,
    'ya': 6, 'yak': 6, 'yakshanba': 6,
    # Английские - на всякий случай
    'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6,
}

def convert_working_days_to_numeric(apps, schema_editor):
    Facility = apps.get_model('facilities', 'Facility')
    for facility_instance in Facility.objects.all():
        current_value = facility_instance.working_days
        # Проверяем, содержит ли строка буквы (признак старого формата)
        # или если она пустая/None, но default был строковым
        if current_value and any(char.isalpha() for char in current_value):
            old_days_list_str = [d.strip().lower() for d in current_value.split(',')]
            numeric_days_set = set() # Используем set для автоматического удаления дубликатов
            
            for day_str_part in old_days_list_str:
                day_numeric = OLD_DAYS_MAP.get(day_str_part)
                # Попробуем более короткие варианты, если полное совпадение не найдено
                if day_numeric is None and len(day_str_part) >= 2:
                    day_numeric = OLD_DAYS_MAP.get(day_str_part[:2])
                if day_numeric is None and len(day_str_part) >= 3:
                     day_numeric = OLD_DAYS_MAP.get(day_str_part[:3])

                if day_numeric is not None:
                    numeric_days_set.add(day_numeric)
            
            if numeric_days_set:
                facility_instance.working_days = ",".join(map(str, sorted(list(numeric_days_set))))
            else:
                # Если не удалось сконвертировать, устанавливаем значение по умолчанию (Пн-Сб)
                # или оставляем пустым, если это более подходящее поведение
                print(f"Warning: Could not convert working_days for Facility ID {facility_instance.id}: '{current_value}'. Setting to default '0,1,2,3,4,5'.")
                facility_instance.working_days = "0,1,2,3,4,5"
            facility_instance.save(update_fields=['working_days'])
        elif not current_value: # Если поле было пустым, ставим дефолт
             facility_instance.working_days = "0,1,2,3,4,5"
             facility_instance.save(update_fields=['working_days'])


def revert_working_days_to_string(apps, schema_editor):
    # Обратное преобразование не требуется для этого проекта,
    # но если бы было нужно, логика была бы здесь.
    # Для простоты можно оставить pass или вызвать NotImplementedError.
    # Facility = apps.get_model('facilities', 'Facility')
    # for facility_instance in Facility.objects.all():
    #    pass # Логика обратного преобразования
    print("Reverting working_days from numeric to string is not automatically implemented. Manual data adjustment may be needed if rolling back.")


class Migration(migrations.Migration):

    dependencies = [
        ('facilities', '0007_alter_facility_working_days'), # <-- ЗАМЕНИ 000X_... НА ИМЯ ПРЕДЫДУЩЕЙ МИГРАЦИИ
    ]

    operations = [
        migrations.RunPython(convert_working_days_to_numeric, revert_working_days_to_string),
    ]