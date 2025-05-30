import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import { fetchMyUnifiedOrders, fetchUserDashboardStats } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';
import OrderItemCard from '../Bookings/OrderItemCard'; // Используем универсальную карточку
import styles from './DashboardHome.module.css';

const DashboardHome = () => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;

    const { 
        data: statsData, 
        isLoading: isLoadingStats,
        isError: isErrorStats,
        error: errorStats 
    } = useQuery({
        queryKey: ['userDashboardStats'],
        queryFn: fetchUserDashboardStats,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Параметры для "предстоящих" заказов (включая подписки)
    const upcomingOrdersParams = useMemo(() => ({
        status_group: 'active', // Бэкенд должен корректно фильтровать активные/предстоящие
        page_size: 3, 
        ordering: 'sortable_datetime_start', // Сортировка по дате начала события
    }), []);

    const {
        data: upcomingOrdersData,
        isLoading: isLoadingBookings,
        isFetching: isFetchingBookings,
        isError: isErrorBookings,
        error: errorBookings,
    } = useQuery({
        // Убедимся, что ключ уникален и включает все параметры
        queryKey: ['myUnifiedOrders', 'dashboard_upcoming', upcomingOrdersParams], 
        queryFn: () => fetchMyUnifiedOrders({ queryKey: ['myUnifiedOrders', upcomingOrdersParams] }),
        staleTime: 2 * 60 * 1000,
        retry: 1,
        keepPreviousData: true,
    });

    const upcomingOrders = useMemo(() => upcomingOrdersData?.results || [], [upcomingOrdersData]);
    const totalUpcomingForDisplay = useMemo(() => upcomingOrdersData?.count ?? 0, [upcomingOrdersData]);

    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    return (
        <div className={styles.container}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.title}>{t('dashboard.home_title', 'Дашборд')}</h2>
                <Link to={langPath('/facilities')} className={styles.button}>
                    <i className="fas fa-plus"></i>
                    {t('dashboard.new_booking_button', 'Новое бронирование')}
                </Link>
            </div>

            {isLoadingStats && !statsData && (
                <div className={styles.statsLoading}><LoadingSpinner text={t('common.loading_stats', 'Загрузка статистики...')} size="20px"/></div>
            )}
            {isErrorStats && (
                <div className={clsx(styles.statsError, styles.errorMessage)}>
                    {t('errors.stats_loading_error', 'Не удалось загрузить статистику')}: {errorStats?.message || ''}
                </div>
            )}
            {!isLoadingStats && statsData && (
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={clsx(styles.statIcon, styles.iconBlue)}> <i className="fas fa-calendar-check"></i> </div>
                        <div className={styles.statText}> <div className={styles.statTitle}>{t('dashboard.stats_active_orders', 'Активные заказы')}</div> <div className={styles.statValue}>{statsData.active_orders_count ?? '-'}</div> </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={clsx(styles.statIcon, styles.iconGreen)}> <i className="fas fa-history"></i> </div>
                        <div className={styles.statText}> <div className={styles.statTitle}>{t('dashboard.stats_total_orders', 'Всего заказов')}</div> <div className={styles.statValue}>{statsData.total_orders_count ?? '-'}</div> </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={clsx(styles.statIcon, styles.iconPurple)}> <i className="fas fa-sync-alt"></i> </div>
                        <div className={styles.statText}> <div className={styles.statTitle}>{t('dashboard.stats_active_subscriptions', 'Активные подписки')}</div> <div className={styles.statValue}>{statsData.active_subscriptions_count ?? '-'}</div> </div>
                    </div>
                </div>
             )}

          <div className={styles.bookingsSection}>
            <h3 className={styles.bookingsTitle}>{t('dashboard.upcoming_bookings_title', 'Предстоящие заказы')}</h3>
            {(isLoadingBookings && !upcomingOrdersData) && <div className={styles.bookingsLoading}><LoadingSpinner text={t('common.loading_bookings', 'Загрузка заказов...')} /></div>}
            {isErrorBookings && !isFetchingBookings && (
                <p className={styles.errorMessage}> {t('errors.bookings_loading_error', 'Ошибка загрузки заказов:')} {errorBookings?.response?.data?.detail || errorBookings?.message || ''} </p>
            )}
            {!isLoadingBookings && upcomingOrders.length === 0 && !isErrorBookings && (
                 <p className={styles.noBookingsMessage}>{t('dashboard.no_upcoming_bookings', 'Нет предстоящих заказов.')}</p>
            )}
            {!isLoadingBookings && upcomingOrders.length > 0 && (
                <div className={styles.bookingList}>
                    {(isFetchingBookings && upcomingOrdersData) && ( 
                        <div className={styles.fetchingIndicator}> <LoadingSpinner size="18px" text="" display="inline" /> {t('common.updating', 'Обновление...')} </div>
                    )}
                    {upcomingOrders.map(order => (
                        <OrderItemCard key={`${order.order_type}-${order.id}`} order={order} />
                    ))}
                    {totalUpcomingForDisplay > upcomingOrders.length && (
                        <div className={styles.viewAllLinkContainer}>
                             <Link to={langPath('/dashboard/active-orders')} className={styles.viewAllLink}>
                                 {t('dashboard.view_all_active_link', 'Смотреть все активные')} ({totalUpcomingForDisplay})
                             </Link>
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>
        );
    };

export default DashboardHome;