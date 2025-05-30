import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/uz-latn';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { handleImageError } from '../../utils/helpers.jsx'; // formatSlotTimeRange убран, т.к. display_subscription_time приходит из API
import styles from './SubscriptionCard.module.css';

const weekdaysMap = { 0: "Пн", 1: "Вт", 2: "Ср", 3: "Чт", 4: "Пт", 5: "Сб", 6: "Вс" };
const dayOrder = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const SubscriptionCard = ({ subscription }) => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;

    const facility = subscription?.facility || {};
    const placeholderFacility = '/images/placeholders/placeholder-facility.png';
    const imageUrl = facility.main_image || placeholderFacility;
    const facilityName = facility.name || t('common.unknown_facility');
    // --- ИЗМЕНЕНИЕ: Используем university_short_name или university_name ---
    const universityName = facility.university_short_name || facility.university_name || t('common.unknown_university');
    // --- КОНЕЦ ИЗМЕНЕНИЯ ---
    const facilityId = facility.id;

    const statusText = useMemo(() => {
        const statusKey = `status.${subscription?.status || 'unknown'}`;
        const defaultText = subscription?.status?.replace('_', ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || t('status.unknown');
        return t(statusKey, defaultText);
    }, [subscription?.status, t]);

    const getStatusClass = (status) => {
        switch (status) {
            case 'active': return styles.statusActive;
            case 'pending_payment': return styles.statusPendingPayment;
            case 'expired': return styles.statusExpired;
            case 'cancelled': return styles.statusCancelled;
            default: return styles.statusDefault;
        }
    };
    const statusClassName = getStatusClass(subscription?.status);

    // --- ИЗМЕНЕНИЕ: Используем days_of_week_display из API ---
    const displayDays = subscription?.days_of_week_display || '-';
    // --- КОНЕЦ ИЗМЕНЕНИЯ ---

    // --- ИЗМЕНЕНИЕ: Используем display_subscription_time из API ---
    const displayTimes = subscription?.display_subscription_time || '-';
    // --- КОНЕЦ ИЗМЕНЕНИЯ ---

    // Даты теперь приходят в ISO формате, dayjs их поймет
    const displayStartDate = subscription?.start_date ? dayjs(subscription.start_date).locale(currentLang).format("D MMMM YYYY") : '?';
    const displayEndDate = subscription?.end_date ? dayjs(subscription.end_date).locale(currentLang).format("D MMMM YYYY") : '?';

    const handleRenew = () => alert(t('subscriptions.renew_alert', { id: subscription?.subscription_code || subscription?.id }));
    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;
    const paymentTransactionId = subscription?.payment_transaction_id;

    return (
        <div className={styles.card}>
            <img
                src={imageUrl}
                alt={t('facility_card.image_alt', { name: facilityName })}
                className={styles.thumbnail}
                onError={(e) => handleImageError(e, placeholderFacility)}
            />
            <div className={styles.info}>
                <div className={clsx(styles.statusBadge, statusClassName)}>{statusText}</div>
                 <div className={styles.facilityName}>{facilityName}</div>
                 <div className={styles.universityName}>{universityName}</div> {/* Теперь должно работать */}
                 <div className={styles.detail}> <i className={clsx("far fa-calendar-alt", styles.detailIcon)}></i> <span>{displayStartDate} - {displayEndDate}</span> </div>
                 <div className={styles.detail}> <i className={clsx("fas fa-calendar-day", styles.detailIcon)}></i> <span>{t('subscriptions.card_days_label')} {displayDays}</span> </div>
                 <div className={styles.detail}> <i className={clsx("far fa-clock", styles.detailIcon)}></i> <span>{t('subscriptions.card_time_label')} {displayTimes}</span> </div>
                 <div className={styles.detail}> <i className={clsx("fas fa-tags", styles.detailIcon)}></i> <span>{t('subscriptions.card_price_label')} <span className={styles.price}>{subscription?.total_price?.toLocaleString() || '0'} {t('common.currency')}</span></span> </div>
                 {subscription?.subscription_code && (
                     <div className={clsx(styles.detail)} style={{ marginTop: '0.5rem' }}>
                         <i className={clsx("fas fa-barcode", styles.detailIcon)}></i>
                         <span>{t('subscriptions.card_code_label')} <span className={styles.subscriptionCode}>{subscription.subscription_code}</span></span>
                     </div>
                 )}
            </div>
             <div className={styles.actions}>
                 {subscription?.status === 'pending_payment' && paymentTransactionId && (
                     <Link to={langPath(`/intermediate-checkout/subscription`)} state={{ transactionId: paymentTransactionId, itemDetails: subscription }} className={styles.payLink} title={t('subscriptions.pay_button_title')} >
                         <i className="fas fa-credit-card"></i> {t('subscriptions.pay_button')}
                     </Link>
                 )}
                 {subscription?.status === 'pending_payment' && !paymentTransactionId && ( <span className={styles.errorText}>{t('subscriptions.error_no_transaction')}</span> )}
                 {(subscription?.status === 'active' || subscription?.status === 'expired') && ( <button className={styles.renewButton} onClick={handleRenew}> <i className="fas fa-sync-alt"></i> {t('subscriptions.renew_button')} </button> )}
                 <Link to={langPath(`/facilities/${facilityId || '#'}`)} className={styles.actionButton}> <i className="fas fa-info-circle"></i> {t('common.object_details_button', 'Объект')} </Link>
             </div>
        </div>
    );
};

export default SubscriptionCard;