// --- START OF FULL FILE frontend/src/components/Common/NotFound.jsx ---
import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next'; // <-- Импорт
import styles from './NotFound.module.css'; // Стили

const NotFound = () => {
    const { t, i18n } = useTranslation(); // <-- Получаем t и i18n
    const currentLang = i18n.language; // Текущий язык
    const { isAuthenticated } = useSelector((state) => state.auth);

    // Определяем целевой URL и текст ссылки в зависимости от статуса аутентификации
    const linkTarget = isAuthenticated ? `/${currentLang}/dashboard` : `/${currentLang}/`;
    const linkTextKey = isAuthenticated ? 'not_found.back_dashboard' : 'not_found.back_home';
    const linkDefaultText = isAuthenticated ? 'Вернуться в Дашборд' : 'Вернуться на главную';

  return (
    <div className={styles.container}>
      <h1 className={styles.errorCode}>404</h1>
       {/* Используем t() */}
      <h2 className={styles.title}>{t('not_found.title', 'Страница не найдена')}</h2>
      <p className={styles.message}>{t('not_found.message', 'Извините, страница, которую вы ищете, не существует или была перемещена.')}</p>
      <Link to={linkTarget} className={styles.linkButton}>
        {t(linkTextKey, linkDefaultText)}
      </Link>
    </div>
  );
};

export default NotFound;
// --- END OF FULL FILE ---