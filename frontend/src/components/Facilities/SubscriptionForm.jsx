import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/uz-latn';
import clsx from 'clsx';

// Используем fetchComprehensiveSubscriptionAvailability
import { fetchComprehensiveSubscriptionAvailability } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner.jsx';
import { formatSlotTimeRange } from '../../utils/helpers.jsx';
import styles from './SubscriptionForm.module.css';

// Константа дней недели (ключи для i18n)
const weekdays = [
    { id: 0, nameKey: 'weekdays.monday', default: 'Пн' },
    { id: 1, nameKey: 'weekdays.tuesday', default: 'Вт' },
    { id: 2, nameKey: 'weekdays.wednesday', default: 'Ср' },
    { id: 3, nameKey: 'weekdays.thursday', default: 'Чт' },
    { id: 4, nameKey: 'weekdays.friday', default: 'Пт' },
    { id: 5, nameKey: 'weekdays.saturday', default: 'Сб' },
    { id: 6, nameKey: 'weekdays.sunday', default: 'Вс' },
];

const SubscriptionForm = ({
    facility, // Полный объект facility для open_time, close_time
    facilityId,
    onParamsChange,
    durations = [],
    initialParams = {},
    t // Функция перевода из useTranslation
}) => {
    if (!t) {
        console.error("SubscriptionForm requires the 't' function prop from useTranslation.");
        return <div className={styles.errorMessage}>Error: Translation function not provided.</div>;
    }

    const today = dayjs().startOf('day');
    const [startDate, setStartDate] = useState(() => dayjs(initialParams.start_date || today.add(1, 'day')));
    const [selectedDays, setSelectedDays] = useState(() => initialParams.days_of_week || []);
    const [selectedTimes, setSelectedTimes] = useState(() => initialParams.start_times || []);
    const [durationMonths, setDurationMonths] = useState(() => initialParams.months || durations[0]?.value || 1);

    // Запрос комплексной доступности для подписки
    const {
        data: comprehensiveAvailability, // Объект { facility_booking_type, availability_matrix }
        isLoading: isLoadingAvailability,
        isError: isErrorAvailability,
        error: errorAvailability,
        isFetching: isFetchingAvailability,
    } = useQuery({
        queryKey: ['comprehensiveSubscriptionAvailability', facilityId],
        queryFn: () => fetchComprehensiveSubscriptionAvailability({ queryKey: ['comprehensiveSubscriptionAvailability', facilityId] }),
        enabled: !!facilityId,
        staleTime: 5 * 60 * 1000, // Кэш 5 минут
        select: (data) => data || { availability_matrix: {}, facility_booking_type: null }, // Фоллбэк
    });

    const availabilityMatrix = useMemo(() => comprehensiveAvailability?.availability_matrix || {}, [comprehensiveAvailability]);
    const facilityBookingType = useMemo(() => comprehensiveAvailability?.facility_booking_type, [comprehensiveAvailability]);

    // Все возможные времена начала слотов на объекте (шаг 1 час)
    const facilityAvailableTimes = useMemo(() => {
        if (!facility || !facility.open_time || !facility.close_time) return [];
        const openT = dayjs(`1970-01-01T${facility.open_time}`);
        const closeT = dayjs(`1970-01-01T${facility.close_time === '00:00:00' ? '24:00:00' : facility.close_time}`);
        if (!openT.isValid() || !closeT.isValid() || closeT.isSameOrBefore(openT)) return [];
        const times = []; let current = openT;
        while(current.isBefore(closeT)) {
            times.push(current.format('HH:mm'));
            current = current.add(1, 'hour');
        }
        return times;
    }, [facility]);

    // Хелпер: проверяет, доступен ли конкретный слот (день+время) для НОВОЙ подписки
    const isSlotGenerallyAvailableForSubscription = useCallback((dayId, timeStr) => {
        return availabilityMatrix[String(dayId)]?.[timeStr]?.is_available_for_subscription === true;
    }, [availabilityMatrix]);

    // Хелпер: проверяет, есть ли ХОТЯ БЫ ОДИН доступный для подписки слот в указанный день недели
    const isAnySlotAvailableOnDay = useCallback((dayId) => {
        if (isLoadingAvailability || facilityAvailableTimes.length === 0) return true; // Пока грузим или нет времен, считаем доступным для выбора
        return facilityAvailableTimes.some(time => isSlotGenerallyAvailableForSubscription(dayId, time));
    }, [facilityAvailableTimes, isSlotGenerallyAvailableForSubscription, isLoadingAvailability]);

    // Хелпер: проверяет, доступно ли указанное ВРЕМЯ хотя бы в ОДИН из ВЫБРАННЫХ дней
    const isTimeAvailableOnAnySelectedDay = useCallback((timeStr) => {
        if (isLoadingAvailability || selectedDays.length === 0) return true; // Если дни не выбраны, все времена "доступны" для выбора
        return selectedDays.some(dayId => isSlotGenerallyAvailableForSubscription(dayId, timeStr));
    }, [selectedDays, isSlotGenerallyAvailableForSubscription, isLoadingAvailability]);


    // Обработчики
    const handleStartDateChange = (e) => { setStartDate(dayjs(e.target.value)); };
    const handleDurationChange = (e) => { setDurationMonths(parseInt(e.target.value, 10)); };

    const handleDayToggle = useCallback((dayId) => {
        if (!isAnySlotAvailableOnDay(dayId) && !selectedDays.includes(dayId)) {
            alert(t('subscription_form.alert_day_unavailable_comprehensive', 'В этот день нет слотов, доступных для оформления абонемента.'));
            return;
        }
        const newSelectedDays = selectedDays.includes(dayId)
            ? selectedDays.filter(d => d !== dayId)
            : [...selectedDays, dayId];
        setSelectedDays(newSelectedDays);

        // При изменении выбранных дней, перепроверяем выбранные времена
        setSelectedTimes(prevTimes => prevTimes.filter(time =>
            newSelectedDays.some(day => isSlotGenerallyAvailableForSubscription(day, time))
        ));
    }, [selectedDays, isAnySlotAvailableOnDay, isSlotGenerallyAvailableForSubscription, t]);

    const handleTimeToggle = useCallback((startTime) => {
        if (selectedDays.length === 0) {
             alert(t('subscription_form.alert_select_day_first', 'Сначала выберите дни недели.'));
             return;
        }
        if (!isTimeAvailableOnAnySelectedDay(startTime) && !selectedTimes.includes(startTime)) {
            alert(t('subscription_form.alert_time_unavailable_comprehensive', 'Это время недоступно для абонемента в выбранные вами дни.'));
            return;
        }
        setSelectedTimes(prev =>
            prev.includes(startTime) ? prev.filter(t => t !== startTime) : [...prev, startTime]
        );
    }, [selectedDays, selectedTimes, isTimeAvailableOnAnySelectedDay, isSlotGenerallyAvailableForSubscription, t]);

    useEffect(() => {
        onParamsChange({
            start_date: startDate.format('YYYY-MM-DD'),
            months: durationMonths,
            days_of_week: selectedDays.sort((a, b) => a - b),
            start_times: selectedTimes.sort(),
        });
    }, [startDate, durationMonths, selectedDays, selectedTimes, onParamsChange]);

    // --- Рендеринг ---
    if (isLoadingAvailability && !comprehensiveAvailability) { // Показываем основной лоадер только при первой загрузке
        return <div className={styles.loadingContainer}><LoadingSpinner text={t('common.checking_availability', 'Проверка доступности...')} /></div>;
    }
    if (isErrorAvailability) {
        return <div className={styles.errorMessage}>{t('errors.availability_check_error', 'Ошибка проверки доступности:')} {errorAvailability?.message || ''}</div>;
    }
    if (!facility) { // Если объект facility еще не загружен родительским компонентом
        return <div className={styles.loadingContainer}><LoadingSpinner text={t('common.loading_facility', 'Загрузка объекта...')} /></div>;
    }
    if (facilityBookingType === 'entry_fee') {
        return <div className={styles.infoMessage}>{t('subscription_form.entry_fee_not_applicable', 'Абонементы не применимы для объектов с оплатой за вход.')}</div>;
    }


    return (
        <div>
            {isFetchingAvailability && comprehensiveAvailability && ( /* Индикатор фонового обновления */
                <div className={styles.fetchingIndicator}>
                    <LoadingSpinner size="16px" text="" display="inline" />
                    <span>{t('common.updating', 'Обновление...')}</span>
                </div>
            )}
            {/* Дата начала и Длительность */}
            <div className={styles.twoColGrid}>
                <div className={styles.formSection}>
                    <label htmlFor="sub-start-date" className={styles.label}>{t('subscription_form.start_date_label', 'Дата начала')}</label>
                    <input
                        id="sub-start-date" type="date"
                        value={startDate.format('YYYY-MM-DD')}
                        min={today.add(1, 'day').format('YYYY-MM-DD')}
                        onChange={handleStartDateChange}
                        className={styles.input}
                    />
                </div>
                <div className={styles.formSection}>
                    <label htmlFor="sub-duration" className={styles.label}>{t('subscription_form.duration_label', 'Длительность')}</label>
                    <select
                        id="sub-duration" value={durationMonths}
                        onChange={handleDurationChange} className={styles.select}
                    >
                        {durations.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Дни недели */}
            <div className={styles.formSection}>
                <label className={styles.label}>{t('subscription_form.days_label', 'Дни недели')}</label>
                 <div className={styles.dayGrid}>
                    {weekdays.map(day => {
                        const dayIsGenerallyAvailable = isAnySlotAvailableOnDay(day.id);
                        const isSelected = selectedDays.includes(day.id);
                        const dayName = t(day.nameKey, day.default);
                        return (
                            <button
                                key={day.id}
                                type="button"
                                className={clsx(
                                    styles.checkboxButton,
                                    isSelected && styles.checkboxButtonSelected,
                                    !dayIsGenerallyAvailable && !isSelected && styles.checkboxButtonDisabled // Дизейблим, если недоступен и не выбран
                                )}
                                onClick={() => handleDayToggle(day.id)}
                                disabled={!dayIsGenerallyAvailable && !isSelected}
                                title={!dayIsGenerallyAvailable && !isSelected ? t('subscription_form.tooltip_day_unavailable_comprehensive', 'Все слоты в этот день недоступны для абонемента') : t('subscription_form.tooltip_select_day', 'Выбрать {{dayName}}', { dayName })}
                                aria-pressed={isSelected}
                            >
                                {dayName}
                            </button>
                        );
                     })}
                </div>
                 {selectedDays.length === 0 && <small className={styles.helperTextError}>{t('validation.select_at_least_one_day', 'Выберите хотя бы один день.')}</small>}
            </div>

            {/* Выбор Времени */}
            <div className={styles.formSection}>
                 <label className={styles.label}>{t('subscription_form.time_label', 'Время начала слотов')} ({t('subscription_form.time_step', 'Шаг: 1 час')})</label>
                 {facilityAvailableTimes.length > 0 ? (
                     <div className={styles.timeGrid}>
                         {facilityAvailableTimes.map(startTimeStr => {
                             const isSelected = selectedTimes.includes(startTimeStr);
                             const displayTime = formatSlotTimeRange(startTimeStr);
                             const timeIsGenerallyAvailableOnSelectedDays = isTimeAvailableOnAnySelectedDay(startTimeStr);

                             return (
                                 <button
                                     key={startTimeStr}
                                     type="button"
                                     className={clsx(
                                         styles.checkboxButton,
                                         isSelected && styles.checkboxButtonSelected,
                                         (!timeIsGenerallyAvailableOnSelectedDays && !isSelected) && styles.checkboxButtonDisabled
                                     )}
                                     onClick={() => handleTimeToggle(startTimeStr)}
                                     disabled={!timeIsGenerallyAvailableOnSelectedDays && !isSelected}
                                     title={
                                         selectedDays.length === 0 ? t('subscription_form.tooltip_select_day_first') :
                                         (!timeIsGenerallyAvailableOnSelectedDays && !isSelected ? t('subscription_form.tooltip_time_unavailable_comprehensive') :
                                         t('subscription_form.tooltip_select_time', 'Выбрать {{displayTime}}', { displayTime }))
                                     }
                                     aria-pressed={isSelected}
                                 >
                                     {displayTime}
                                     {/* Отображение доступных мест для overlapping */}
                                     {facilityBookingType === 'overlapping_slot' && selectedDays.length > 0 &&
                                        isSlotGenerallyAvailableForSubscription(selectedDays[0], startTimeStr) && // Проверяем для первого выбранного дня (или можно для всех)
                                        availabilityMatrix[String(selectedDays[0])]?.[startTimeStr]?.available_spots_for_subscription !== undefined &&
                                        (availabilityMatrix[String(selectedDays[0])]?.[startTimeStr]?.available_spots_for_subscription < (facility?.max_capacity || 0) || isSelected) && // Показываем, если не все места свободны или слот выбран
                                        (
                                        <span className={clsx(styles.spotsAvailable, isSelected && styles.spotsAvailableSelected)}>
                                            ({t('subscription_form.spots_left', 'ост: {{count}}', { count: availabilityMatrix[String(selectedDays[0])]?.[startTimeStr]?.available_spots_for_subscription })})
                                        </span>
                                     )}
                                 </button>
                             );
                         })}
                     </div>
                 ) : (
                    <p className={styles.noSlotsMessage}>{t('subscription_form.no_slots_available_facility', 'Объект не предоставляет слотов в указанное рабочее время.')}</p>
                 )}
                  {selectedTimes.length === 0 && <small className={styles.helperTextError}>{t('validation.select_at_least_one_slot', 'Выберите хотя бы один временной слот.')}</small>}
            </div>
        </div>
    );
};

export default SubscriptionForm;