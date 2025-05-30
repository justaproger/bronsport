# dashboard/models.py
from django.db import models
from django.utils.translation import gettext_lazy as _

# Эта модель не создает таблицу в БД (managed = False)
# Она нужна только для регистрации в админке, чтобы появился пункт меню
class StatisticsDashboard(models.Model):

    class Meta:
        verbose_name = _('Статистика Общая') # Название в меню
        verbose_name_plural = _('Статистика Общая')
        # proxy = True # Можно сделать прокси от существующей, но managed=False проще
        managed = False # Не создавать таблицу в БД
        # Указываем app_label, чтобы она точно попала в наше приложение dashboard
        app_label = 'dashboard'
        # Права доступа по умолчанию (можно переопределить)
        # default_permissions = ('view',)