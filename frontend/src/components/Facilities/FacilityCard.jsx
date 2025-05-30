import React from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { formatTime, handleImageError } from '../../utils/helpers.jsx';
import styles from './FacilityCard.module.css';

const FacilityCard = ({ facility }) => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;

    const handleBookmarkClick = (e) => {
        e.preventDefault(); e.stopPropagation();
        console.log("Bookmark clicked for facility:", facility.id);
        const icon = e.currentTarget.querySelector('i');
        if (icon) { icon.classList.toggle('far'); icon.classList.toggle('fas'); }
    };

    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;
    const placeholderFacility = '/images/placeholders/placeholder-facility.png';
    const placeholderLogo = '/images/placeholders/placeholder-logo.png';
    const imageUrl = facility?.main_image || placeholderFacility;
    const uniLogoUrl = facility?.university?.logo || placeholderLogo;
    const universityDisplayName = facility?.university?.name || t('common.unknown_university', 'Университет неизвестен');
    const facilityDisplayName = facility?.name || t('common.unknown_facility', 'Название объекта');
    const facilityId = facility?.id || '#';
    const universityId = facility?.university?.id;
    const facilityDetailUrl = langPath(`/facilities/${facilityId}`);

    // --- ИЗМЕНЕНИЕ: Перевод типа объекта ---
    const facilityTypeDisplay = facility?.facility_type 
        ? t(`facility_type.${facility.facility_type}`, facility.facility_type) 
        : t('facility_type.other', 'Другое');
    // --- КОНЕЦ ИЗМЕНЕНИЯ ---

    return (
        <div className={styles.card}>
            <div className={styles.imageContainer}>
                 <Link to={facilityDetailUrl} className={styles.imageLinkWrapper}>
                    <img
                        src={imageUrl}
                        alt={t('facility_card.image_alt', { name: facilityDisplayName })}
                        className={styles.image}
                        loading="lazy"
                        onError={(e) => handleImageError(e, placeholderFacility)}
                    />
                 </Link>
                <button onClick={handleBookmarkClick} className={styles.bookmarkButton} title={t('facility_card.bookmark_button_title')} aria-label={t('facility_card.bookmark_button_title')} >
                    <i className="far fa-heart"></i>
                </button>
            </div>
            <div className={styles.details}>
                {/* --- ИЗМЕНЕНИЕ: Используем facilityTypeDisplay --- */}
                <span className={styles.type}>{facilityTypeDisplay}</span>
                {/* --- КОНЕЦ ИЗМЕНЕНИЯ --- */}
                 <Link to={facilityDetailUrl} className={styles.nameLink}>
                     <h3 className={styles.name} title={facilityDisplayName}>{facilityDisplayName}</h3>
                 </Link>
                <div className={styles.university}>
                     <img src={uniLogoUrl} alt={t('facility_card.logo_alt', { name: facility?.university?.short_name || universityDisplayName })} className={styles.universityLogo} onError={(e) => handleImageError(e, placeholderLogo)} />
                     {universityId ? (
                         <Link to={langPath(`/universities/${universityId}`)} className={styles.universityNameLink} title={universityDisplayName} >
                            <span>{universityDisplayName}</span>
                         </Link>
                     ) : ( <span title={universityDisplayName}>{universityDisplayName}</span> )}
                </div>
                 <div className={styles.meta}>
                    {facility?.open_time && facility?.close_time && ( <div className={styles.metaItem}> <i className={clsx("far fa-clock", styles.metaIcon)}></i> <span>{formatTime(facility.open_time)} - {formatTime(facility.close_time)}</span> </div> )}
                    {facility?.city && ( <div className={styles.metaItem}> <i className={clsx("fas fa-map-marker-alt", styles.metaIcon)}></i> <span>{facility.city}</span> </div> )}
                 </div>
                 <div className={styles.priceAndAction}>
                    <div className={styles.price}>
                        <span>{parseInt(facility?.price_per_hour || 0).toLocaleString()} {t('common.currency')} {t('common.per_hour')}</span> {/* Обновил ключ */}
                    </div>
                     <Link to={facilityDetailUrl} className={styles.detailsLinkButton}>
                         {t('common.details')} <i className="fas fa-arrow-right"></i>
                     </Link>
                 </div>
            </div>
        </div>
    );
};
export default FacilityCard;