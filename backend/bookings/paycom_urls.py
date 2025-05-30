# --- START OF FULL FILE backend/bookings/paycom_urls.py ---
from django.urls import path
from .paycom_handler import CustomPaymeCallbackView # Импортируем наш кастомный обработчик

app_name = 'paycom_integration' # Уникальное имя для namespace

urlpatterns = [
    # Динамический путь, который захватывает слаг университета
    # Этот URL будет указываться в настройках кассы каждого университета в Payme Business
    # Например: https://api.bronsport.uz/paycom-callbacks/webhook/tashkent-state-university/
    path('webhook/<slug:university_webhook_slug>/', CustomPaymeCallbackView.as_view(), name='payme_webhook_dynamic'),
]
# --- END OF FULL FILE ---