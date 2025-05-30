# Generated by Django 5.2 on 2025-05-27 21:54

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('universities', '0006_alter_university_payme_merchant_id_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='university',
            name='payme_merchant_id',
        ),
        migrations.RemoveField(
            model_name='university',
            name='payme_secret_key_production',
        ),
        migrations.RemoveField(
            model_name='university',
            name='payme_secret_key_test',
        ),
        migrations.AddField(
            model_name='university',
            name='payme_cash_id',
            field=models.CharField(blank=True, help_text='ID кассы из личного кабинета Payme Business, используется для приема платежей.', max_length=255, null=True, verbose_name='ID кассы университета в Payme (Merchant ID)'),
        ),
        migrations.AddField(
            model_name='university',
            name='payme_secret_key',
            field=models.CharField(blank=True, help_text='Секретный ключ кассы из личного кабинета Payme Business, используется для авторизации вебхуков.', max_length=255, null=True, verbose_name='Секретный ключ кассы Payme'),
        ),
        migrations.AddField(
            model_name='university',
            name='webhook_slug',
            field=models.SlugField(blank=True, help_text="Уникальный идентификатор для URL вебхука, например, 'tashkent-state-university'. Генерируется автоматически, если не указан.", max_length=100, null=True, unique=True, verbose_name='Слаг для URL вебхука Payme'),
        ),
    ]
