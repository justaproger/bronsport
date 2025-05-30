# --- START OF FULL FILE backend/checkin/views.py ---
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
import logging

from bookings.models import Order
from bookings.serializers import OrderSerializer # Используем существующий OrderSerializer
from .permissions import IsStaffUserPermission 

logger = logging.getLogger(__name__)

class OrderDetailsByQRCodeView(APIView):
    permission_classes = [IsStaffUserPermission]

    def get(self, request, order_code, format=None):
        logger.info(f"[QRCheckin] Staff user {request.user.email} requesting details for order_code: {order_code}")
        try:
            order = Order.objects.select_related(
                'user', 'facility', 'facility__university', 'payment_transaction_link'
            ).get(order_code__iexact=order_code)
        except Order.DoesNotExist:
            logger.warning(f"[QRCheckin] Order with code '{order_code}' not found.")
            return Response({"error": _("Заказ с таким кодом не найден.")}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = OrderSerializer(order, context={'request': request})
        logger.info(f"[QRCheckin] Successfully retrieved details for order {order.id}.")
        return Response(serializer.data)

class CompleteOrderFromQRView(APIView):
    permission_classes = [IsStaffUserPermission]

    def post(self, request, order_code, format=None):
        logger.info(f"[QRCheckin] Staff user {request.user.email} attempting to complete order_code: {order_code}")
        try:
            order = Order.objects.get(order_code__iexact=order_code)
        except Order.DoesNotExist:
            logger.warning(f"[QRCheckin] Order with code '{order_code}' not found for completion.")
            return Response({"error": _("Заказ с таким кодом не найден.")}, status=status.HTTP_404_NOT_FOUND)

        if order.order_type not in [Order.TYPE_SLOT_BOOKING, Order.TYPE_ENTRY_FEE]:
            logger.warning(f"[QRCheckin] Attempt to complete non-completable order type: {order.order_type} for order {order.id}.")
            return Response(
                {"error": _("Этот тип заказа ('{order_type}') не может быть завершен через сканер QR-кода таким образом.").format(order_type=order.get_order_type_display())},
                status=status.HTTP_400_BAD_REQUEST
            )

        if order.status == Order.STATUS_CONFIRMED:
            order.status = Order.STATUS_COMPLETED
            order.save(update_fields=['status', 'updated_at'])
            serializer = OrderSerializer(order, context={'request': request})
            logger.info(f"[QRCheckin] Order {order.id} successfully completed by {request.user.email}.")
            return Response(serializer.data)
        elif order.status == Order.STATUS_COMPLETED:
            logger.info(f"[QRCheckin] Order {order.id} was already completed.")
            return Response(
                {"message": _("Заказ уже был отмечен как использованный."), "order": OrderSerializer(order, context={'request': request}).data},
                status=status.HTTP_200_OK
            )
        else:
            logger.warning(f"[QRCheckin] Attempt to complete order {order.id} with invalid status: {order.status}.")
            return Response(
                {"error": _("Заказ не может быть отмечен как использованный. Текущий статус: {status}.").format(status=order.get_status_display())},
                status=status.HTTP_400_BAD_REQUEST
            )
# --- END OF FULL FILE ---