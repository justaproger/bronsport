// --- START OF FULL FILE frontend/src/components/Universities/ClubCard.jsx ---
import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next'; // <-- Импорт
import { handleImageError } from '../../utils/helpers.jsx';
import styles from './ClubCard.module.css'; // Стили

const ClubCard = ({ club }) => {
   const { t } = useTranslation(); // <-- Получаем t

    // Заглушки и данные
    const placeholderClub = '/images/placeholders/placeholder-club.png';
    const imageUrl = club?.image || placeholderClub;
    // Определяем имя тренера
    const coachDisplay = club?.coach_full_name // Из связанного объекта Staff
                        || club?.coach_name_manual // Из текстового поля
                        || t('common.coach_not_specified', 'Не указан'); // Заглушка
    const clubName = club?.name || t('common.club_name_placeholder', 'Название кружка');
    const sportType = club?.sport_type || t('common.sport_type_placeholder', 'Вид спорта');
    const description = club?.description || t('club_card.default_description', 'Описание спортивного кружка или секции...');
    const scheduleInfo = club?.schedule_info;
    const contactInfo = club?.contact_info;

   return (
       <div className={styles.card}>
            <img
                src={imageUrl}
                alt={t('club_card.image_alt', 'Изображение кружка {{name}}', { name: clubName })} // Перевод alt
                className={styles.image}
                loading="lazy"
                onError={(e) => handleImageError(e, placeholderClub)}
            />
           <div className={styles.details}>
                <h4 className={styles.name}>
                    <i className={clsx(club?.icon_class || 'fas fa-users', styles.nameIcon)}></i>
                    {/* Название и вид спорта */}
                    <span>{clubName} ({sportType})</span>
                </h4>
               <p className={styles.description}>{description}</p>

               {/* Секция с информацией */}
               <div className={styles.infoSection}>
                    {scheduleInfo && (
                        <div className={styles.schedule}>
                            <i className="far fa-calendar-alt"></i>
                            {/* Используем t() */}
                            <span><strong>{t('club_card.schedule_label', 'Расписание:')}</strong> {scheduleInfo}</span>
                        </div>
                    )}
                    <div className={styles.infoItem}>
                        <i className="fas fa-user-tie"></i>
                         {/* Используем t() */}
                        <span>{t('club_card.coach_label', 'Тренер:')} {coachDisplay}</span>
                    </div>
                    {contactInfo && (
                        <div className={styles.infoItem}>
                            <i className="fas fa-phone"></i>
                             {/* Используем t() */}
                             <span>{t('club_card.contact_label', 'Контакт:')} {contactInfo}</span>
                        </div>
                    )}
                </div>
           </div>
       </div>
   );
};

export default ClubCard;
// --- END OF FULL FILE ---