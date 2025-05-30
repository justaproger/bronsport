// --- START OF FULL FILE frontend/src/pages/IntermediateCheckoutPage.jsx ---
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query'; // Убрали useQuery
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/uz-latn';
import duration from 'dayjs/plugin/duration';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
// --- НОВОЕ: Импорт Stripe ---
import { loadStripe } from '@stripe/stripe-js';

// --- ИЗМЕНЕНИЕ: Импортируем createCheckoutSession ---
import { createCheckoutSession } from '../services/api';
// import { fetchPaymentStatus, simulateWebhook } from '../services/api'; // <-- Удаляем старые
// ----------------------------------------------------
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { formatTime, formatSlotTimeRange, handleImageError } from '../utils/helpers';
// --- ИЗМЕНЕНИЕ: Импортируем новые стили ---
import styles from './IntermediateCheckoutPage.module.css'; // <-- Обновляем путь к стилям
// -----------------------------------------

dayjs.extend(duration);

// --- НОВОЕ: Загрузка Stripe ---
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'your_default_pk_test_key');
// ---------------------------

const weekdaysMap = { 0: "Пн", 1: "Вт", 2: "Ср", 3: "Чт", 4: "Пт", 5: "Сб", 6: "Вс" };
const dayOrder = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const formatDaysOfWeek = (daysList = [], t) => {
    if (!daysList || !Array.isArray(daysList) || daysList.length === 0) return '-';
    try {
        const numericDays = daysList.map(d => Number(d)).filter(d => !isNaN(d));
        return numericDays.map(d => t(`weekdays.${weekdaysMap[d]?.toLowerCase()}`, weekdaysMap[d] || '?')).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)).join(', ') || '-';
    } catch (e) { console.error("Error formatting days:", daysList, e); return daysList.join(', '); }
};

// --- ИЗМЕНЕНИЕ: Убираем компонент таймера или делаем его визуальным ---
// const CountdownTimer = React.memo(({ expiryTimestamp, onExpire }) => { ... });
// Можно оставить таймер просто для отображения времени, но без onExpire
const VisualCountdownTimer = React.memo(({ expiryTimestamp }) => {
    const calculateTimeLeft = useCallback(() => { const now = dayjs(); const expiry = dayjs(expiryTimestamp); if (!expiry.isValid() || expiry.isBefore(now)) return null; return dayjs.duration(expiry.diff(now)); }, [expiryTimestamp]);
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
    useEffect(() => {
        if (!dayjs(expiryTimestamp).isValid()) { setTimeLeft(null); return; }
        const timerId = setInterval(() => { const newTimeLeft = calculateTimeLeft(); setTimeLeft(newTimeLeft); if (!newTimeLeft) clearInterval(timerId); }, 1000);
        return () => clearInterval(timerId);
    }, [expiryTimestamp, calculateTimeLeft]);
    if (!timeLeft || timeLeft.asSeconds() <= 0) return <span>00:00</span>; // Показываем 00:00 если время вышло
    const minutes = String(timeLeft.minutes()).padStart(2, '0'); const seconds = String(timeLeft.seconds()).padStart(2, '0');
    return <span>{minutes}:{seconds}</span>;
});
// -------------------------------------------------------------------

// --- УДАЛЕНО: Функция getStatusBoxColors не нужна, статус всегда "Ожидание" ---
// const getStatusBoxColors = (status) => { ... };
// -------------------------------------------------------------------------

const IntermediateCheckoutPage = () => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { type } = useParams(); // 'booking' или 'subscription'
    // --- ИЗМЕНЕНИЕ: Получаем transactionId и itemDetails ---
    // transactionId больше не нужен для опроса, но может быть полезен для отображения
    const { transactionId, itemDetails } = location.state || {};
    // ------------------------------------------------------

    // --- ИЗМЕНЕНИЕ: Убираем состояния, связанные с поллингом ---
    // const [currentStatus, setCurrentStatus] = useState('pending');
    // const [pollingEnabled, setPollingEnabled] = useState(true);
    // const [finalMessage, setFinalMessage] = useState({ type: '', text: '' });
    const [initiationError, setInitiationError] = useState(''); // Оставляем для ошибок создания сессии
    // ---------------------------------------------------------

    const bookingType = useMemo(() => itemDetails?.booking_type, [itemDetails]);

    // --- ИЗМЕНЕНИЕ: Убираем логику определения времени истечения для таймера ---
    // const expiryRef = useRef( ... );
    // Вместо этого можно просто показать примерное время (например, 15 минут от загрузки)
    const visualExpiryTime = useMemo(() => dayjs().add(15, 'minutes'), []);
    // -----------------------------------------------------------------------

    // --- ИЗМЕНЕНИЕ: Убираем useQuery для опроса статуса ---
    // const { error: statusError, isFetching: isPolling } = useQuery({ ... });
    // -----------------------------------------------------

    // Проверка данных при монтировании (без изменений)
    useEffect(() => {
        if (!type || !itemDetails) { // Убрали проверку transactionId, т.к. он необязателен для Stripe Checkout
            console.error("IntermediateCheckoutPage: Missing data.", { type, itemDetails });
            navigate(langPath('/dashboard'), { replace: true, state: { error: t('errors.missing_payment_data') } });
        }
    }, [type, itemDetails, navigate, t, currentLang]); // Добавили currentLang

    // --- ИЗМЕНЕНИЕ: Убираем колбэк handleExpire ---
    // const handleExpire = useCallback(() => { ... }, [currentStatus, t]);
    // -------------------------------------------

    // --- ИЗМЕНЕНИЕ: Мутация для создания сессии Stripe ---
    const createSessionMutation = useMutation({
        mutationFn: createCheckoutSession,
        onMutate: () => { setInitiationError(''); },
        onSuccess: async (response) => {
            const sessionId = response?.data?.sessionId;
            if (sessionId) {
                const stripe = await stripePromise;
                if (!stripe) {
                     setInitiationError(t('errors.stripe.load_error')); return;
                }
                const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
                if (stripeError) {
                    setInitiationError(t('errors.stripe.redirect_error') + stripeError.message);
                }
            } else {
                setInitiationError(t('errors.api.session_id_missing'));
            }
        },
        onError: (error) => {
            const errorData = error.response?.data;
            const specificError = errorData?.error || errorData?.detail || (typeof errorData === 'object' ? JSON.stringify(errorData) : error.message);
            const fallbackMsg = type === 'subscription'
                ? t('errors.initiate_payment.generic_fail_sub')
                : t('errors.initiate_payment.generic_fail');
            let displayError = specificError || fallbackMsg;
            if (typeof specificError === 'string') {
                if (specificError.toLowerCase().includes('конфликт') || specificError.toLowerCase().includes('conflict')) {
                    displayError = t('errors.initiate_payment.conflict');
                } else {
                    displayError = t(`errors.api.${specificError.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`, specificError);
                }
            }
            setInitiationError(`${t('common.error_prefix')}: ${displayError}`);
        }
    });
    // ------------------------------------------------------

    // --- ИЗМЕНЕНИЕ: Обработчик кнопки "Оплатить через Stripe" ---
    const handleProceedToStripe = useCallback(() => {
        if (!itemDetails || !itemDetails.facility?.id) {
            setInitiationError(t('errors.missing_payment_data'));
            return;
        }
        setInitiationError('');

        // Формируем данные для API
        const dataToSend = {
            item_type: type, // 'booking' или 'subscription'
            facility_id: itemDetails.facility.id,
            // Передаем параметры, которые были в itemDetails
            ...(type === 'booking' && {
                date: itemDetails.date,
                slots: itemDetails.booking_type !== 'entry_fee' ? itemDetails.slots : undefined, // Слоты только если не entry_fee
            }),
            ...(type === 'subscription' && {
                start_date: itemDetails.start_date,
                months: itemDetails.months,
                days_of_week: itemDetails.days_of_week,
                start_times: itemDetails.start_times,
            }),
        };
        // Удаляем undefined поля
        Object.keys(dataToSend).forEach(key => dataToSend[key] === undefined && delete dataToSend[key]);

        createSessionMutation.mutate(dataToSend);
    }, [itemDetails, type, createSessionMutation, t]);
    // ---------------------------------------------------------

    // --- ИЗМЕНЕНИЕ: Убираем getStatusTextAndClass и statusBoxStyle ---
    // const getStatusTextAndClass = useCallback((status) => { ... }, [t]);
    // const { text: statusText, className: statusBadgeClassName } = useMemo(...);
    // const statusBoxStyle = useMemo(...);
    // Вместо этого используем фиксированный статус "Ожидание платежа"
    const statusText = t('status.payment_pending');
    const statusBadgeClassName = styles.statusPending; // Используем стиль для pending
    const statusBoxStyle = { borderColor: '#ffecb3', backgroundColor: '#fff8e1', color: '#ffa000' }; // Стиль для pending
    // -------------------------------------------------------------

    // Хелпер для пути (без изменений)
    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    // --- Рендеринг Деталей Заказа (без изменений в логике отображения, только убрали finalMessage) ---
    let displayDetails = null;
    const itemCode = transactionId ? transactionId.toString().split('-')[0].toUpperCase() : (itemDetails?.id || 'N/A');

    if (itemDetails) {
        if (type === 'subscription') {
            const formattedDays = formatDaysOfWeek(itemDetails.days_of_week, t);
            const formattedTimes = itemDetails.start_times?.map(formatSlotTimeRange).join(', ') || '-';
            const endDate = itemDetails.end_date || dayjs(itemDetails.start_date).add(itemDetails.months, 'month').subtract(1, 'day').format('YYYY-MM-DD');
            displayDetails = ( <> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.type')}</span> <span className={styles.detailValue}>{t('common.subscription')}</span> </div> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.object')}</span> <span className={styles.detailValue}>{itemDetails.facility?.name || 'N/A'}</span> </div> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.period')}</span> <span className={styles.detailValue}>{dayjs(itemDetails.start_date).format('DD.MM.YYYY')} - {dayjs(endDate).format('DD.MM.YYYY')}</span> </div> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.days')}</span> <span className={styles.detailValue}>{formattedDays}</span> </div> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.time')}</span> <span className={styles.detailValue}>{formattedTimes}</span> </div> </> );
        } else if (type === 'booking') {
            if (bookingType === 'entry_fee') {
                displayDetails = ( <> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.type')}</span> <span className={styles.detailValue}>{t('common.entry_fee')}</span> </div> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.object')}</span> <span className={styles.detailValue}>{itemDetails.facility?.name || 'N/A'}</span> </div> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.date')}</span> <span className={styles.detailValue}>{dayjs(itemDetails.date).format('D MMMM YYYY')}</span> </div> </> );
            } else {
                const formattedTimes = itemDetails.slots?.map(formatSlotTimeRange).join(', ') || '-';
                displayDetails = ( <> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.type')}</span> <span className={styles.detailValue}>{t('common.booking')}</span> </div> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.object')}</span> <span className={styles.detailValue}>{itemDetails.facility?.name || 'N/A'}</span> </div> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.date')}</span> <span className={styles.detailValue}>{dayjs(itemDetails.date).format('D MMMM YYYY')}</span> </div> <div className={styles.detailItem}> <span className={styles.detailLabel}>{t('confirm_payment.details.time')}</span> <span className={styles.detailValue}>{formattedTimes}</span> </div> </> );
            }
        }
    }

    // Если начальные данные не пришли
    if (!itemDetails) { return <div className={styles.container}><LoadingSpinner text={t('common.loading')}/></div>; }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                {/* Header */}
                <div className={styles.header}>
                     {/* --- ИЗМЕНЕНИЕ: Используем ID транзакции, если он есть, иначе ID объекта --- */}
                     <h2 className={styles.title}>{t('confirm_payment.order_title', { code: itemCode })}</h2>
                     {/* -------------------------------------------------------------------- */}
                     <span className={statusBadgeClassName} style={statusBoxStyle}>{statusText}</span>
                </div>

                {/* Body */}
                <div className={clsx(styles.body, styles.mobileBody)}>
                    {/* Left: Details & Status */}
                    <div className={styles.detailsContainer}>
                        <h3>{t('confirm_payment.details.section_title')}</h3>
                        {displayDetails}
                         {/* --- ИЗМЕНЕНИЕ: Убираем finalMessage --- */}
                         {/* {finalMessage.text && ( ... ) } */}
                         {/* ------------------------------------ */}
                         {/* --- ИЗМЕНЕНИЕ: Отображаем статус и таймер всегда (пока не оплачено) --- */}
                         <div className={styles.statusBox} style={statusBoxStyle}>
                             <span className={styles.statusBoxText} style={{ color: statusBoxStyle.color }}>
                                 <i className="fas fa-hourglass-half"></i> {statusText}
                             </span>
                             <div className={styles.statusBoxTimer} style={{ color: statusBoxStyle.color }}>
                                 <i className="far fa-clock"></i>
                                 {t('confirm_payment.time_left')} <VisualCountdownTimer expiryTimestamp={visualExpiryTime} />
                             </div>
                         </div>
                         {/* --------------------------------------------------------------------- */}
                    </div>

                    {/* Right: Payment/Actions */}
                    <div className={clsx(styles.paymentSection, styles.mobilePaymentSection)}>
                        <h3 className={styles.paymentTitle}>{t('confirm_payment.payment.title')}</h3>
                         {/* --- ИЗМЕНЕНИЕ: Убираем подзаголовок про симуляцию --- */}
                         {/* <p className={styles.paymentSubtitle}>{t('confirm_payment.payment.subtitle')}</p> */}
                         {/* -------------------------------------------------- */}
                         <div className={styles.totalSection}>
                            <div className={styles.detailItem}>
                                <span className={styles.totalLabel}>{t('confirm_payment.payment.total_label')}</span>
                                <span className={styles.totalValue}>{Number(itemDetails.total_price || 0).toLocaleString()} {t('common.currency')}</span>
                             </div>
                         </div>
                         {/* --- ИЗМЕНЕНИЕ: Кнопка вызывает handleProceedToStripe --- */}
                         <button
                             className={clsx(styles.button, styles.buttonPrimary)}
                             onClick={handleProceedToStripe}
                             disabled={createSessionMutation.isLoading}
                         >
                             <i className={`fas ${createSessionMutation.isLoading ? 'fa-spinner fa-spin' : 'fa-credit-card'}`}></i>
                             {createSessionMutation.isLoading ? t('common.processing') : t('intermediate_checkout.pay_button', 'Оплатить через Stripe')} {/* TODO: Добавить перевод */}
                         </button>
                         {initiationError && <p className={styles.errorMessage}>{initiationError}</p>}
                         {/* --------------------------------------------------------- */}
                         {/* --- ИЗМЕНЕНИЕ: Убираем кнопки возврата, т.к. статус всегда pending --- */}
                         {/* {currentStatus !== 'pending' && currentStatus !== 'processing' && ( ... )} */}
                         {/* ------------------------------------------------------------------- */}
                         {/* --- ИЗМЕНЕНИЕ: Оставляем кнопку отмены --- */}
                         <div className={styles.cancelButtonContainer}>
                             <button onClick={() => navigate(-1)} className={styles.cancelButton}>{t('common.cancel')}</button>
                         </div>
                         {/* ---------------------------------------- */}
                    </div>
                </div>

                 {/* --- ИЗМЕНЕНИЕ: Убираем блок симуляции вебхука --- */}
                 {/* {currentStatus === 'pending' && ( ... )} */}
                 {/* ----------------------------------------------- */}
            </div>
        </div>
    );
};

export default IntermediateCheckoutPage; // <-- Обновляем экспорт
// --- END OF FULL FILE ---