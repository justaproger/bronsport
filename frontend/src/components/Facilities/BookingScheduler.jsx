import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/uz-latn';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

import { fetchFacilityAvailability } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner.jsx';
import { formatSlotTimeRange } from '../../utils/helpers.jsx';
import styles from './BookingScheduler.module.css';

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);

const DAYS_TO_GENERATE = 30;

const BookingScheduler = ({ facilityId, onSelectionChange, initialDate = dayjs(), facilityBookingType }) => {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const today = dayjs().startOf('day');
    
    const validInitialDate = useMemo(() => {
         const initial = dayjs(initialDate).startOf('day');
         return initial.isBefore(today) ? today : initial;
    }, [initialDate, today]);

    const [selectedDate, setSelectedDate] = useState(validInitialDate);
    const [selectedSlots, setSelectedSlots] = useState([]);
    const swiperRef = useRef(null);
    const formattedDate = selectedDate.format('YYYY-MM-DD');

    const {
        data: availabilityResponse,
        isLoading: isLoadingSlots,
        isError: isErrorSlots,
        error: errorSlots,
        isFetching: isFetchingSlots,
    } = useQuery({
        queryKey: ['facilityAvailability', facilityId, formattedDate],
        queryFn: () => fetchFacilityAvailability({ queryKey: ['facilityAvailability', facilityId, formattedDate] }),
        enabled: !!facilityId && !!selectedDate,
        staleTime: 1 * 60 * 1000,
        keepPreviousData: true,
        retry: 1,
    });

    const availableSlotsData = useMemo(() => availabilityResponse?.slots || [], [availabilityResponse]);
    const currentFacilityBookingType = facilityBookingType || availabilityResponse?.facility_booking_type;

    useEffect(() => {
        setSelectedSlots([]);
    }, [selectedDate]);

    useEffect(() => {
        onSelectionChange({ date: formattedDate, slots: selectedSlots.sort() });
    }, [formattedDate, selectedSlots, onSelectionChange]);

    const allDates = useMemo(() =>
        Array.from({ length: DAYS_TO_GENERATE }).map((_, i) => today.add(i, 'day')),
        [today]
    );
    const initialSlideIndex = useMemo(() =>
        allDates.findIndex(d => d.isSame(selectedDate, 'day')),
        [allDates, selectedDate]
    );

     useEffect(() => {
         const prefetchRange = (startIndex, count) => {
             for (let i = 0; i < count; i++) {
                 const dateIndex = startIndex + i;
                 if (dateIndex >= 0 && dateIndex < DAYS_TO_GENERATE) {
                     const dateToPrefetch = today.add(dateIndex, 'day');
                     const queryKey = ['facilityAvailability', facilityId, dateToPrefetch.format('YYYY-MM-DD')];
                     if (!queryClient.getQueryData(queryKey)) {
                          queryClient.prefetchQuery({
                             queryKey: queryKey,
                             queryFn: () => fetchFacilityAvailability({ queryKey }),
                             staleTime: 10 * 60 * 1000
                         });
                      }
                 }
             }
         };
         const swiperInstance = swiperRef.current?.swiper;
         if (swiperInstance) {
             const prefetchVisibleSlides = () => {
                 if (swiperInstance && !swiperInstance.destroyed) {
                     const visibleSlides = swiperInstance.params.slidesPerView === 'auto' ? 7 : Math.ceil(swiperInstance.params.slidesPerView) ;
                     prefetchRange(swiperInstance.activeIndex, visibleSlides + 3);
                 }
             };
             prefetchVisibleSlides();
             swiperInstance.on('slideChangeTransitionEnd', prefetchVisibleSlides);
             swiperInstance.on('resize', prefetchVisibleSlides);
             return () => {
                 if (swiperInstance && !swiperInstance.destroyed) {
                     swiperInstance.off('slideChangeTransitionEnd', prefetchVisibleSlides);
                     swiperInstance.off('resize', prefetchVisibleSlides);
                 }
             };
         } else { 
             prefetchRange(initialSlideIndex > 0 ? initialSlideIndex -1 : 0, 10);
         }
     }, [facilityId, queryClient, today, allDates, initialSlideIndex]);


    const handleDateSelect = useCallback((date) => {
        if (date.isBefore(today)) return;
        setSelectedDate(date);
    }, [today]);

    const handleSlotToggle = useCallback((startTime) => {
        setSelectedSlots(prev =>
            prev.includes(startTime) ? prev.filter(slot => slot !== startTime) : [...prev, startTime]
        );
    }, []);

    const getReasonText = (reasonKey) => {
        if (!reasonKey) return t('booking_scheduler.unavailable_default', 'Недоступно');
        const i18nKey = `booking_scheduler.reason.${reasonKey.toLowerCase()}`;
        const defaultText = reasonKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return t(i18nKey, defaultText);
    };

    return (
        <div className={styles.schedulerContainer}>
            <div style={{ marginBottom: '1.5rem' }}>
                <label className={styles.label}>{t('facility_detail.select_date_label', 'Выберите дату')}</label>
                <div className={styles.swiperWrapper}>
                    <Swiper
                        modules={[Navigation]}
                        ref={swiperRef}
                        spaceBetween={8}
                        initialSlide={initialSlideIndex >= 0 ? initialSlideIndex : 0}
                        navigation={{
                             nextEl: `.${styles.swiperButtonNextDate}`,
                             prevEl: `.${styles.swiperButtonPrevDate}`,
                             disabledClass: styles.swiperButtonDisabled,
                         }}
                        breakpoints={{
                            0: { slidesPerView: 4, spaceBetween: 6 }, 480: { slidesPerView: 5, spaceBetween: 8 },
                            768: { slidesPerView: 7, spaceBetween: 8 }, 1024: { slidesPerView: 9, spaceBetween: 10 },
                            1280: { slidesPerView: 10, spaceBetween: 10 },
                        }}
                        className={styles.dateSwiperContainer}
                    >
                        {allDates.map((date, index) => {
                            const isSelected = date.isSame(selectedDate, 'day');
                            const isPast = date.isBefore(today);
                            return (
                                <SwiperSlide key={index} className={styles.swiperSlideDate}>
                                    <div
                                        className={clsx( styles.dateItem, isPast && styles.dateItemPast, isSelected && styles.dateItemSelected )}
                                        onClick={!isPast ? () => handleDateSelect(date) : undefined}
                                        role={!isPast ? "button" : undefined}
                                        tabIndex={!isPast ? 0 : -1}
                                        onKeyDown={(e) => {if ((e.key === 'Enter' || e.key === ' ') && !isPast) handleDateSelect(date);}}
                                        aria-label={date.locale(i18n.language).format('D MMMM YYYY')}
                                    >
                                        <span className={styles.dateDay}>{date.locale(i18n.language).format('ddd')}</span>
                                        <span className={styles.dateDate}>{date.format('DD')}</span>
                                        <span className={styles.dateMonth}>{date.locale(i18n.language).format('MMM')}</span>
                                    </div>
                                </SwiperSlide>
                            );
                        })}
                    </Swiper>
                    <div className={clsx(styles.swiperButtonPrevDate, styles.swiperButtonDate)} aria-label={t('common.prev_slide')}><i className="fas fa-chevron-left"></i></div>
                    <div className={clsx(styles.swiperButtonNextDate, styles.swiperButtonDate)} aria-label={t('common.next_slide')}><i className="fas fa-chevron-right"></i></div>
                </div>
            </div>

            <div className={styles.timeSlotsSection}>
                <h4 className={styles.label}>{t('facility_detail.select_time_title', 'Выберите время')} ({t('subscription_form.time_step', 'Шаг: 1 час')})</h4>
                {(isLoadingSlots || (isFetchingSlots && !availabilityResponse)) && (
                     <div className={styles.slotsOverlayLoading}> <LoadingSpinner size="25px" text={t('common.loading', 'Загрузка...')} /> </div>
                 )}
                {isErrorSlots && !isFetchingSlots && ( <div className={clsx(styles.loadingOrError, styles.errorMessage)}> {t('errors.slots_availability_check_error', 'Ошибка проверки доступности слотов:')} {errorSlots?.response?.data?.detail || errorSlots?.message || ''} </div> )}
                
                {!isLoadingSlots && !isErrorSlots && availabilityResponse && (
                    <>
                        {isFetchingSlots && availabilityResponse && (
                            <div className={styles.slotsFetchingIndicator}>
                                <LoadingSpinner size="16px" text="" display="inline" />
                                <span>{t('common.updating', 'Обновление...')}</span>
                            </div>
                        )}
                        {availableSlotsData.length > 0 ? (
                            <div className={styles.slotsGrid}>
                                {availableSlotsData.map(slot => {
                                    const startTime = slot.time;
                                    const isAvailable = slot.is_available;
                                    const isSelected = selectedSlots.includes(startTime); // Проверка, выбран ли слот
                                    const displayTime = formatSlotTimeRange(startTime);
                                    
                                    let slotText = displayTime;
                                    let slotTitle = isAvailable ? t('booking_scheduler.select_slot', 'Выбрать {{time}}', { time: displayTime }) : getReasonText(slot.reason);
                                    let spotsInfo = null;

                                    if (currentFacilityBookingType === 'overlapping_slot' && slot.max_capacity > 0) {
                                        if (isAvailable) {
                                            const spotsTextKey = slot.available_spots === 1 ? 'booking_scheduler.spot_available_one' : (slot.available_spots >=2 && slot.available_spots <=4 ? 'booking_scheduler.spot_available_few' : 'booking_scheduler.spot_available_many');
                                            spotsInfo = (
                                                <span className={styles.spotsAvailable}>
                                                    {t(spotsTextKey, '{{count}} мест', { count: slot.available_spots })}
                                                </span>
                                            );
                                        } else if (slot.available_spots === 0 && slot.reason === 'max_capacity_reached') {
                                            slotTitle = t('booking_scheduler.reason.max_capacity_reached_short', 'Мест нет');
                                        }
                                    }

                                    return (
                                        <button
                                            key={startTime}
                                            type="button"
                                            className={clsx(
                                                styles.slotItem,
                                                !isAvailable && styles.slotItemUnavailable,
                                                isSelected && styles.slotItemSelected // Применение класса для выделения
                                            )}
                                            onClick={isAvailable ? () => handleSlotToggle(startTime) : undefined}
                                            disabled={!isAvailable}
                                            title={slotTitle}
                                            aria-pressed={isSelected}
                                            aria-label={slotTitle}
                                        >
                                            <span className={styles.slotTimeText}>{slotText}</span>
                                            {spotsInfo}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className={styles.noSlotsMessage}>
                                {availabilityResponse?.message || t('booking_scheduler.no_slots_on_date', 'Нет доступных слотов на выбранную дату.')}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default BookingScheduler;