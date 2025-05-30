// src/pages/BookingConfirmation.jsx
// --- START OF FULL FILE frontend/src/pages/BookingConfirmation.jsx ---
import React, { useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx'; // Добавили clsx

import { fetchBookingDetailsBySession } from '../services/api';
import LoadingSpinner from '../components/Common/LoadingSpinner';
// handleImageError и formatTime/formatSlotTimeRange не нужны напрямую, если display_* поля используются
import styles from './BookingConfirmation.module.css';
import BookingQRCode from '../components/Common/BookingQRCode';
// --- НОВОЕ: Импорт стилей для печати ---
import './BookingConfirmationPrint.css';
// ------------------------------------

const BookingConfirmation = () => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();

    const sessionId = searchParams.get('session_id');
    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    const {
        data: confirmedOrder,
        isLoading,
        isError,
        error,
        isSuccess,
    } = useQuery({
        queryKey: ['orderDetailsBySession', sessionId],
        queryFn: () => fetchBookingDetailsBySession({ queryKey: ['orderDetailsBySession', sessionId] }),
        enabled: !!sessionId,
        staleTime: 0,
        cacheTime: 1 * 60 * 1000,
        retry: (failureCount, errorParam) => {
            if (errorParam?.response?.status === 404) return false;
            if (errorParam?.response?.status === 202 && failureCount < 10) return true;
            return failureCount < 2;
        },
        refetchInterval: (query) => {
            const queryState = query.state;
            if (queryState.error?.response?.status === 202) {
                return 2500;
            }
            return false;
        },
        refetchOnWindowFocus: false,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myUnifiedOrders'] });
            queryClient.invalidateQueries({ queryKey: ['mySubscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['userDashboardStats'] });
        }
    });

    const orderType = confirmedOrder?.order_type;

    const displayData = useMemo(() => {
        if (!confirmedOrder || !orderType || orderType === 'unknown') return null;

        let details = {
            titleKey: 'booking_confirmation.success_title_booking',
            messageKey: 'booking_confirmation.success_message_booking',
            detailsTitleKey: 'booking_confirmation.details_title_booking',
            codeLabelKey: 'booking_confirmation.details_code_booking',
            orderCode: confirmedOrder.order_code,
            facilityName: confirmedOrder.facility?.name || t('common.unknown_facility'),
            universityDisplayName: confirmedOrder.facility?.university_short_name || confirmedOrder.facility?.university_name || t('common.unknown_university'),
            facilityTypeDisplay: confirmedOrder.facility?.facility_type
                ? t(`facility_type.${confirmedOrder.facility.facility_type}`, confirmedOrder.facility.facility_type)
                : '',
            mainDateLabelKey: 'booking_confirmation.details_date',
            formattedMainDate: confirmedOrder.display_date_period || '-',
            timeLabelKey: 'booking_confirmation.details_time',
            formattedTime: confirmedOrder.display_time_range || '-',
            totalPrice: confirmedOrder.total_price,
            statusDisplay: confirmedOrder.status_display,
            specificDetails: []
        };

        if (orderType === 'slot_booking') {
            if (confirmedOrder.slots && Array.isArray(confirmedOrder.slots)) {
                 details.specificDetails.push({
                     labelKey: 'booking_confirmation.details_hours',
                     value: confirmedOrder.slots.length
                 });
            }
            if (confirmedOrder.facility?.price_per_hour) {
                 details.specificDetails.push({
                     labelKey: 'booking_confirmation.details_price_per_hour',
                     value: `${Number(confirmedOrder.facility.price_per_hour).toLocaleString()} ${t('common.currency')}`
                 });
            }
        } else if (orderType === 'entry_fee') {
            details.timeLabelKey = 'booking_confirmation.details_access_time';
            if (confirmedOrder.facility?.price_per_hour) {
                 details.specificDetails.push({
                     labelKey: 'booking_confirmation.details_price_per_entry',
                     value: `${Number(confirmedOrder.facility.price_per_hour).toLocaleString()} ${t('common.currency')}`
                 });
            }
        } else if (orderType === 'subscription') {
            details.titleKey = 'booking_confirmation.success_title_subscription';
            details.messageKey = 'booking_confirmation.success_message_subscription';
            details.detailsTitleKey = 'booking_confirmation.details_title_subscription';
            details.codeLabelKey = 'booking_confirmation.details_code_subscription';
            details.mainDateLabelKey = 'booking_confirmation.details_period_subscription';
            details.timeLabelKey = null;
            details.formattedTime = null;
            details.specificDetails.push({
                labelKey: 'booking_confirmation.details_days_subscription',
                value: confirmedOrder.subscription_days_display || '-'
            });
            details.specificDetails.push({
                labelKey: 'booking_confirmation.details_times_subscription',
                value: confirmedOrder.subscription_times_display || '-'
            });
        }
        return details;
    }, [confirmedOrder, orderType, t, currentLang]);

    // --- НОВОЕ: Функция для печати ---
    const handlePrint = () => {
        window.print();
    };
    // --------------------------------

    if (!sessionId) { return ( <div className={styles.container}><div className={styles.cardError}><h2>{t('common.error')}</h2><p>{t('booking_confirmation.error_missing_session')}</p><Link to={langPath('/dashboard')} className={styles.buttonPrimary}>{t('dashboard.menu_dashboard')}</Link></div></div> ); }
    if (isLoading) { return ( <div className={styles.container}><div className={styles.cardLoading}><LoadingSpinner text={t('booking_confirmation.loading_details', 'Загрузка деталей заказа...')}/></div></div> ); }
    if (isError) {
        let errorMessage = t('booking_confirmation.error_no_details');
        if (error?.response?.status === 404) errorMessage = t('booking_confirmation.error_transaction_not_found');
        else if (error?.response?.status === 202) return ( <div className={styles.container}><div className={styles.cardLoading}><LoadingSpinner text={t('booking_confirmation.processing_order', 'Ваш заказ еще обрабатывается...')}/></div></div> );
        else errorMessage = error?.response?.data?.detail || error?.message || errorMessage;
        return ( <div className={styles.container}><div className={styles.cardError}><h2>{t('common.error')}</h2><p>{errorMessage}</p><Link to={langPath('/dashboard')} className={styles.buttonPrimary}>{t('booking_confirmation.error_link_my_bookings', 'Мои заказы')}</Link></div></div> );
    }
    if (isSuccess && !confirmedOrder) { return ( <div className={styles.container}><div className={styles.cardError}><h2>{t('common.error')}</h2><p>{t('booking_confirmation.error_no_details')}</p><Link to={langPath('/dashboard')} className={styles.buttonPrimary}>{t('dashboard.menu_dashboard')}</Link></div></div> ); }
    if (!displayData) { return ( <div className={styles.container}><div className={styles.cardError}><h2>{t('common.error')}</h2><p>{t('booking_confirmation.error_unknown_type')}</p></div></div> ); }

    return (
        <div className={styles.pageWrapper}> {/* Обертка для print стилей */}
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.confirmationIcon}> <i className="fas fa-check"></i> </div>
                    <h2 className={styles.title}>{t(displayData.titleKey)}</h2>
                    <p className={styles.message}>{t(displayData.messageKey)}</p>

                    <div className={styles.detailsCard} id="booking-confirmation-details">
                        <h3 className={styles.sectionTitle}>{t(displayData.detailsTitleKey)}</h3>
                        <div className={styles.detailList}>
                            <div className={styles.detailItem}> <span className={styles.detailLabel}>{t(displayData.codeLabelKey)}</span> <span className={styles.detailValueBookingCode}>{displayData.orderCode || t('common.not_available')}</span> </div>
                            <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('booking_confirmation.details_object')}</span> <span className={styles.detailValue}>{displayData.facilityName}</span> </div>
                            {displayData.facilityTypeDisplay && <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('facility_detail.info.booking_type')}</span> <span className={styles.detailValue}>{displayData.facilityTypeDisplay}</span> </div>}
                            <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('booking_confirmation.details_university')}</span> <span className={styles.detailValue}>{displayData.universityDisplayName}</span> </div>
                            <div className={styles.detailItem}> <span className={styles.detailLabel}>{t(displayData.mainDateLabelKey)}</span> <span className={styles.detailValue}>{displayData.formattedMainDate}</span> </div>
                            {displayData.timeLabelKey && displayData.formattedTime && ( <div className={styles.detailItem}> <span className={styles.detailLabel}>{t(displayData.timeLabelKey)}</span> <span className={styles.detailValue}>{displayData.formattedTime}</span> </div> )}
                            {displayData.specificDetails.map(detail => ( <div key={detail.labelKey} className={styles.detailItem}> <span className={styles.detailLabel}>{t(detail.labelKey)}</span> <span className={styles.detailValue}>{detail.value}</span> </div> ))}
                            <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('booking_confirmation.details_payment_status')}</span> <span className={styles.statusSuccess}>{displayData.statusDisplay}</span> </div>
                            <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('booking_confirmation.details_total_amount')}</span> <span className={styles.totalAmountValue}>{Number(displayData.totalPrice || 0).toLocaleString()} {t('common.currency')}</span> </div>
                        </div>
                        {displayData.orderCode && (
                            <div className={styles.qrCodeSection}>
                                <h4>{t('booking_confirmation.qr_code_title')}</h4>
                                <BookingQRCode bookingCode={displayData.orderCode} size={180} />
                                <p className={styles.qrCodeHint}>{t('booking_confirmation.qr_code_hint')}</p>
                            </div>
                        )}
                    </div>

                    {/* --- ИЗМЕНЕНИЕ: Добавляем кнопку печати --- */}
                    <div className={clsx(styles.actions, styles.printButtonContainer)}> {/* Добавляем класс для print стилей */}
                        <button onClick={handlePrint} className={clsx(styles.button, styles.buttonSecondary, styles.printAction)}>
                            <i className="fas fa-print"></i> {t('booking_confirmation.action_print_save', 'Распечатать / Сохранить PDF')}
                        </button>
                    </div>
                    {/* ----------------------------------------- */}

                    <div className={styles.actions}>
                        <Link to={langPath('/dashboard/active-orders')} className={styles.buttonPrimary}> <i className="fas fa-calendar-alt"></i> {t('booking_confirmation.action_my_bookings', 'Мои заказы')} </Link>
                        <Link to={langPath('/')} className={styles.buttonOutline}> <i className="fas fa-home"></i> {t('booking_confirmation.action_back_home')} </Link>
                        {confirmedOrder?.facility?.id && ( <Link to={langPath(`/facilities/${confirmedOrder.facility.id}`)} className={styles.buttonOutline}> <i className="fas fa-info-circle"></i> {t('booking_confirmation.action_view_object')} </Link> )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BookingConfirmation;
// --- END OF FULL FILE ---