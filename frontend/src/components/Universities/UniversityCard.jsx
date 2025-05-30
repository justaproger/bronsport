// --- START OF FULL FILE frontend/src/components/Universities/UniversityCard.jsx ---
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // <-- Импорт
import { handleImageError } from '../../utils/helpers.jsx';
import styles from './UniversityCard.module.css'; // Импорт стилей

const UniversityCard = ({ university }) => {
    const { t, i18n } = useTranslation(); // <-- Получаем t и i18n
    const currentLang = i18n.language; // Текущий язык

    // Хелпер для пути
    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    // Заглушки и данные
    const placeholderLogo = '/images/placeholders/placeholder-logo.png';
    const placeholderCampus = '/images/placeholders/placeholder-campus.png';
    const logoUrl = university?.logo || placeholderLogo;
    const campusImageUrl = university?.campus_image || placeholderCampus;
    const universityName = university?.name || t('common.unknown_university', 'Университет неизвестен');
    const universityShortName = university?.short_name || '';
    const universityCity = university?.city || t('common.city_not_specified', 'Город не указан');
    const universityId = university?.id || '#'; // Для ссылки

    // Формируем полное имя с коротким названием в скобках, если оно есть
    const displayName = `${universityName}${universityShortName ? ` (${universityShortName})` : ''}`;

    return (
        // Ссылка на детальную страницу с учетом языка
        <Link to={langPath(`/universities/${universityId}`)} className={styles.cardLink}>
            <div className={styles.card}>
                <img
                    src={campusImageUrl}
                    // Используем t() для alt
                    alt={t('university_card.campus_image_alt', 'Кампус {{name}}', { name: universityName })}
                    className={styles.image}
                    loading="lazy"
                    onError={(e) => handleImageError(e, placeholderCampus)}
                />
                <div className={styles.logoContainer}>
                    <img
                        src={logoUrl}
                        // Используем t() для alt
                        alt={t('university_card.logo_alt', 'Логотип {{name}}', { name: universityShortName || universityName })}
                        className={styles.logo}
                        loading="lazy"
                        onError={(e) => handleImageError(e, placeholderLogo)}
                    />
                </div>
                <div className={styles.details}>
                    {/* Отображаем полное имя, title тоже полное имя */}
                    <h3 className={styles.name} title={displayName}>
                        {displayName}
                    </h3>
                    <div className={styles.location}>
                        <i className={`fas fa-map-marker-alt ${styles.locationIcon}`}></i>
                        <span>{universityCity}</span>
                    </div>
                    <div className={styles.footer}>
                        {/* Используем t() для кнопки */}
                        <span className={styles.detailsButton}>
                            {t('university_card.details_button', 'Подробнее')}
                            <i className="fas fa-arrow-right"></i>
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default UniversityCard;
// --- END OF FULL FILE ---