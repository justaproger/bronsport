# dashboard/urls.py
from django.urls import path
from .views import get_user_dashboard_stats_api, export_orders_to_excel # Добавили export_orders_to_excel

app_name = 'dashboard'

urlpatterns = [
    path('user-stats/', get_user_dashboard_stats_api, name='user-dashboard-stats-api'),
    path('export-orders-excel/', export_orders_to_excel, name='export-orders-excel'), # Новый URL
]