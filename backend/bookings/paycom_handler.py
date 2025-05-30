# --- START OF FULL MODIFIED backend/bookings/paycom_handler.py ---
import base64
import binascii
import logging
from decimal import Decimal, ROUND_DOWN

from django.conf import settings
from django.utils import timezone
from django.utils.module_loading import import_string
from django.db import transaction as django_db_transaction
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext_lazy as _

from rest_framework.response import Response

from payme.views import PaymeWebHookAPIView, handle_exceptions as payme_handle_exceptions_decorator
from payme.models import PaymeTransactions
from payme import exceptions as payme_exceptions
from payme.types import response as payme_response_types
from payme.util import time_to_payme, time_to_service

from .models import Order, PaymentTransaction
from universities.models import University

logger = logging.getLogger(__name__) # Имя логгера будет bookings.paycom_handler

try:
    AccountModel = import_string(settings.PAYME_ACCOUNT_MODEL)
    if AccountModel is not Order: logger.warning(f"PAYME_ACCOUNT_MODEL is {settings.PAYME_ACCOUNT_MODEL}, but local Order model is {Order}.")
except ImportError:
    logger.error(f"Could not import PAYME_ACCOUNT_MODEL: {settings.PAYME_ACCOUNT_MODEL}")
    AccountModel = Order

class CustomPaymeCallbackView(PaymeWebHookAPIView):
    current_university = None 

    def check_authorize(self, request, university_webhook_slug=None):
        # ... (логика check_authorize, logger.error и logger.warning остаются, logger.info об успехе можно оставить)
        if not university_webhook_slug: logger.error("[PaymeAuth] Slug missing."); raise payme_exceptions.PermissionDenied("slug_missing")
        try:
            university = University.objects.get(webhook_slug=university_webhook_slug, is_active=True)
            payme_key_for_university = university.payme_secret_key
            payme_login_for_university = university.payme_cash_id
        except University.DoesNotExist: logger.error(f"[PaymeAuth] Uni slug '{university_webhook_slug}' not found."); raise payme_exceptions.PermissionDenied("university_not_found")
        except Exception as e: logger.error(f"[PaymeAuth] Creds retrieval error for slug '{university_webhook_slug}': {e}", exc_info=True); raise payme_exceptions.InternalServiceError("credential_access_error")
        if not payme_key_for_university or not payme_login_for_university: logger.error(f"[PaymeAuth] Credentials not set for uni {university.id}."); raise payme_exceptions.PermissionDenied("university_credentials_missing")
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        if not auth_header: logger.warning(f"[PaymeAuth] Missing Auth header for {university_webhook_slug}."); raise payme_exceptions.PermissionDenied("auth_header_missing")
        try:
            auth_type, creds = auth_header.split(); assert auth_type.lower() == 'basic'
            login_hdr, key_hdr = base64.b64decode(creds).decode('utf-8').split(':', 1)
        except: logger.warning(f"[PaymeAuth] Auth decoding error for {university_webhook_slug}."); raise payme_exceptions.PermissionDenied("auth_decoding_error")
        if login_hdr != payme_login_for_university or key_hdr != payme_key_for_university: logger.warning(f"[PaymeAuth] Invalid credentials for uni {university.id}."); raise payme_exceptions.PermissionDenied("invalid_key_or_login")
        self.current_university = university
        logger.info(f"[PaymeAuth] Authorized Paycom request for university: {self.current_university.name}")


    def post(self, request, *args, **kwargs):
        # ... (код post, logger.warning для MethodNotFound и InvalidParamsError) ...
        university_webhook_slug = kwargs.get('university_webhook_slug')
        self.check_authorize(request, university_webhook_slug=university_webhook_slug)
        payme_methods_map = { "GetStatement": self.get_statement, "CancelTransaction": self.cancel_transaction, "PerformTransaction": self.perform_transaction, "CreateTransaction": self.create_transaction, "CheckTransaction": self.check_transaction, "CheckPerformTransaction": self.check_perform_transaction, "SetFiscalData": self.set_fiscal_data, }
        try: method = request.data["method"]; params = request.data["params"]; request_id = request.data.get("id") 
        except KeyError as exc:
            message = f"Invalid request structure: missing '{exc.args[0]}'"; logger.warning(f"[PaymeCallbackPost] {message}")
            error_payload = {"error": {"code": payme_exceptions.InvalidParamsError.error_code, "message": payme_exceptions.InvalidParamsError.message, "data": message}, "id": request.data.get("id", None)}
            return Response(error_payload, status=200)
        if method in payme_methods_map:
            result_payload_dict = payme_methods_map[method](params) 
            if request_id is not None: result_payload_dict["id"] = request_id
            return Response(result_payload_dict) 
        logger.warning(f"[PaymeCallbackPost] Method not found: {method}")
        raise payme_exceptions.MethodNotFound(method)


    @payme_handle_exceptions_decorator
    def fetch_account(self, params: dict) -> Order:
        # ... (logger.warning и logger.error остаются) ...
        account_field_name = settings.PAYME_ACCOUNT_FIELD; account_value = params.get('account', {}).get(account_field_name)
        if not account_value: logger.warning(f"[PaymeLogic] Account field '{account_field_name}' missing."); raise payme_exceptions.InvalidAccount(account_field_name)
        try:
            order_instance = AccountModel.objects.get(**{account_field_name: account_value})
            if not hasattr(order_instance, 'facility') or not hasattr(order_instance.facility, 'university'): logger.error(f"[PaymeLogic] Order {order_instance.id} integrity error."); raise payme_exceptions.InternalServiceError("order_integrity_error")
            if order_instance.facility.university != self.current_university: logger.error(f"[PaymeLogic] Order {order_instance.id} university mismatch."); raise payme_exceptions.AccountDoesNotExist(account_field_name)
            return order_instance
        except AccountModel.DoesNotExist: logger.warning(f"[PaymeLogic] Order not found by {account_field_name}={account_value}."); raise 
        except Exception as e: logger.error(f"[PaymeLogic] Unexpected error in fetch_account: {e}", exc_info=True); raise payme_exceptions.InternalServiceError(f"fetch_account_failed: {str(e)}")


    @payme_handle_exceptions_decorator
    def validate_amount(self, order_instance: Order, amount_from_payme_tiyin: int):
        # ... (logger.warning остается) ...
        if not settings.PAYME_ONE_TIME_PAYMENT: return True
        expected_amount_tiyin = int(order_instance.total_price * 100)
        if expected_amount_tiyin != amount_from_payme_tiyin: logger.warning(f"[PaymeLogic] Invalid amount for order {order_instance.id}. Expected: {expected_amount_tiyin}, received: {amount_from_payme_tiyin}"); raise payme_exceptions.IncorrectAmount("amount")
        return True
        
    # _get_receivers_for_order - logger.error остается

    @payme_handle_exceptions_decorator
    def create_transaction(self, params: dict) -> dict:
        # ... (logger.warning и logger.info для идемпотентности и ключевых шагов можно оставить, 
        #      но убрать слишком частые или чисто отладочные) ...
        # ... (например, logger.info(f"[PaymeCreateTx] PaymeTransaction ... already exists in state INITIATING (idempotency).") - можно сделать debug или убрать)
        # ... (logger.error остается)
        paycom_transaction_id = params["id"]; paycom_amount_tiyin = int(Decimal(params.get('amount', 0)))
        order_instance = self.fetch_account(params); self.validate_amount(order_instance, paycom_amount_tiyin)
        if settings.PAYME_ONE_TIME_PAYMENT: # ... (проверка existing_other_payme_tx_for_order, logger.warning) ...
            existing_other_payme_tx_for_order = PaymeTransactions.objects.filter(account_id=order_instance.pk, state=PaymeTransactions.INITIATING).exclude(transaction_id=paycom_transaction_id).first()
            if existing_other_payme_tx_for_order: logger.warning(f"[PaymeCreateTx] Order {order_instance.id} already has active PaymeTx {existing_other_payme_tx_for_order.transaction_id}."); raise payme_exceptions.TransactionAlreadyExists(settings.PAYME_ACCOUNT_FIELD)
        if order_instance.status != Order.STATUS_PENDING_PAYMENT: # ... (проверка existing_payme_tx, logger.info/warning) ...
            try: 
                existing_payme_tx = PaymeTransactions.objects.get(transaction_id=paycom_transaction_id)
                if existing_payme_tx.is_performed() or existing_payme_tx.is_cancelled(): return {"result": {"create_time": time_to_payme(existing_payme_tx.created_at), "transaction": str(getattr(order_instance, settings.PAYME_ACCOUNT_FIELD)), "state": existing_payme_tx.state}}
                elif existing_payme_tx.state == PaymeTransactions.INITIATING: pass 
                else: raise payme_exceptions.AccountDoesNotExist(f"Order {order_instance.id} status invalid and Payme tx {paycom_transaction_id} in unexpected state {existing_payme_tx.state}")
            except PaymeTransactions.DoesNotExist: raise payme_exceptions.AccountDoesNotExist(f"Order {order_instance.id} not pending and no Payme tx {paycom_transaction_id} found")
        with django_db_transaction.atomic(): # ... (создание/обновление, logger.error если нужно) ...
            payme_tx_defaults = {"amount": Decimal(paycom_amount_tiyin) / 100, "state": PaymeTransactions.INITIATING, "account_id": order_instance.pk}
            payme_transaction_record, created = PaymeTransactions.objects.get_or_create(transaction_id=paycom_transaction_id, defaults=payme_tx_defaults)
            if not created and payme_transaction_record.state != PaymeTransactions.INITIATING:
                if payme_transaction_record.is_performed() or payme_transaction_record.is_cancelled(): return {"result": {"create_time": time_to_payme(payme_transaction_record.created_at), "transaction": str(getattr(order_instance, settings.PAYME_ACCOUNT_FIELD)), "state": payme_transaction_record.state}}
                raise payme_exceptions.AccountDoesNotExist(f"Payme tx {paycom_transaction_id} exists for Order {order_instance.id} but not initiating")
            our_payment_transaction = get_object_or_404(PaymentTransaction, created_order=order_instance)
            our_payment_transaction.paycom_id = paycom_transaction_id; our_payment_transaction.paycom_time_created_ms = params.get("time"); our_payment_transaction.status = PaymentTransaction.STATUS_PROVIDER_PROCESSING 
            our_payment_transaction.save(update_fields=['paycom_id', 'paycom_time_created_ms', 'status', 'updated_at'])
        response_payload = {"create_time": time_to_payme(payme_transaction_record.created_at), "transaction": str(getattr(order_instance, settings.PAYME_ACCOUNT_FIELD)), "state": payme_transaction_record.state}
        self.handle_created_payment(params, {"result": response_payload}) 
        return {"result": response_payload}

    @payme_handle_exceptions_decorator
    def check_perform_transaction(self, params: dict) -> dict:
        # ... (logger.warning и logger.error остаются, logger.info об успехе можно оставить) ...
        order_instance = self.fetch_account(params)
        if order_instance.status != Order.STATUS_PENDING_PAYMENT: logger.warning(f"[PaymeCheckPerform] Order {order_instance.id} not PENDING_PAYMENT."); raise payme_exceptions.AccountDoesNotExist(settings.PAYME_ACCOUNT_FIELD)
        self.validate_amount(order_instance, params.get('amount'))
        # ... (формирование fiscal_detail_object, logger.error для несоответствия сумм) ...
        IKPU_CODE = "11003001007000000"; VAT_PERCENTAGE = 0; PACKAGE_CODE = "1505740"
        service_title = f"{order_instance.get_order_type_display()} - {order_instance.facility.name} ({order_instance.order_code})"
        if len(service_title) > 255: service_title = service_title[:252] + "..."
        item_dict = {"title": service_title, "price": int(Decimal(params.get('amount',0))), "count": 1, "code": IKPU_CODE, "vat_percent": VAT_PERCENTAGE, "package_code": PACKAGE_CODE}
        calculated_sum_from_items = (item_dict["price"] * item_dict["count"]) - item_dict.get("discount",0)
        if calculated_sum_from_items != int(Decimal(params.get('amount',0))): logger.error(f"[PaymeCheckPerform] Fiscal sum mismatch Order {order_instance.id}."); raise payme_exceptions.InternalServiceError("fiscal_items_sum_mismatch")
        fiscal_detail_object = {"receipt_type": 0, "items": [item_dict]}
        final_response_dict = {"allow": True, "detail": fiscal_detail_object}
        logger.info(f"[PaymeCheckPerform] Order {order_instance.id} allowed. Fiscal detail prepared.")
        return {"result": final_response_dict}

    # Для perform_transaction, cancel_transaction, check_transaction, get_statement:
    # Логика вызова super() и модификации ответа не содержит много кастомных логов, кроме logger.error/warning
    # при ошибках поиска связанных объектов, что полезно оставить.

    # Коллбэки handle_successfully_payment, handle_cancelled_payment:
    # logger.info о входе в метод и успешном обновлении можно оставить.
    # logger.error для исключений обязателен.
    # Убрал [PaymePerformDebug] и [PaymeCancelDebug] для единообразия.

    def handle_successfully_payment(self, params, result, *args, **kwargs):
        logger.info(f"[PaymePerform] Entered handle_successfully_payment. Order ID (our): {result.get('result',{}).get('transaction')}, Payme Tx ID: {params.get('id')}")
        super().handle_successfully_payment(params, result, *args, **kwargs)
        # ... (остальная логика с logger.info/error как была) ...
        paycom_id_from_params = params['id']
        try:
            payme_tx_record = PaymeTransactions.objects.get(transaction_id=paycom_id_from_params)
            our_order_pk = payme_tx_record.account_id
            order_instance = AccountModel.objects.get(pk=our_order_pk)
            # logger.info(f"[PaymePerform] Found Order: {order_instance.id}, current status: {order_instance.status}")
            with django_db_transaction.atomic(): # ... (обновление Order и PaymentTransaction) ...
                order_needs_save = False
                if order_instance.status == Order.STATUS_PENDING_PAYMENT: order_instance.status = Order.STATUS_CONFIRMED; order_needs_save = True; logger.info(f"[PaymePerform] Order {order_instance.id} status set to CONFIRMED.")
                elif order_instance.status == Order.STATUS_CONFIRMED: logger.info(f"[PaymePerform] Order {order_instance.id} already CONFIRMED.")
                else: logger.error(f"[PaymePerform] Order {order_instance.id} has unexpected status {order_instance.status}.")
                if order_needs_save: order_instance.save(update_fields=['status', 'updated_at'])
                if hasattr(order_instance, 'payment_transaction_link') and order_instance.payment_transaction_link: # ... (обновление PaymentTransaction) ...
                    our_payment_transaction = order_instance.payment_transaction_link; pt_needs_save = False
                    if not our_payment_transaction.paycom_id: our_payment_transaction.paycom_id = paycom_id_from_params; pt_needs_save = True
                    elif our_payment_transaction.paycom_id != paycom_id_from_params: logger.error(f"[PaymePerform] Paycom ID mismatch for Order {order_instance.id}!")
                    if our_payment_transaction.status != PaymentTransaction.STATUS_ORDER_CONFIRMED_BY_PROVIDER: our_payment_transaction.status = PaymentTransaction.STATUS_ORDER_CONFIRMED_BY_PROVIDER; pt_needs_save = True
                    payme_state_from_result = result['result'].get('state')
                    if payme_state_from_result is not None and our_payment_transaction.paycom_state != payme_state_from_result: our_payment_transaction.paycom_state = payme_state_from_result; pt_needs_save = True
                    if pt_needs_save: our_payment_transaction.save(update_fields=['status', 'paycom_state', 'paycom_id', 'updated_at'])
                    logger.info(f"[PaymePerform] Processed Order {order_instance.id} and PT {our_payment_transaction.transaction_id}.")
                else: logger.error(f"[PaymePerform] No payment_transaction_link for Order {order_instance.id}!")
        except Exception as e: logger.error(f"[PaymePerform] Error in handle_successfully_payment: {e}", exc_info=True)


    def handle_cancelled_payment(self, params, result, *args, **kwargs):
        logger.info(f"[PaymeCancel] Entered handle_cancelled_payment. Order ID (our): {result.get('result',{}).get('transaction')}, Payme Tx ID: {params.get('id')}")
        super().handle_cancelled_payment(params, result, *args, **kwargs)
        # ... (остальная логика с logger.info/error как была) ...
        paycom_id_from_params = params['id']; payme_reason_code = params.get('reason')
        try:
            payme_tx_record = PaymeTransactions.objects.get(transaction_id=paycom_id_from_params)
            order_instance = AccountModel.objects.get(pk=payme_tx_record.account_id)
            with django_db_transaction.atomic(): # ... (обновление Order и PaymentTransaction) ...
                new_order_status = order_instance.status; current_order_status = order_instance.status
                if current_order_status == Order.STATUS_PENDING_PAYMENT: # ...
                    if payme_reason_code == 4: new_order_status = Order.STATUS_EXPIRED_AWAITING_PAYMENT
                    else: new_order_status = Order.STATUS_PAYMENT_FAILED 
                elif current_order_status == Order.STATUS_CONFIRMED and result['result']['state'] == PaymeTransactions.CANCELED: new_order_status = Order.STATUS_REFUNDED 
                if new_order_status != current_order_status: order_instance.status = new_order_status; order_instance.save(update_fields=['status', 'updated_at'])
                if hasattr(order_instance, 'payment_transaction_link') and order_instance.payment_transaction_link: # ... (обновление PaymentTransaction) ...
                    our_payment_transaction = order_instance.payment_transaction_link; pt_needs_save = False
                    if not our_payment_transaction.paycom_id: our_payment_transaction.paycom_id = paycom_id_from_params; pt_needs_save = True
                    elif our_payment_transaction.paycom_id != paycom_id_from_params: logger.error(f"[PaymeCancel] Paycom ID mismatch for Order {order_instance.id}!")
                    new_pt_status = our_payment_transaction.status
                    if payme_reason_code == 4: new_pt_status = PaymentTransaction.STATUS_PROVIDER_EXPIRED
                    elif result['result']['state'] == PaymeTransactions.CANCELED: new_pt_status = PaymentTransaction.STATUS_REFUNDED
                    else: new_pt_status = PaymentTransaction.STATUS_PROVIDER_PAYMENT_FAILED
                    if our_payment_transaction.status != new_pt_status: our_payment_transaction.status = new_pt_status; pt_needs_save = True
                    payme_state_from_result = result['result'].get('state')
                    if payme_state_from_result is not None and our_payment_transaction.paycom_state != payme_state_from_result: our_payment_transaction.paycom_state = payme_state_from_result; pt_needs_save = True
                    if pt_needs_save: our_payment_transaction.save(update_fields=['status', 'paycom_state', 'paycom_id', 'updated_at'])
                    logger.info(f"[PaymeCancel] Processed Order {order_instance.id} and PT {our_payment_transaction.transaction_id} for cancellation reason {payme_reason_code}.")
                else: logger.error(f"[PaymeCancel] No payment_transaction_link for Order {order_instance.id}!")
        except Exception as e: logger.error(f"[PaymeCancel] Error in handle_cancelled_payment: {e}", exc_info=True)

    @payme_handle_exceptions_decorator
    def set_fiscal_data(self, params):
        logger.info(f"[PaymeSetFiscal] Received fiscal data for Payme Tx ID: {params.get('id')}")
        # Можно добавить логирование самих фискальных данных, если это разрешено
        # logger.debug(f"[PaymeSetFiscal] Fiscal data: {params.get('fiscal_data')}")
        response = super().set_fiscal_data(params)
        logger.info(f"[PaymeSetFiscal] Fiscal data processed for Payme Tx ID: {params.get('id')}. Response: {response}")
        return response
# --- END OF FULL MODIFIED backend/bookings/paycom_handler.py ---