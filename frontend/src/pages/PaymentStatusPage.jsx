// --- START OF FULL MODIFIED frontend/src/pages/PaymentStatusPage.jsx ---
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } // location все еще нужен для редиректа на логин
from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query'; // queryClient не нужен здесь напрямую
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';

import { fetchOrderPaymentStatus, getPaycomCheckoutUrl } from '../services/api';
import LoadingSpinner from '../components/Common/LoadingSpinner.jsx';
import BookingQRCode from '../components/Common/BookingQRCode.jsx';
import { formatTime, formatSlotTimeRange, DOW_MAP_I18N, DOW_FALLBACK } from '../utils/helpers.jsx';
import { parseApiError } from '../utils/errorUtils.js';
import styles from './PaymentStatusPage.module.css';

const PaymentStatusPage = () => {
    const { order_identifier } = useParams();
    const navigate = useNavigate();
    const location = useLocation(); // Для state при редиректе на логин
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;
    const { isAuthenticated } = useSelector(state => state.auth);

    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const langPath = useCallback((path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`, [currentLang]);

    const { 
        data: orderDetails, // Данные теперь ТОЛЬКО отсюда
        isLoading: isLoadingOrderStatus, 
        isError: isErrorOrderStatus, 
        error: errorOrderStatus,
        // isSuccess не нужен для условного рендеринга, т.к. orderDetails будет индикатором
        // refetch: refetchOrderStatus // Оставляем, если нужен будет принудительный рефетч
    } = useQuery({
        queryKey: ['orderPaymentStatus', order_identifier],
        queryFn: () => fetchOrderPaymentStatus({ queryKey: ['orderPaymentStatus', order_identifier] }),
        enabled: !!order_identifier, // Запрос активен, если есть order_identifier
        retry: (failureCount, error) => {
            if (error?.response?.status === 401 || error?.response?.status === 403 || error?.response?.status === 404) {
                return false;
            }
            return failureCount < 2;
        },
        refetchOnWindowFocus: true, 
        refetchOnMount: true,
    });

    useEffect(() => {
        if (isErrorOrderStatus && errorOrderStatus) {
            const status = errorOrderStatus.response?.status;
            let toastMessageKey = 'errors.failed_to_load_order_status';
            let redirectPath = langPath('/dashboard');

            if (status === 401) {
                toastMessageKey = 'errors.auth_required_to_view_order';
                redirectPath = langPath('/login');
                navigate(redirectPath, { state: { from: location.pathname }, replace: true });
                toast.error(t(toastMessageKey));
                return;
            } else if (status === 404 || status === 403) {
                toastMessageKey = 'errors.order_not_found_or_forbidden';
                navigate(redirectPath, { replace: true });
                toast.error(t(toastMessageKey));
                return;
            }
            toast.error(t(toastMessageKey) + `: ${parseApiError(errorOrderStatus)}`);
        }
    }, [isErrorOrderStatus, errorOrderStatus, navigate, t, currentLang, location.pathname]);

    const getCheckoutUrlMutation = useMutation({ /* ... без изменений ... */ 
        mutationFn: () => getPaycomCheckoutUrl({ queryKey: ['getPaycomCheckoutUrl', order_identifier] }),
        onSuccess: (response) => {
            const paymeUrl = response?.data?.payme_checkout_url;
            if (paymeUrl) { window.location.href = paymeUrl; } 
            else { toast.error(t('errors.api.get_checkout_url_failed_no_url')); }
        },
        onError: (error) => { toast.error(`${t('errors.api.get_checkout_url_failed')} ${parseApiError(error)}`);}
    });

    const handlePay = () => { /* ... без изменений ... */ 
        if (!agreedToTerms) { toast.error(t('payment_status.error_agree_terms')); return; }
        if (!isAuthenticated) { toast.error(t('facility_detail.login_to_book_toast')); navigate(langPath('/login'), { state: { from: location }, replace: true }); return; }
        getCheckoutUrlMutation.mutate();
    };

    const displayData = useMemo(() => {
        const source = orderDetails; // Теперь источник данных ТОЛЬКО orderDetails
        if (!source) return null;

        const orderType = source.order_type;
        const facilityData = source.facility || {};
        const totalPrice = source.total_price;

        let summary = {
            orderCode: source.order_code,
            facilityName: facilityData.name || t('common.unknown_facility'),
            universityName: facilityData.university_short_name || facilityData.university_name || t('common.unknown_university'),
            totalPriceDisplay: `${Number(totalPrice || 0).toLocaleString()} ${t('common.currency')}`,
            statusDisplay: source.status_display || (source.status ? t(`status.${source.status}`, source.status) : ''),
            qrCodeValue: source.status === 'confirmed' ? source.order_code : null,
            details: []
        };

        if (orderType === 'entry_fee') {
            summary.typeDisplay = t('order_type.entry_fee');
            summary.details.push({ labelKey: 'payment_status.summary.date', value: dayjs(source.booking_date).locale(currentLang).format('D MMMM YYYY') });
            if (facilityData.open_time && facilityData.close_time) {
                 summary.details.push({ labelKey: 'payment_status.summary.access_time', value: `${formatTime(facilityData.open_time)} - ${formatTime(facilityData.close_time)}` });
            }
        } else if (orderType === 'slot_booking') {
            summary.typeDisplay = t('order_type.slot_booking');
            summary.details.push({ labelKey: 'payment_status.summary.date', value: dayjs(source.booking_date).locale(currentLang).format('D MMMM YYYY') });
            // Используем display_time_range из orderDetails, если он есть, или форматируем слоты
            const timeValue = source.display_time_range && source.display_time_range !== '-' 
                ? source.display_time_range 
                : (source.slots && source.slots.length > 0 ? source.slots.map(s => `${s.start_time}-${s.end_time}`).join(', ') : '-');
            summary.details.push({ labelKey: 'payment_status.summary.time', value: timeValue });
            if (source.slots?.length) {
                 summary.details.push({ labelKey: 'payment_status.summary.hours', value: source.slots.length });
            }
        } else if (orderType === 'subscription') {
            summary.typeDisplay = t('order_type.subscription');
            // Используем display_date_period и display_time_range из orderDetails
            summary.details.push({ labelKey: 'payment_status.summary.period', value: source.display_date_period || '-' });
            summary.details.push({ labelKey: 'payment_status.summary.days_and_times', value: source.display_time_range || '-' }); // Объединяем дни и время для подписки
        }
        return summary;
    }, [orderDetails, t, currentLang]);

    // --- Рендеринг ---
    if (isLoadingOrderStatus) { // Показываем лоадер, пока грузятся orderDetails
        return <div className={styles.pageContainer}><LoadingSpinner text={t('common.loading_order_status', 'Загрузка статуса заказа...')} /></div>;
    }

    // Ошибка уже обработана в useEffect (редирект или toast), но если хотим показать что-то на странице:
    if (isErrorOrderStatus || !orderDetails) { 
        return (
            <div className={styles.pageContainer}>
                <div className={styles.card}>
                    <div className={clsx(styles.statusIcon, styles.iconError)}><i className="fas fa-times-circle"></i></div>
                    <h2 className={styles.mainTitle}>{t('common.error', 'Ошибка')}</h2>
                    <p className={styles.message}>{t('errors.order_not_found_or_failed_load', 'Не удалось загрузить информацию о заказе или заказ не найден.')}</p>
                    <Link to={langPath('/dashboard')} className={clsx(styles.button, styles.buttonPrimary)}>
                        {t('dashboard.menu_dashboard', 'В личный кабинет')}
                    </Link>
                </div>
            </div>
        );
    }
    
    // Теперь displayData формируется только из orderDetails
    if (!displayData) { // Дополнительная проверка, если displayData не сформировался
        return <div className={styles.pageContainer}><p>{t('errors.order_not_found_or_failed_load')}</p></div>;
    }
    
    const currentStatus = orderDetails.status;

    return (
        // ... (JSX для отображения страницы остается почти таким же, как в предыдущем полном файле PaymentStatusPage)
        // Главное, что `displayData` теперь всегда берется из `orderDetails` (ответа API)
        // и нет логики, связанной с `initialOrderDataForReview`.
        // ...
        // Пример использования displayData:
        // <h2 className={styles.mainTitle}>{t(`payment_status.title_${currentStatus}`, `Статус: ${currentStatus}`)}</h2>
        // <p><strong>{t('payment_status.summary.facility')}:</strong> {displayData.facilityName}</p>
        // ... и так далее ...
        <div className={styles.pageContainer}>
            <div className={styles.card}>
                {currentStatus === 'confirmed' && (
                    <><div className={clsx(styles.statusIcon, styles.iconSuccess)}><i className="fas fa-check-circle"></i></div><h2 className={styles.mainTitle}>{t('payment_status.title_success', 'Заказ успешно оплачен!')}</h2></>
                )}
                {currentStatus === 'pending_payment' && (
                    <h2 className={styles.mainTitle}>{t('payment_status.title_pending', 'Подтверждение и оплата заказа')}</h2>
                )}
                {(currentStatus === 'payment_failed' || currentStatus === 'cancelled_admin' || currentStatus === 'expired_awaiting_payment') && (
                     <><div className={clsx(styles.statusIcon, styles.iconError)}><i className="fas fa-exclamation-circle"></i></div><h2 className={styles.mainTitle}>{t('payment_status.title_failed', 'Проблема с оплатой')}</h2></>
                )}

                <div className={styles.summarySection}>
                    <h3 className={styles.summaryTitle}>{t('payment_status.summary.section_title', 'Детали заказа')}: {displayData.orderCode}</h3>
                    <div className={styles.summaryGrid}>
                        <p><strong>{t('payment_status.summary.type', 'Тип')}:</strong> {displayData.typeDisplay}</p>
                        <p><strong>{t('payment_status.summary.facility', 'Объект')}:</strong> {displayData.facilityName} ({displayData.universityName})</p>
                        {displayData.details.map(detail => (
                            <p key={detail.labelKey}><strong>{t(detail.labelKey)}:</strong> {detail.value}</p>
                        ))}
                        <p className={styles.totalPrice}><strong>{t('payment_status.summary.total_amount', 'Итого')}:</strong> {displayData.totalPriceDisplay}</p>
                    </div>
                </div>

                {currentStatus === 'pending_payment' && (
                    <div className={styles.pendingActions}>
                        <div className={styles.termsCheckbox}>
                            <input type="checkbox" id="termsAgreement" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                            <label htmlFor="termsAgreement">
                                {t('payment_status.agree_terms_part1', 'Я подтверждаю, что соглашаюсь с ')}
                                <Link to={langPath('/info/terms')} target="_blank" rel="noopener noreferrer" className={styles.termsLink}>
                                    {t('payment_status.agree_terms_link', 'условиями использования сайта')}
                                </Link>.
                            </label>
                        </div>
                        <button 
                            className={clsx(styles.button, styles.buttonPay)} 
                            onClick={handlePay} 
                            disabled={!agreedToTerms || getCheckoutUrlMutation.isLoading || isLoadingOrderStatus}
                        >
                            {getCheckoutUrlMutation.isLoading ? <LoadingSpinner size="1em" color="#fff" text="" display="inline"/> : <i className="fas fa-credit-card"></i>}
                            {getCheckoutUrlMutation.isLoading ? t('common.processing') : t('payment_status.pay_button', 'Оплатить через Payme')}
                        </button>
                    </div>
                )}
                {currentStatus === 'confirmed' && displayData.qrCodeValue && (
                    <div className={styles.qrSection}>
                        <h4>{t('booking_confirmation.qr_code_title')}</h4>
                        <BookingQRCode bookingCode={displayData.qrCodeValue} size={180} />
                        <p className={styles.qrHint}>{t('booking_confirmation.qr_code_hint')}</p>
                    </div>
                )}
                {(currentStatus === 'payment_failed' || currentStatus === 'cancelled_admin' || currentStatus === 'expired_awaiting_payment') && (
                    <div className={styles.failedActions}>
                        <p className={styles.message}>{t('payment_status.message_failed_status', 'Статус вашего заказа: {{status}}.', { status: displayData.statusDisplay || t('status.unknown') })}</p>
                        {orderDetails?.status === 'pending_payment' &&
                            <button className={clsx(styles.button, styles.buttonRetry)} onClick={handlePay} disabled={getCheckoutUrlMutation.isLoading}>
                                <i className="fas fa-redo"></i> {t('payment_status.retry_button', 'Попробовать оплатить снова')}
                            </button>
                        }
                        <Link to={langPath('/facilities')} className={clsx(styles.button, styles.buttonOutline)}>
                            <i className="fas fa-th-list"></i> {t('payment_status.back_to_catalog_button', 'Вернуться в каталог')}
                        </Link>
                    </div>
                )}
                {currentStatus === 'confirmed' && (
                     <div className={styles.successActions}>
                        <Link to={langPath('/dashboard/active-orders')} className={clsx(styles.button, styles.buttonPrimary)}>
                            <i className="fas fa-tasks"></i> {t('booking_confirmation.action_my_bookings')}
                        </Link>
                        <Link to={langPath('/')} className={clsx(styles.button, styles.buttonOutline)}>
                            <i className="fas fa-home"></i> {t('booking_confirmation.action_back_home')}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentStatusPage;
// --- END OF FULL MODIFIED frontend/src/pages/PaymentStatusPage.jsx ---