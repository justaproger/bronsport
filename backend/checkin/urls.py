# --- START OF FULL FILE backend/checkin/urls.py ---
from django.urls import path
from .views import OrderDetailsByQRCodeView, CompleteOrderFromQRView

app_name = 'checkin_api'

urlpatterns = [
    path('order-details/<str:order_code>/', OrderDetailsByQRCodeView.as_view(), name='qr_order_details'),
    path('complete-order/<str:order_code>/', CompleteOrderFromQRView.as_view(), name='qr_complete_order'),
]
# --- END OF FULL FILE ---