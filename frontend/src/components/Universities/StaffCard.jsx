// --- START OF FULL FILE frontend/src/components/Universities/StaffCard.jsx ---
import React from 'react';
import { useTranslation } from 'react-i18next'; // <-- Импорт
import { handleImageError } from '../../utils/helpers.jsx';
import styles from './StaffCard.module.css'; // Стили

const StaffCard = ({ member }) => {
    const { t } = useTranslation(); // <-- Получаем t

    // Заглушки и данные
    const placeholderAvatar = '/images/placeholders/placeholder-avatar.png';
    const photoUrl = member?.photo || placeholderAvatar;
    const fullName = member?.full_name || t('common.name_not_specified', 'Имя не указано');
    const position = member?.position || t('common.position_not_specified', 'Должность не указана');
    const bio = member?.bio || t('staff_card.default_bio', 'Краткая информация о сотруднике...');

    return (
        <div className={styles.card}>
            <div className={styles.imageContainer}>
                <img
                    src={photoUrl}
                    // Используем t() для alt
                    alt={t('staff_card.photo_alt', 'Фото сотрудника {{name}}', { name: fullName })}
                    className={styles.image}
                    loading="lazy"
                    onError={(e) => handleImageError(e, placeholderAvatar)}
                />
            </div>
            <div className={styles.details}>
                <h3 className={styles.name}>{fullName}</h3>
                <p className={styles.position}>{position}</p>
                <p className={styles.bio}>{bio}</p>

                {/* Контакты */}
                {(member?.phone || member?.email) && (
                    <div className={styles.contactContainer}>
                        {member.phone && (
                            <a href={`tel:${member.phone.replace(/\s/g, '')}`} className={styles.contactItem} title={t('staff_card.call_tooltip', 'Позвонить {{name}}', { name: member.phone })}>
                                <i className={`fas fa-phone ${styles.contactIcon}`}></i>
                                <span>{member.phone}</span>
                            </a>
                        )}
                        {member.email && (
                            <a href={`mailto:${member.email}`} className={styles.contactItem} title={t('staff_card.email_tooltip', 'Написать {{name}}', { name: member.email })}>
                                <i className={`fas fa-envelope ${styles.contactIcon}`}></i>
                                <span>{member.email}</span>
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffCard;
// --- END OF FULL FILE ---