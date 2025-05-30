# Generated by Django 4.2.18 on 2025-05-08 09:14

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('facilities', '0002_alter_facilityimage_options_facilityimage_caption_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='facility',
            name='booking_type',
            field=models.CharField(choices=[('exclusive_slot', 'Эксклюзивный слот (1 бронь/время)'), ('overlapping_slot', 'Пересекающийся слот (несколько броней/время)'), ('entry_fee', 'Оплата за вход (без слотов)')], db_index=True, default='exclusive_slot', help_text='Определяет, как можно бронировать объект: по слотам или по входу.', max_length=20, verbose_name='Тип бронирования'),
        ),
        migrations.AddField(
            model_name='facility',
            name='max_capacity',
            field=models.PositiveIntegerField(blank=True, help_text="Для типа 'Пересекающийся слот': макс. кол-во одновременных броней на 1 слот. Оставьте пустым для неограниченной.", null=True, validators=[django.core.validators.MinValueValidator(1)], verbose_name='Макс. вместимость слота'),
        ),
        migrations.AlterField(
            model_name='facility',
            name='price_per_hour',
            field=models.DecimalField(decimal_places=0, help_text="Цена за 1 час для 'Эксклюзивный/Пересекающийся слот' ИЛИ цена за вход для 'Оплата за вход'.", max_digits=10, verbose_name='Цена (сум)'),
        ),
    ]
