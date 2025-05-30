// --- START OF FULL MODIFIED frontend/src/pages/FacilityDetailPage.jsx ---
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/uz-latn';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { Decimal } from 'decimal.js';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
// Опциональные плагины для Lightbox, если нужны
// import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
// import Zoom from "yet-another-react-lightbox/plugins/zoom";
// import "yet-another-react-lightbox/plugins/fullscreen.css";
// import "yet-another-react-lightbox/plugins/zoom.css";

import { fetchFacilityDetail, preparePaycomPayment } from '../services/api';
import LoadingSpinner from '../components/Common/LoadingSpinner.jsx';
import BookingScheduler from '../components/Facilities/BookingScheduler.jsx';
import { formatTime, formatSlotTimeRange, handleImageError, DOW_MAP_I18N, DOW_FALLBACK } from '../utils/helpers.jsx';
import { parseApiError } from '../utils/errorUtils.js';
import styles from './FacilityDetailPage.module.css';

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);

const FacilityDetailPage = () => {
    const { facilityId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;
    const { isAuthenticated } = useSelector(state => state.auth);
    
    const initialDateFromState = location.state?.selectedDate || dayjs().format('YYYY-MM-DD');
    const [bookingSelection, setBookingSelection] = useState({
        date: initialDateFromState,
        slots: [],
    });
    const [currentActiveImage, setCurrentActiveImage] = useState(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const { data: facility, isLoading, isError, error: facilityLoadingError } = useQuery({
        queryKey: ['facilityDetail', facilityId],
        queryFn: () => fetchFacilityDetail({ queryKey: ['facilityDetail', facilityId] }),
        enabled: !!facilityId,
        staleTime: 5 * 60 * 1000,
    });

    const bookingTypeFromFacility = useMemo(() => facility?.booking_type, [facility]);

    const workingDaysDisplay = useMemo(() => {
        if (!facility?.working_days) return '';
        try {
            const dayIndices = facility.working_days.split(',').map(d => parseInt(d.trim(), 10));
            return dayIndices.filter(d => !isNaN(d) && d >= 0 && d <= 6).sort((a,b) => a - b)
                             .map(index => t(DOW_MAP_I18N[index], DOW_FALLBACK[index]))
                             .join(', ');
        } catch (e) { 
            console.error("Error parsing working_days for display:", facility.working_days, e);
            return facility.working_days; 
        }
    }, [facility?.working_days, t]);

    const bookingTypeDisplay = useMemo(() => {
        if (!bookingTypeFromFacility) return '';
        return t(`booking_type.${bookingTypeFromFacility}`, bookingTypeFromFacility);
    }, [bookingTypeFromFacility, t]);

    const galleryImages = useMemo(() => [
        ...(facility?.main_image ? [{ id: 'main-img', image: facility.main_image, caption: facility.name }] : []), // Уникальный id для main_image
        ...(facility?.images?.map((img, index) => ({...img, id: img.id || `gallery-${index}`})) || []) // Уникальные id для gallery images
    ], [facility?.main_image, facility?.images, facility?.name]);
    

    const lightboxSlides = useMemo(() =>
        galleryImages.map(img => ({ src: img.image, title: img.caption || facility?.name || '' })) || [],
        [galleryImages, facility?.name]
    );

    useEffect(() => {
        if (facility) {
            const galleryUrls = galleryImages.map(img => img.image);
            const defaultImage = galleryUrls.length > 0 ? galleryUrls[0] : (facility.main_image || null);
            if (defaultImage && (!currentActiveImage || !galleryUrls.includes(currentActiveImage))) {
                setCurrentActiveImage(defaultImage);
            } else if (!defaultImage && currentActiveImage) {
                setCurrentActiveImage(null);
            }
        }
    }, [facility, galleryImages, currentActiveImage]);

    const openLightbox = useCallback((index) => {
         if (galleryImages.length > 0 && index >= 0 && index < galleryImages.length) {
            setLightboxIndex(index); 
            setLightboxOpen(true); 
        } else if (galleryImages.length > 0 && index < 0) {
            setLightboxIndex(0);
            setLightboxOpen(true);
        }
    }, [galleryImages]);

    const handleBookingSelectionChange = useCallback((selection) => {
        setBookingSelection(selection);
    }, []);

    const selectedHours = bookingSelection.slots.length;
    const pricePerHourOrEntry = useMemo(() => facility ? new Decimal(facility.price_per_hour || 0) : new Decimal(0), [facility]);
    const totalPrice = useMemo(() => {
        if (bookingTypeFromFacility === 'entry_fee') return pricePerHourOrEntry;
        else return pricePerHourOrEntry.times(selectedHours);
    }, [bookingTypeFromFacility, pricePerHourOrEntry, selectedHours]);

    const formatSelectedTimeForSummary = useCallback((slots) => {
        if (!slots || slots.length === 0) return '-';
        if (slots.length === 1) return formatSlotTimeRange(slots[0]);
        const sortedSlots = [...slots].sort();
        const ranges = []; let currentRangeStart = sortedSlots[0]; let currentRangeEnd = sortedSlots[0];
        for (let i = 1; i < sortedSlots.length; i++) {
            const prevTime = dayjs(`1970-01-01T${currentRangeEnd}:00`);
            const currentTime = dayjs(`1970-01-01T${sortedSlots[i]}:00`);
            if (currentTime.isSame(prevTime.add(1, 'hour'))) { currentRangeEnd = sortedSlots[i]; }
            else {
                 const rangeStartFormatted = dayjs(`1970-01-01T${currentRangeStart}:00`);
                 const rangeEndFormatted = dayjs(`1970-01-01T${currentRangeEnd}:00`).add(1, 'hour');
                 ranges.push(`${rangeStartFormatted.format('HH:mm')} - ${rangeEndFormatted.format('HH:mm')}`);
                currentRangeStart = sortedSlots[i]; currentRangeEnd = sortedSlots[i];
            }
        }
        const lastRangeStartFormatted = dayjs(`1970-01-01T${currentRangeStart}:00`);
        const lastRangeEndFormatted = dayjs(`1970-01-01T${currentRangeEnd}:00`).add(1, 'hour');
        ranges.push(`${lastRangeStartFormatted.format('HH:mm')} - ${lastRangeEndFormatted.format('HH:mm')}`);
        return ranges.join(', ');
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
                toast.error(t('errors.api.prepare_payment_failed_no_id', 'Не удалось подготовить заказ к оплате. ID заказа не получен.'));
            }
        },
        onError: (error) => {
            const parsedError = parseApiError(error);
            toast.error(`${t('errors.api.prepare_payment_failed', 'Ошибка подготовки заказа к оплате:')} ${parsedError}`);
        }
    });

    const handleInitiatePayment = useCallback(() => {
        if (!isAuthenticated) {
            toast.error(t('facility_detail.login_to_book_toast'));
            navigate(langPath('/login'), { state: { from: location }, replace: true });
            return;
        }
        if (bookingTypeFromFacility !== 'entry_fee' && selectedHours === 0) { 
            toast.error(t('facility_detail.alert_select_time')); return; 
        }
        if (!bookingSelection.date) { 
            toast.error(t('facility_detail.alert_select_date')); return; 
        }
        if (!facility || !facilityId) { 
            toast.error(t('errors.facility_data_missing')); return; 
        }
        let itemTypeForApi = bookingTypeFromFacility === 'entry_fee' ? 'entry_fee' : 'slot_booking';
        const bookingData = { 
            item_type: itemTypeForApi,
            facility_id: parseInt(facilityId, 10), 
            date: bookingSelection.date,
        };
        if (itemTypeForApi === 'slot_booking') { 
            bookingData.slots = bookingSelection.slots.sort(); 
        }
        preparePaymentMutation.mutate(bookingData);
    }, [
        isAuthenticated, bookingTypeFromFacility, selectedHours, bookingSelection, 
        facility, facilityId, preparePaymentMutation, navigate, location, t, langPath
    ]);

    const isSummaryActive = useMemo(() => {
        if (!facility) return false;
        if (bookingTypeFromFacility === 'entry_fee') return !!bookingSelection.date;
        return !!bookingSelection.date && bookingSelection.slots.length > 0;
    }, [facility, bookingTypeFromFacility, bookingSelection]);

    const finalSubmitDisabled = preparePaymentMutation.isLoading;

    const renderSubscriptionButton = () => {
        if (facility && bookingTypeFromFacility && bookingTypeFromFacility !== 'entry_fee' && 
            !(isSummaryActive && bookingSelection.slots.length > 0) ) { // Не показывать, если уже выбраны слоты для почасовой
            return ( 
                <div className={styles.subscriptionButtonContainerMoved}> 
                    <Link 
                        to={langPath(`/facilities/${facilityId}/subscribe`)} 
                        className={styles.subscriptionButton} 
                        title={t('facility_detail.subscribe_button_title')} 
                    > 
                        <i className="fas fa-calendar-check"></i> {t('facility_detail.subscribe_button')} 
                    </Link> 
                </div> 
            );
        }
        return null;
    };
    
    if (isLoading) return <div className={styles.container}><LoadingSpinner text={t('common.loading_facility')} /></div>;
    if (isError) return <div className={styles.container}><p className={styles.errorMessage}>{t('errors.facility_load_error')} {facilityLoadingError?.response?.data?.detail || facilityLoadingError?.message || ''}</p></div>;
    if (!facility) return <div className={styles.container}><p>{t('common.facility_not_found')}</p></div>;

    const placeholderCampus = '/images/placeholders/placeholder-campus.png';
    const placeholderFacility = '/images/placeholders/placeholder-facility.png';

    return (
        <div className={styles.pageWrapper}>
            <div className={styles.pageHeader}>
                <div className={styles.container}>
                    <div className={styles.breadcrumbs}>
                        <Link to={langPath('/')} className={styles.breadcrumbLink}>{t('footer.home')}</Link>
                        <span>/</span>
                        <Link to={langPath('/facilities')} className={styles.breadcrumbLink}>{t('nav.facilities')}</Link>
                        <span>/</span> {facility.name}
                    </div>
                </div>
            </div>
            <div className={styles.container}>
                <div className={styles.bookingContainer}>
                    <div className={styles.facilityColumn}>
                        <div className={styles.facilitySection}>
                             <div className={styles.imageSection}>
                                {currentActiveImage ? (
                                    <img
                                        src={currentActiveImage}
                                        alt={t('facility_detail.image_alt', { name: facility.name })}
                                        className={styles.mainImage}
                                        onClick={() => openLightbox(galleryImages.findIndex(img => img.image === currentActiveImage))}
                                        onError={(e) => handleImageError(e, placeholderCampus)}
                                    />
                                ) : (
                                    <div className={styles.noImage}>{t('facility_detail.no_main_image')}</div>
                                )}
                                {galleryImages.length > 1 && (
                                    <div className={styles.thumbnailsContainer}>
                                        {galleryImages.map((imgData, index) => (
                                            <div
                                                key={imgData.id || `thumb-${index}`} // Используем imgData.id
                                                className={clsx(
                                                    styles.thumbnail,
                                                    currentActiveImage === imgData.image && styles.thumbnailActive
                                                )}
                                                onClick={() => setCurrentActiveImage(imgData.image)}
                                            >
                                                <img
                                                    src={imgData.image}
                                                    alt={t('facility_detail.thumb_alt', { index: index + 1 })}
                                                    className={styles.thumbnailImage}
                                                    onError={(e) => handleImageError(e, placeholderFacility)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                             </div>
                             <div className={styles.detailsSection}>
                                <h1 className={styles.detailsTitle}>{facility.name}</h1>
                                {facility.university && (
                                    <Link to={langPath(`/universities/${facility.university.id}`)} className={styles.uniLink}>
                                        <i className="fas fa-university"></i>{facility.university.name}
                                    </Link>
                                )}
                                <p className={styles.description}>{facility.description || t('facility_detail.no_description')}</p>
                                
                                {bookingTypeFromFacility && (
                                    <div className={styles.bookingTypeInfo}>
                                        <i className={clsx("fas", 
                                            bookingTypeFromFacility === 'overlapping_slot' ? 'fa-users' : 
                                            (bookingTypeFromFacility === 'entry_fee' ? 'fa-ticket-alt' : 'fa-lock')
                                        )}></i>
                                        <span>{t('facility_detail.info.booking_type')}: <strong>{bookingTypeDisplay}</strong></span>
                                        {bookingTypeFromFacility === 'overlapping_slot' && facility.max_capacity && (
                                            <span className={styles.capacityInfo}>
                                                ({t('facility_detail.info.capacity_prefix')} {facility.max_capacity} {t('facility_detail.info.capacity_suffix')})
                                            </span>
                                        )}
                                    </div>
                                )}

                                {facility.amenities?.length > 0 && (
                                    <>
                                        <h3 className={styles.sectionHeading}>{t('facility_detail.amenities_title')}</h3>
                                        <div className={styles.amenitiesGrid}>
                                            {facility.amenities.map(am => (
                                                <div key={am.id} className={styles.amenityItem}>
                                                    <i className={clsx(am.icon_class || 'fas fa-check', styles.amenityIcon)}></i>
                                                    <span>{t(`amenity.${am.name.toLowerCase().replace(/\s+/g,'_')}`, am.name)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                                <div className={styles.infoGrid}>
                                     {facility.open_time && (<div className={styles.infoItem}><span className={styles.infoLabel}>{t('facility_detail.info.working_hours')}</span><span className={styles.infoValue}><i className={clsx("far fa-clock", styles.infoValueIcon)}></i>{formatTime(facility.open_time)} - {formatTime(facility.close_time)} ({workingDaysDisplay || ''})</span></div>)}
                                     <div className={styles.infoItem}><span className={styles.infoLabel}>{bookingTypeFromFacility === 'entry_fee' ? t('facility_detail.info.entry_price') : t('facility_detail.info.price')}</span><span className={styles.infoValue}><i className={clsx("fas fa-tags", styles.infoValueIcon)}></i>{pricePerHourOrEntry.isNaN() ? '-' : pricePerHourOrEntry.toDecimalPlaces(0).toLocaleString()} {t('common.currency')}</span></div>
                                     {facility.size && (<div className={styles.infoItem}><span className={styles.infoLabel}>{t('facility_detail.info.size')}</span><span className={styles.infoValue}><i className={clsx("fas fa-ruler", styles.infoValueIcon)}></i>{facility.size}</span></div>)}
                                     {facility.contact_phone && (<div className={styles.infoItem}><span className={styles.infoLabel}>{t('facility_detail.info.phone')}</span><span className={styles.infoValue}><i className={clsx("fas fa-phone", styles.infoValueIcon)}></i>{facility.contact_phone}</span></div>)}
                                     {facility.location_details && (<div className={styles.infoItem}><span className={styles.infoLabel}>{t('facility_detail.info.location')}</span><span className={styles.infoValue}><i className={clsx("fas fa-map-marker-alt", styles.infoValueIcon)}></i>{facility.location_details}</span></div>)}
                                     {facility.responsible_person_details && (<div className={styles.infoItem}><span className={styles.infoLabel}>{t('facility_detail.info.responsible')}</span><span className={styles.infoValue}><i className={clsx("fas fa-user-tie", styles.infoValueIcon)}></i>{facility.responsible_person_details}</span></div>)}
                                </div>
                            </div>
                        </div>
                        
                        {bookingTypeFromFacility !== 'entry_fee' ? (
                            <div className={clsx(styles.facilitySection, styles.facilitySectionPadding, styles.facilitySectionOverflowVisible)}>
                                <h3 className={styles.sectionHeading}>{t('facility_detail.hourly_booking_title')}</h3>
                                <BookingScheduler
                                    facilityId={facilityId}
                                    onSelectionChange={handleBookingSelectionChange}
                                    initialDate={dayjs(bookingSelection.date)}
                                    facilityBookingType={bookingTypeFromFacility}
                                />
                                {renderSubscriptionButton()}
                            </div>
                        ) : (
                            <div className={clsx(styles.facilitySection, styles.facilitySectionPadding)}>
                                <h3 className={styles.sectionHeading}>{t('facility_detail.entry_fee_title')}</h3>
                                <p className={styles.entryFeeDescription}>{t('facility_detail.entry_fee_desc')}</p>
                                <div className={styles.datePickerContainer}>
                                    <label htmlFor="entry-date" className={styles.datePickerLabel}>{t('facility_detail.entry_date_label')}</label>
                                    <input
                                        type="date"
                                        id="entry-date"
                                        value={bookingSelection.date}
                                        min={dayjs().format('YYYY-MM-DD')}
                                        onChange={(e) => handleBookingSelectionChange({ date: e.target.value, slots: [] })}
                                        className={styles.datePickerInput}
                                    />
                                </div>
                            </div>
                        )}
                        
                        {/* CTA панель теперь всегда в потоке facilityColumn */}
                        <div className={clsx(styles.orderActionPanel, styles.orderActionPanelInFlow, isSummaryActive && styles.orderActionPanelVisible)}> 
                            <div className={styles.orderActionPanelContent}> 
                                <div className={styles.totalPriceLarge}> 
                                    <span>{t('facility_detail.summary.total')}</span> 
                                    <span>{totalPrice.isNaN() ? '0' : totalPrice.toDecimalPlaces(0).toLocaleString()} {t('common.currency')}</span> 
                                </div> 
                                <button 
                                    className={styles.paymentButtonLarge} 
                                    onClick={handleInitiatePayment}
                                    disabled={finalSubmitDisabled || !isSummaryActive}
                                    title={ !isAuthenticated ? t('facility_detail.login_to_book_title') : (!isSummaryActive ? (bookingTypeFromFacility === 'entry_fee' ? t('facility_detail.select_date_title_entry') : t('facility_detail.select_time_title')) : t('facility_detail.confirm_button_title')) } 
                                > 
                                    {preparePaymentMutation.isLoading ? ( <LoadingSpinner size="1em" color="#fff" text="" display="inline" /> ) : ( <i className={`fas fa-arrow-right`}></i> )}
                                    {preparePaymentMutation.isLoading ? t('common.processing') : isAuthenticated ? t('facility_detail.confirm_button') : t('facility_detail.login_to_book_button') } 
                                </button> 
                                {!isAuthenticated && isSummaryActive && ( <small className={styles.loginPromptPanel}> <Link to={langPath('/login')} state={{ from: location }}>{t('facility_detail.login_prompt_link')}</Link>, {t('facility_detail.login_prompt_text')} </small> )} 
                            </div> 
                        </div>
                    </div>

                    <div className={styles.summaryWrapper}> 
                        <div className={styles.orderInfoSummary}> 
                            <h3 className={styles.summaryTitle}>{t('facility_detail.summary.title')}</h3> 
                            {isSummaryActive ? ( 
                                <div className={styles.summaryDetails}> 
                                    <div className={styles.summaryItem}><span className={styles.summaryLabel}>{t('facility_detail.summary.object')}</span><span className={styles.summaryValue}>{facility.name}</span></div> 
                                    <div className={styles.summaryItem}><span className={styles.summaryLabel}>{t('facility_detail.summary.university')}</span><span className={styles.summaryValue}>{facility.university?.short_name || facility.university?.name || '-'}</span></div> 
                                    <div className={styles.summaryItem}><span className={styles.summaryLabel}>{t('facility_detail.summary.date')}</span><span className={styles.summaryValue}>{bookingSelection.date ? dayjs(bookingSelection.date).locale(currentLang).format('D MMMM YYYY') : '---'}</span></div> 
                                    {bookingTypeFromFacility !== 'entry_fee' && ( 
                                        <> 
                                            <div className={styles.summaryItem}> <span className={styles.summaryLabel}>{t('facility_detail.summary.time')}</span> <span className={styles.summaryValue}> {formatSelectedTimeForSummary(bookingSelection.slots)} </span> </div> 
                                            <div className={styles.summaryItem}><span className={styles.summaryLabel}>{t('facility_detail.summary.hours')}</span><span className={styles.summaryValue}>{selectedHours}</span></div> 
                                        </> 
                                    )} 
                                </div> 
                            ) : ( 
                                <div className={styles.summaryPlaceholder}> 
                                    <i className="fas fa-info-circle"></i> 
                                    <p> {bookingTypeFromFacility === 'entry_fee' ? t('facility_detail.summary.placeholder_select_date') : t('facility_detail.summary.placeholder_select_options')} </p> 
                                </div> 
                            )} 
                        </div> 
                    </div>
                </div>
            </div>
            <Lightbox 
                open={lightboxOpen} 
                close={() => setLightboxOpen(false)} 
                slides={lightboxSlides} 
                index={lightboxIndex} 
                // plugins={[Fullscreen, Zoom]} // Опционально
                styles={{ container: { backgroundColor: "rgba(0, 0, 0, .85)" } }}
            />
        </div>
    );
};
export default FacilityDetailPage;
// --- END OF FULL MODIFIED frontend/src/pages/FacilityDetailPage.jsx ---