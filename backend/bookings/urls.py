from django.urls import path
from .views import (
    MyUnifiedOrderListView,
    PreparePaycomPaymentView,
    GetPaycomCheckoutLinkView,
    OrderPaymentStatusView
)
app_name = 'bookings'
urlpatterns = [
    path('my-orders/', MyUnifiedOrderListView.as_view(), name='my-unified-orders-list'),
    path('prepare-paycom-payment/', PreparePaycomPaymentView.as_view(), name='prepare-paycom-payment'),
    path('orders/<str:order_identifier>/get-paycom-checkout-url/', GetPaycomCheckoutLinkView.as_view(), name='get-paycom-checkout-url'),
    path('orders/<str:order_identifier>/payment-status/', OrderPaymentStatusView.as_view(), name='order-payment-status'),
]