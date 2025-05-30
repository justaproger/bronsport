// --- START OF FULL FILE frontend/src/pages/Info/AboutContent.jsx ---
import React from 'react';
import { useTranslation } from 'react-i18next';
// Стили можно импортировать из родителя или создать свои, если нужно
// import styles from './InfoPageLayout.module.css';

const AboutContent = () => {
  const { t } = useTranslation(); // <-- Получаем t

  return (
    // Используем React Fragment, т.к. стили применяются через родителя .contentArea
    <>
      <h2>{t('info_about.title', 'О Платформе UniSport')}</h2>
      <p>{t('info_about.p1', 'UniSport - это инновационная платформа, созданная для упрощения доступа к спортивной инфраструктуре университетов Узбекистана. Наша миссия — сделать спорт доступнее для студентов, преподавателей и всех желающих, предоставив удобный инструмент для поиска и бронирования спортивных объектов онлайн.')}</p>
      <h3>{t('info_about.advantages_title', 'Наши Преимущества:')}</h3>
      <ul>
        <li><strong>{t('info_about.advantages.li1_strong', 'Широкий выбор:')}</strong> {t('info_about.advantages.li1_text', 'Мы объединяем спортивные площадки, бассейны, залы и корты ведущих ВУЗов страны в одном месте.')}</li>
        <li><strong>{t('info_about.advantages.li2_strong', 'Удобное бронирование:')}</strong> {t('info_about.advantages.li2_text', 'Простой и интуитивно понятный интерфейс для выбора объекта, даты, времени и оформления брони или подписки.')}</li>
        <li><strong>{t('info_about.advantages.li3_strong', 'Доступность:')}</strong> {t('info_about.advantages.li3_text', 'Актуальная информация о расписании, ценах и доступности объектов в режиме реального времени.')}</li>
        <li><strong>{t('info_about.advantages.li4_strong', 'Для всех:')}</strong> {t('info_about.advantages.li4_text', 'Платформа открыта не только для университетского сообщества, но и для всех любителей спорта.')}</li>
      </ul>
      <p>{t('info_about.p2', 'Мы постоянно работаем над улучшением платформы, добавлением новых университетов и объектов, а также расширением функционала. Присоединяйтесь к UniSport и занимайтесь спортом с удовольствием!')}</p>
    </>
  );
};

export default AboutContent;
// --- END OF FULL FILE ---