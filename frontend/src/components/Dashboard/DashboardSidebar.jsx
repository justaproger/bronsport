// --- START OF FULL FILE frontend/src/components/Dashboard/DashboardSidebar.jsx ---
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/authSlice';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { handleImageError } from '../../utils/helpers';
import styles from './DashboardSidebar.module.css';

const DashboardSidebar = ({ closeMobileSidebar, isMobileView }) => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  const handleLogout = () => {
    dispatch(logout());
    closeMobileSidebar?.();
    navigate(`/${currentLang}/login`);
  };

  const handleLinkClick = () => {
      if (isMobileView) { closeMobileSidebar?.(); }
  };

  const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;
  const placeholderAvatar = '/images/placeholders/placeholder-avatar.png';

  return (
    <aside className={styles.sidebar}>
       {isMobileView && (
            <div className={styles.mobileHeader}>
                <span>{t('dashboard.navigation', 'Навигация')}</span>
                <button onClick={closeMobileSidebar} className={styles.closeButton} aria-label={t('common.close', 'Закрыть')}>
                    <i className="fas fa-times"></i>
                </button>
            </div>
       )}
      <div className={styles.header}>
        <img
            src={user?.avatar || placeholderAvatar}
            alt={t('dashboard.avatar_alt', 'Аватар пользователя')}
            className={styles.avatar}
            onError={(e) => handleImageError(e, placeholderAvatar)}
         />
        <div className={styles.userInfo}>
          <div className={styles.userName} title={user?.email}>
            {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : t('common.loading', 'Загрузка...')}
          </div>
          <div className={styles.userEmail}>
            {user?.email}
          </div>
        </div>
      </div>
      <nav className={styles.menu}>
        <NavLink to={langPath('/dashboard')} end className={({ isActive }) => clsx(styles.menuItem, isActive && styles.menuItemActive)} onClick={handleLinkClick} >
            <i className={clsx("fas fa-tachometer-alt", styles.menuIcon)}></i>
            <span>{t('dashboard.menu_dashboard', 'Дашборд')}</span>
        </NavLink>
        {/* --- ИЗМЕНЕНИЕ: Обновляем путь и текст --- */}
        <NavLink to={langPath('/dashboard/active-orders')} className={({ isActive }) => clsx(styles.menuItem, isActive && styles.menuItemActive)} onClick={handleLinkClick} >
            <i className={clsx("fas fa-calendar-check", styles.menuIcon)}></i> {/* Иконка подходит */}
            <span>{t('dashboard.menu_my_active_orders', 'Активные заказы')}</span> {/* TODO: Добавить перевод 'dashboard.menu_my_active_orders' */}
        </NavLink>
        <NavLink to={langPath('/dashboard/order-history')} className={({ isActive }) => clsx(styles.menuItem, isActive && styles.menuItemActive)} onClick={handleLinkClick} >
            <i className={clsx("fas fa-history", styles.menuIcon)}></i>
            <span>{t('dashboard.menu_order_history', 'История заказов')}</span> {/* TODO: Добавить перевод 'dashboard.menu_order_history' */}
        </NavLink>
        {/* ------------------------------------ */}
        <NavLink to={langPath('/dashboard/subscriptions')} className={({ isActive }) => clsx(styles.menuItem, isActive && styles.menuItemActive)} onClick={handleLinkClick} >
            <i className={clsx("fas fa-sync-alt", styles.menuIcon)}></i>
            <span>{t('dashboard.menu_subscriptions', 'Подписки')}</span>
        </NavLink>
        <NavLink to={langPath('/dashboard/profile')} className={({ isActive }) => clsx(styles.menuItem, isActive && styles.menuItemActive)} onClick={handleLinkClick} >
            <i className={clsx("fas fa-user", styles.menuIcon)}></i>
            <span>{t('dashboard.menu_profile', 'Профиль')}</span>
        </NavLink>
         <div onClick={handleLogout} className={styles.logoutButton} role="button" tabIndex={0} onKeyDown={(e) => {if(e.key === 'Enter' || e.key === ' ') handleLogout();}} >
            <i className={clsx("fas fa-sign-out-alt", styles.menuIcon)}></i>
            <span>{t('header.logout_button', 'Выйти')}</span> {/* Используем существующий перевод */}
        </div>
      </nav>
    </aside>
  );
};

export default DashboardSidebar;
// --- END OF FULL FILE ---