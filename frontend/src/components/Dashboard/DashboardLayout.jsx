// --- START OF FULL FILE frontend/src/components/Dashboard/DashboardLayout.jsx ---
import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next'; // <-- Импорт
import DashboardSidebar from './DashboardSidebar';
import styles from './DashboardLayout.module.css';

const DashboardLayout = () => {
  const { t } = useTranslation(); // <-- Получаем функцию перевода
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(prev => !prev);
  }, []);

  // Закрытие сайдбара при смене URL
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location]);

  // Блокировка/разблокировка скролла body
  useEffect(() => {
    if (isMobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileSidebarOpen]);

  return (
    <div className={styles.layoutContainer}>
      {/* Кнопка для открытия мобильного сайдбара */}
      <button
        className={styles.mobileSidebarToggle}
        onClick={toggleMobileSidebar}
        // Используем перевод для aria-label
        aria-label={t('dashboard.toggle_sidebar_label', 'Открыть/закрыть меню навигации')}
        aria-expanded={isMobileSidebarOpen}
        aria-controls="dashboardSidebar"
      >
        <i className={clsx("fas", isMobileSidebarOpen ? "fa-times" : "fa-bars")}></i> {/* Иконка меняется */}
      </button>

      {/* Сайдбар */}
      <div
        id="dashboardSidebar"
        className={clsx(styles.sidebarWrapper, isMobileSidebarOpen && styles.sidebarWrapperVisible)}
        aria-hidden={!isMobileSidebarOpen}
      >
        {/* Передаем функцию закрытия */}
        <DashboardSidebar closeMobileSidebar={toggleMobileSidebar} isMobileView={isMobileSidebarOpen} />
      </div>

      {/* Оверлей */}
      {isMobileSidebarOpen && <div className={styles.mobileSidebarOverlay} onClick={toggleMobileSidebar}></div>}

      {/* Основной контент */}
      <main className={styles.content}>
        <Outlet /> {/* Дочерние страницы дашборда */}
      </main>
    </div>
  );
};

export default DashboardLayout;
// --- END OF FULL FILE ---