# --- START OF FULL FILE backend/checkin/apps.py ---
from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _

class CheckinConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'checkin'
    verbose_name = _("Проверка Заказов (QR)")
# --- END OF FULL FILE ---