// --- START OF FULL MODIFIED frontend/src/pages/SubscriptionSetupPage.jsx ---
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/uz-latn';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { Decimal } from 'decimal.js';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';

import { fetchFacilityDetail, preparePaycomPayment } from '../services/api';
import LoadingSpinner from '../components/Common/LoadingSpinner.jsx';
import SubscriptionForm from '../components/Facilities/SubscriptionForm';
import { formatSlotTimeRange, handleImageError, DOW_MAP_I18N, DOW_FALLBACK } from '../utils/helpers.jsx';
import { parseApiError } from '../utils/errorUtils.js';
import styles from './SubscriptionSetupPage.module.css';

dayjs.extend(isSameOrBefore);

const SubscriptionSetupPage = () => {
    const { facilityId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;
    const { isAuthenticated } = useSelector(state => state.auth);
    
    const durations = useMemo(() => [
        { value: 1, label: t('duration.month', { count: 1 }) }, { value: 2, label: t('duration.month', { count: 2 }) },
        { value: 3, label: t('duration.month', { count: 3 }) }, { value: 6, label: t('duration.month', { count: 6 }) },
        { value: 12, label: t('duration.month', { count: 12 }) },
    ], [t]);

    const [subscriptionParams, setSubscriptionParams] = useState({
        start_date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
        months: durations[0].value, days_of_week: [], start_times: [],
    });
    const [calculatedPrice, setCalculatedPrice] = useState(null);
    const [priceError, setPriceError] = useState('');

    const { data: facility, isLoading: isLoadingFacility, isError: isErrorFacility, error: errorFacility } = useQuery({
        queryKey: ['facilityDetail', facilityId, 'forSubscriptionPage'], 
        queryFn: () => fetchFacilityDetail({ queryKey: ['facilityDetail', facilityId] }),
        enabled: !!facilityId, staleTime: 10 * 60 * 1000,
    });

    const handleParamsChange = useCallback((params) => {
        setSubscriptionParams(params); setCalculatedPrice(null); setPriceError('');
    }, []);
    const langPath = useCallback((path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`, [currentLang]);

    const preparePaymentMutation = useMutation({
        mutationFn: preparePaycomPayment,
        onSuccess: (response) => {
            const orderIdentifier = response?.data?.order_identifier;
            if (orderIdentifier) {
                // НЕ передаем state
                navigate(langPath(`/payment-status/${orderIdentifier}`));
            } else {
                toast.error(t('errors.api.prepare_payment_failed_no_id_sub', 'Не удалось подготовить абонемент к оплате. ID не получен.'));
            }
        },
        onError: (error) => {
            const parsedError = parseApiError(error);
            toast.error(`${t('errors.api.prepare_payment_failed_sub', 'Ошибка подготовки абонемента к оплате:')} ${parsedError}`);
        }
    });

    const calculateAndSetPrice = useCallback(() => {
        if (!facility || !subscriptionParams.start_date || subscriptionParams.days_of_week.length === 0 || subscriptionParams.start_times.length === 0) {
            setPriceError(t('subscription_setup.error_fill_all_params')); setCalculatedPrice(null); return;
        }
        setPriceError('');
        try {
            const pricePerHour = new Decimal(facility.price_per_hour || 0);
            if (pricePerHour.isNaN() || pricePerHour.isZero()) throw new Error(t('errors.invalid_price_per_hour'));
            const startDate = dayjs(subscriptionParams.start_date);
            const endDate = startDate.add(subscriptionParams.months, 'month').subtract(1, 'day');
            if (!startDate.isValid() || !endDate.isValid() || endDate.isBefore(startDate)) throw new Error(t('errors.invalid_subscription_period'));
            let occurrences = 0; let currentDate = startDate;
            const selectedWeekdaysNumeric = new Set(subscriptionParams.days_of_week.map(Number));
            while (currentDate.isSameOrBefore(endDate, 'day')) {
                let dayjsDow = currentDate.day(); let ourDowSystem = (dayjsDow === 0) ? 6 : (dayjsDow - 1);
                if (selectedWeekdaysNumeric.has(ourDowSystem)) { occurrences++; }
                currentDate = currentDate.add(1, 'day');
            }
            const totalSlots = occurrences * subscriptionParams.start_times.length;
            if (totalSlots === 0) throw new Error(t('subscription_setup.error_no_slots_for_price'));
            const calculated = pricePerHour.times(totalSlots);
            if (calculated.isNaN()) throw new Error(t('errors.calculation_error'));
            setCalculatedPrice(calculated.toDecimalPlaces(0).toString());
        } catch (err) {
            setPriceError(err.message || t('errors.generic_calculation_error')); setCalculatedPrice(null);
        }
    }, [facility, subscriptionParams, t]);

    const handleInitiatePayment = useCallback(() => {
        if (!isAuthenticated) {
            toast.error(t('facility_detail.login_to_book_toast'));
            navigate(langPath('/login'), { state: { from: location }, replace: true }); return;
        }
        if (!calculatedPrice) { toast.error(t('subscription_setup.alert_calculate_price')); return; }
        if (subscriptionParams.days_of_week.length === 0 || subscriptionParams.start_times.length === 0) {
            toast.error(t('subscription_setup.alert_select_days_times')); return;
        }
        if (!facility || !facilityId) { toast.error(t('errors.facility_data_missing')); return; }
        
        const subscriptionDataForApi = { 
            item_type: 'subscription', 
            facility_id: parseInt(facilityId, 10), 
            ...subscriptionParams,
        };
        preparePaymentMutation.mutate(subscriptionDataForApi);
    }, [
        isAuthenticated, calculatedPrice, subscriptionParams, facility, facilityId, 
        preparePaymentMutation, navigate, location, t, langPath
    ]);

    const selectedDurationLabel = useMemo(() => durations.find(d => d.value === subscriptionParams.months)?.label || '?', [durations, subscriptionParams.months]);
    const displayDays = useMemo(() => {
        if (!subscriptionParams.days_of_week || subscriptionParams.days_of_week.length === 0) return '-';
        return subscriptionParams.days_of_week.map(d => Number(d)).sort((a,b) => a-b).map(dayIndex => t(DOW_MAP_I18N[dayIndex] || `weekdays.day${dayIndex}`, DOW_FALLBACK[dayIndex] || '?')).join(', ') || '-';
    }, [subscriptionParams.days_of_week, t]);
    const displayTimes = useMemo(() => {
        if (!subscriptionParams.start_times || subscriptionParams.start_times.length === 0) return '-';
        return [...subscriptionParams.start_times].sort().map(formatSlotTimeRange).join(', ') || '-';
    }, [subscriptionParams.start_times]);
    const endDateDisplay = useMemo(() => {
        const start = dayjs(subscriptionParams.start_date);
        return start.isValid() ? start.add(subscriptionParams.months, 'month').subtract(1, 'day').locale(currentLang).format('D MMMM YYYY') : t('common.not_selected');
    }, [subscriptionParams.start_date, subscriptionParams.months, currentLang, t]);

    if (isLoadingFacility) return <div className={styles.container}><LoadingSpinner text={t('common.loading_facility')} /></div>;
    if (isErrorFacility) return <div className={styles.container}><p className={styles.errorMessage}>{t('errors.facility_load_error')} {errorFacility?.response?.data?.detail || errorFacility?.message || ''}</p></div>;
    if (!facility) return <div className={styles.container}><p>{t('common.facility_not_found')}</p></div>;
    if (facility.booking_type === 'entry_fee') { return ( <div className={styles.container}> <div className={styles.pageHeader}> <h1 className={styles.pageTitle}>{t('subscription_setup.title', { name: facility.name })}</h1> </div> <p className={styles.infoMessage}>{t('subscription_form.entry_fee_not_applicable')}</p> <Link to={langPath(`/facilities/${facilityId}`)} className={clsx(styles.button, styles.buttonOutline)}>{t('common.back')}</Link> </div> ); }

    const isSubmitDisabled = !calculatedPrice || priceError || preparePaymentMutation.isLoading || subscriptionParams.days_of_week.length === 0 || subscriptionParams.start_times.length === 0;

    return (
        <div className={styles.pageWrapper}>
             <div className={styles.container}>
                <div className={styles.pageHeader}>
                    <div className={styles.breadcrumbs}>
                        <Link to={langPath('/')} className={styles.breadcrumbLink}>{t('footer.home')}</Link> <span>/</span>
                        <Link to={langPath('/facilities')} className={styles.breadcrumbLink}>{t('nav.facilities')}</Link> <span>/</span>
                        <Link to={langPath(`/facilities/${facilityId}`)} className={styles.breadcrumbLink}>{facility.name}</Link> <span>/</span>
                        {t('subscription_setup.breadcrumb')}
                    </div>
                    <h1 className={styles.pageTitle}>{t('subscription_setup.title', { name: facility.name })}</h1>
                    <p className={styles.pageSubtitle}>{t('subscription_setup.subtitle')}</p>
                </div>

                <div className={styles.layoutGrid}>
                    <div className={styles.formContainer}>
                        <h2>{t('subscription_setup.form_title')}</h2>
                        <SubscriptionForm
                            facility={facility}
                            facilityId={facilityId}
                            onParamsChange={handleParamsChange}
                            durations={durations}
                            initialParams={subscriptionParams}
                            t={t} // Передаем функцию t в SubscriptionForm
                        />
                    </div>

                    <div className={styles.summaryContainer}>
                        <h3 className={styles.summaryTitle}>{t('subscription_setup.summary.title')}</h3>
                        <div className={styles.summaryItem}> <span className={styles.summaryLabel}>{t('subscription_setup.summary.object')}</span> <span className={styles.summaryValue}>{facility.name}</span> </div>
                        <div className={styles.summaryItem}> <span className={styles.summaryLabel}>{t('subscription_setup.summary.start_date')}</span> <span className={styles.summaryValue}>{dayjs(subscriptionParams.start_date).locale(currentLang).format('D MMMM YYYY')}</span> </div>
                        <div className={styles.summaryItem}> <span className={styles.summaryLabel}>{t('subscription_setup.summary.end_date')}</span> <span className={styles.summaryValue}>{endDateDisplay}</span> </div>
                        <div className={styles.summaryItem}> <span className={styles.summaryLabel}>{t('subscription_setup.summary.duration')}</span> <span className={styles.summaryValue}>{selectedDurationLabel}</span> </div>
                        <div className={styles.summaryItem}> <span className={styles.summaryLabel}>{t('subscription_setup.summary.days')}</span> <span className={styles.summaryValue}>{displayDays}</span> </div>
                        <div className={styles.summaryItem}> <span className={styles.summaryLabel}>{t('subscription_setup.summary.time')}</span> <span className={styles.summaryValue}>{displayTimes}</span> </div>
                        
                        <div className={styles.priceCalcSection}>
                            <button onClick={calculateAndSetPrice} className={clsx(styles.button, styles.calcButton)} disabled={subscriptionParams.days_of_week.length === 0 || subscriptionParams.start_times.length === 0 || isLoadingFacility }>
                                <i className="fas fa-calculator"></i> {t('subscription_setup.calculate_button')}
                            </button>
                            {priceError && <p className={styles.errorText}>{priceError}</p>}
                            {calculatedPrice !== null && !priceError && (
                                <div className={styles.priceDisplay}>
                                    {t('subscription_setup.price_label')} <strong>{Number(calculatedPrice).toLocaleString()} {t('common.currency')}</strong>
                                </div>
                            )}
                        </div>
                        
                         <button
                             onClick={handleInitiatePayment}
                             className={clsx(styles.button, styles.submitButton)}
                             disabled={isSubmitDisabled}
                             title={ !isAuthenticated ? t('facility_detail.login_to_book_title') : (!calculatedPrice ? t('subscription_setup.alert_calculate_price') : (subscriptionParams.days_of_week.length === 0 || subscriptionParams.start_times.length === 0 ? t('subscription_setup.alert_select_days_times') : t('subscription_setup.confirm_button_title'))) }
                         >
                             {preparePaymentMutation.isLoading ? ( <LoadingSpinner size="1em" color="#fff" text="" display="inline" /> ) : ( <i className={`fas fa-credit-card`}></i> )}
                             {preparePaymentMutation.isLoading ? t('common.processing') : isAuthenticated ? t('subscription_setup.pay_button_label') : t('facility_detail.login_to_book_button') }
                         </button>
                         {!isAuthenticated && calculatedPrice && <small className={styles.loginPrompt}> <Link to={langPath('/login')} state={{ from: location }}>{t('facility_detail.login_prompt_link')}</Link>, {t('facility_detail.login_prompt_text')} </small>}
                    </div>
                </div>
             </div>
        </div>
    );
};

export default SubscriptionSetupPage;
// --- END OF FULL MODIFIED frontend/src/pages/SubscriptionSetupPage.jsx ---