import React from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { formatTime, handleImageError } from '../../utils/helpers.jsx';
import styles from './FacilityCard.module.css'; // Используем общий CSS модуль

const FacilityListItem = ({ facility }) => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;
    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    const placeholderFacility = '/images/placeholders/placeholder-facility.png';
    const placeholderLogo = '/images/placeholders/placeholder-logo.png';
    const imageUrl = facility?.main_image || placeholderFacility;
    const uniLogoUrl = facility?.university?.logo || placeholderLogo;
    const universityDisplayName = facility?.university?.name || t('common.unknown_university');
    const facilityDisplayName = facility?.name || t('common.unknown_facility');
    const facilityId = facility?.id || '#';
    const universityId = facility?.university?.id;

    // --- ИЗМЕНЕНИЕ: Перевод типа объекта ---
    const facilityTypeDisplay = facility?.facility_type
        ? t(`facility_type.${facility.facility_type}`, facility.facility_type)
        : t('facility_type.other', 'Другое');
    // --- КОНЕЦ ИЗМЕНЕНИЯ ---

    return (
        <div className={styles.listItem}>
            <div className={styles.listItemImageContainer}>
                <Link to={langPath(`/facilities/${facilityId}`)} style={{ display: 'block', height: '100%' }}>
                    <img src={imageUrl} alt={t('facility_card.image_alt', { name: facilityDisplayName })} className={styles.image} loading="lazy" onError={(e) => handleImageError(e, placeholderFacility)} />
                </Link>
            </div>
            <div className={styles.listItemDetails}>
                <div className={styles.listItemHeader}>
                    <div className={styles.listItemInfo}>
                        {/* --- ИЗМЕНЕНИЕ: Используем facilityTypeDisplay --- */}
                        <span className={styles.type}>{facilityTypeDisplay}</span>
                        {/* --- КОНЕЦ ИЗМЕНЕНИЯ --- */}
                        <Link to={langPath(`/facilities/${facilityId}`)} className={styles.listItemNameLink}>
                            <h3 className={styles.name} title={facilityDisplayName}>{facilityDisplayName}</h3>
                        </Link>
                         <div className={styles.university}>
                             <img src={uniLogoUrl} alt={t('facility_card.logo_alt', { name: facility?.university?.short_name || universityDisplayName })} className={styles.universityLogo} onError={(e) => handleImageError(e, placeholderLogo)} />
                             {universityId ? ( <Link to={langPath(`/universities/${universityId}`)} className={styles.universityNameLink} title={universityDisplayName}> <span>{universityDisplayName}</span> </Link>
                             ) : ( <span title={universityDisplayName}>{universityDisplayName}</span> )}
                        </div>
                    </div>
                </div>
                 <div className={styles.listItemMeta}>
                    {facility?.open_time && facility?.close_time && ( <div className={styles.metaItem}> <i className={clsx("far fa-clock", styles.metaIcon)}></i> <span>{formatTime(facility.open_time)} - {formatTime(facility.close_time)}</span> </div> )}
                    {facility?.city && ( <div className={styles.metaItem}> <i className={clsx("fas fa-map-marker-alt", styles.metaIcon)}></i> <span>{facility.city}</span> </div> )}
                    {facility?.size && ( <div className={styles.metaItem}> <i className={clsx("fas fa-ruler", styles.metaIcon)}></i> <span>{facility.size}</span> </div> )}
                 </div>
                 <div className={styles.listItemActions}>
                    <div className={styles.listItemPrice}>
                        {parseInt(facility?.price_per_hour || 0).toLocaleString()} {t('common.currency')} {t('common.per_hour')}
                    </div>
                    <Link to={langPath(`/facilities/${facilityId}`)} className={styles.listItemButton}>
                         <i className="fas fa-calendar-plus"></i>
                         {t('facility_card.book_button')}
                    </Link>
                </div>
            </div>
        </div>
    );
};
export default FacilityListItem;