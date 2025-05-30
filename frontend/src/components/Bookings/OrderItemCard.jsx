// --- START OF FULL MODIFIED frontend/src/components/Bookings/OrderItemCard.jsx ---
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { handleImageError } from '../../utils/helpers.jsx';
import styles from './OrderItemCard.module.css';
import BookingQRCode from '../Common/BookingQRCode.jsx';

// --- ОПРЕДЕЛЯЕМ КОНСТАНТЫ ЗДЕСЬ ---
const ORDER_STATUS_PENDING_PAYMENT = 'pending_payment';
const ORDER_STATUS_CONFIRMED = 'confirmed';
const ORDER_STATUS_COMPLETED = 'completed';
const ORDER_STATUS_CANCELLED_USER = 'cancelled_user';
const ORDER_STATUS_CANCELLED_ADMIN = 'cancelled_admin';
const ORDER_STATUS_PAYMENT_FAILED = 'payment_failed';
const ORDER_STATUS_EXPIRED_AWAITING_PAYMENT = 'expired_awaiting_payment';
const ORDER_STATUS_REFUND_INITIATED = 'refund_initiated';
const ORDER_STATUS_REFUNDED = 'refunded';

const ORDER_TYPE_SLOT_BOOKING = 'slot_booking';
const ORDER_TYPE_ENTRY_FEE = 'entry_fee';
const ORDER_TYPE_SUBSCRIPTION = 'subscription';
// --- КОНЕЦ ОПРЕДЕЛЕНИЯ КОНСТАНТ ---

const OrderItemCard = ({ order }) => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;
    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    const facility = order?.facility || {};
    const placeholderFacility = '/images/placeholders/placeholder-facility.png';
    const imageUrl = facility.main_image || placeholderFacility;
    const facilityName = facility.name || t('common.unknown_facility', 'Название объекта не указано');
    const universityName = facility.university_short_name || facility.university_name || t('common.unknown_university', 'Университет неизвестен');
    const facilityId = facility.id;
    
    const orderType = order?.order_type; 
    const orderStatus = order?.status;

    const statusText = order?.status_display || (orderStatus ? t(`status.${orderStatus}`, orderStatus) : t('status.unknown', 'Неизвестно'));
    
    const getStatusClass = (statusKey) => {
        switch (statusKey) {
            case ORDER_STATUS_CONFIRMED: return styles.statusConfirmed;
            case ORDER_STATUS_PENDING_PAYMENT: return styles.statusPendingPayment;
            case ORDER_STATUS_COMPLETED: return styles.statusCompleted;
            case ORDER_STATUS_CANCELLED_USER: return styles.statusCancelled;
            case ORDER_STATUS_CANCELLED_ADMIN: return styles.statusCancelled;
            case ORDER_STATUS_PAYMENT_FAILED: return styles.statusFailed;
            case ORDER_STATUS_EXPIRED_AWAITING_PAYMENT: return styles.statusExpired;
            case ORDER_STATUS_REFUND_INITIATED: return styles.statusRefundProcessing;
            case ORDER_STATUS_REFUNDED: return styles.statusRefunded;
            default: return styles.statusDefault;
        }
    };
    const statusClassName = getStatusClass(orderStatus);

    const isPastOrProblematicForRepeat = useMemo(() => [
        ORDER_STATUS_COMPLETED, ORDER_STATUS_CANCELLED_USER, ORDER_STATUS_CANCELLED_ADMIN, 
        ORDER_STATUS_PAYMENT_FAILED, ORDER_STATUS_EXPIRED_AWAITING_PAYMENT, 
        ORDER_STATUS_REFUNDED
    ].includes(orderStatus), [orderStatus]);

    const displayDate = order?.display_date_period || '---';
    const displayTime = order?.display_time_range || '---';
    
    let typeLabel = t('common.order', 'Заказ');
    if (orderType === ORDER_TYPE_SLOT_BOOKING) {
        typeLabel = t('order_type.slot_booking', 'Бронь слотов');
    } else if (orderType === ORDER_TYPE_ENTRY_FEE) {
        typeLabel = t('order_type.entry_fee', 'Оплата за вход');
    } else if (orderType === ORDER_TYPE_SUBSCRIPTION) {
        typeLabel = t('order_type.subscription', 'Абонемент');
    }

    const orderIdentifierForUrl = order?.id || order?.order_code;

    return (
        <div className={styles.card}>
            <img
                src={imageUrl}
                alt={t('facility_card.image_alt', { name: facilityName })}
                className={styles.thumbnail}
                onError={(e) => handleImageError(e, placeholderFacility)}
                loading="lazy"
            />
            <div className={styles.info}>
                <div className={clsx(styles.statusBadge, statusClassName)}>{statusText}</div>
                <div className={styles.facilityName} title={facilityName}>{facilityName}</div>
                <div className={styles.universityName} title={universityName}>{universityName}</div>
                <div className={styles.orderTypeLabel}>{typeLabel}</div>
                
                <div className={styles.dateTime}>
                    <i className="far fa-calendar-alt"></i>
                    <span>{displayDate}</span>
                </div>
                
                {displayTime && displayTime !== '-' && (
                     <div className={styles.dateTime}>
                        <i className="far fa-clock"></i>
                        <span>{displayTime}</span>
                    </div>
                )}

                {order?.order_code && (
                    <div className={styles.bookingCodeContainer}>
                        <div className={styles.bookingCode} title={t('booking_card.code_tooltip', 'Код для проверки на входе')}>
                            {order.order_code}
                        </div>
                        {orderStatus === ORDER_STATUS_CONFIRMED && order.order_code && (
                             <BookingQRCode bookingCode={order.order_code} size={60} className={styles.qrCodeInline} />
                        )}
                    </div>
                )}
            </div>
             <div className={styles.actions}>
                 {orderStatus === ORDER_STATUS_PENDING_PAYMENT && orderIdentifierForUrl && (
                     <Link
                         to={langPath(`/payment-status/${orderIdentifierForUrl}`)}
                         className={clsx(styles.actionButton, styles.payLink)} 
                         title={t('order_item_card.proceed_to_payment_title', 'Перейти к странице оплаты')}
                     >
                         <i className="fas fa-credit-card"></i> {t('order_item_card.proceed_to_payment_button', 'Оплатить')}
                     </Link>
                 )}

                 {facilityId && (
                    <Link to={langPath(`/facilities/${facilityId}`)} className={styles.primaryLink}>
                        <i className="fas fa-info-circle"></i>
                        {t('common.object_details_button')}
                    </Link>
                 )}
                 
                 {isPastOrProblematicForRepeat && facilityId && orderType !== ORDER_TYPE_SUBSCRIPTION && order.booking_date && (
                     <Link
                         to={langPath(`/facilities/${facilityId}?date=${order.booking_date}`)}
                         className={styles.actionButton}
                         title={t('booking_card.repeat_tooltip', 'Забронировать на эту же дату снова')}
                     >
                         <i className="fas fa-redo"></i> {t('common.repeat')}
                     </Link>
                 )}
             </div>
        </div>
    );
};

export default OrderItemCard;
// --- END OF FULL MODIFIED frontend/src/components/Bookings/OrderItemCard.jsx ---