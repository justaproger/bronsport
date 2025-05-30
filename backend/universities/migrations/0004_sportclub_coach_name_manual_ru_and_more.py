# Generated by Django 4.2.18 on 2025-05-16 04:42

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('universities', '0003_alter_universityimage_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='sportclub',
            name='coach_name_manual_ru',
            field=models.CharField(blank=True, help_text='Используйте, если тренера нет в списке персонала', max_length=255, null=True, verbose_name='Тренер (текст)'),
        ),
        migrations.AddField(
            model_name='sportclub',
            name='coach_name_manual_uz',
            field=models.CharField(blank=True, help_text='Используйте, если тренера нет в списке персонала', max_length=255, null=True, verbose_name='Тренер (текст)'),
        ),
        migrations.AddField(
            model_name='sportclub',
            name='contact_info_ru',
            field=models.CharField(blank=True, max_length=200, null=True, verbose_name='Контактная информация (тел/email)'),
        ),
        migrations.AddField(
            model_name='sportclub',
            name='contact_info_uz',
            field=models.CharField(blank=True, max_length=200, null=True, verbose_name='Контактная информация (тел/email)'),
        ),
        migrations.AddField(
            model_name='sportclub',
            name='description_ru',
            field=models.TextField(blank=True, null=True, verbose_name='Описание'),
        ),
        migrations.AddField(
            model_name='sportclub',
            name='description_uz',
            field=models.TextField(blank=True, null=True, verbose_name='Описание'),
        ),
        migrations.AddField(
            model_name='sportclub',
            name='name_ru',
            field=models.CharField(max_length=200, null=True, verbose_name='Название кружка'),
        ),
        migrations.AddField(
            model_name='sportclub',
            name='name_uz',
            field=models.CharField(max_length=200, null=True, verbose_name='Название кружка'),
        ),
        migrations.AddField(
            model_name='sportclub',
            name='schedule_info_ru',
            field=models.TextField(blank=True, help_text='Пример: Пн, Ср, Пт: 18:00 - 20:00, Спортзал А', null=True, verbose_name='Информация о расписании'),
        ),
        migrations.AddField(
            model_name='sportclub',
            name='schedule_info_uz',
            field=models.TextField(blank=True, help_text='Пример: Пн, Ср, Пт: 18:00 - 20:00, Спортзал А', null=True, verbose_name='Информация о расписании'),
        ),
        migrations.AddField(
            model_name='sportclub',
            name='sport_type_ru',
            field=models.CharField(db_index=True, max_length=100, null=True, verbose_name='Вид спорта'),
        ),
        migrations.AddField(
            model_name='sportclub',
            name='sport_type_uz',
            field=models.CharField(db_index=True, max_length=100, null=True, verbose_name='Вид спорта'),
        ),
        migrations.AddField(
            model_name='staff',
            name='bio_ru',
            field=models.TextField(blank=True, null=True, verbose_name='Краткая биография'),
        ),
        migrations.AddField(
            model_name='staff',
            name='bio_uz',
            field=models.TextField(blank=True, null=True, verbose_name='Краткая биография'),
        ),
        migrations.AddField(
            model_name='staff',
            name='full_name_ru',
            field=models.CharField(max_length=255, null=True, verbose_name='ФИО'),
        ),
        migrations.AddField(
            model_name='staff',
            name='full_name_uz',
            field=models.CharField(max_length=255, null=True, verbose_name='ФИО'),
        ),
        migrations.AddField(
            model_name='staff',
            name='position_ru',
            field=models.CharField(max_length=150, null=True, verbose_name='Должность'),
        ),
        migrations.AddField(
            model_name='staff',
            name='position_uz',
            field=models.CharField(max_length=150, null=True, verbose_name='Должность'),
        ),
        migrations.AddField(
            model_name='university',
            name='address_ru',
            field=models.CharField(max_length=255, null=True, verbose_name='Адрес'),
        ),
        migrations.AddField(
            model_name='university',
            name='address_uz',
            field=models.CharField(max_length=255, null=True, verbose_name='Адрес'),
        ),
        migrations.AddField(
            model_name='university',
            name='city_ru',
            field=models.CharField(db_index=True, max_length=100, null=True, verbose_name='Город'),
        ),
        migrations.AddField(
            model_name='university',
            name='city_uz',
            field=models.CharField(db_index=True, max_length=100, null=True, verbose_name='Город'),
        ),
        migrations.AddField(
            model_name='university',
            name='description_ru',
            field=models.TextField(blank=True, null=True, verbose_name='Описание'),
        ),
        migrations.AddField(
            model_name='university',
            name='description_uz',
            field=models.TextField(blank=True, null=True, verbose_name='Описание'),
        ),
        migrations.AddField(
            model_name='university',
            name='name_ru',
            field=models.CharField(max_length=255, null=True, unique=True, verbose_name='Название университета'),
        ),
        migrations.AddField(
            model_name='university',
            name='name_uz',
            field=models.CharField(max_length=255, null=True, unique=True, verbose_name='Название университета'),
        ),
        migrations.AddField(
            model_name='university',
            name='short_name_ru',
            field=models.CharField(blank=True, max_length=50, null=True, verbose_name='Сокращенное название'),
        ),
        migrations.AddField(
            model_name='university',
            name='short_name_uz',
            field=models.CharField(blank=True, max_length=50, null=True, verbose_name='Сокращенное название'),
        ),
        migrations.AddField(
            model_name='university',
            name='working_hours_ru',
            field=models.CharField(blank=True, default='Пн-Сб: 8:00 - 20:00', max_length=100, null=True, verbose_name='Часы работы (общие)'),
        ),
        migrations.AddField(
            model_name='university',
            name='working_hours_uz',
            field=models.CharField(blank=True, default='Пн-Сб: 8:00 - 20:00', max_length=100, null=True, verbose_name='Часы работы (общие)'),
        ),
    ]
