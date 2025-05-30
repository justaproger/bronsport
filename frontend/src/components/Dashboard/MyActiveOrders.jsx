import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import { fetchMyUnifiedOrders } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner.jsx';
import Pagination from '../Common/Pagination.jsx';
import OrderItemCard from '../Bookings/OrderItemCard'; 
import styles from './MyActiveOrders.module.css';

const MyActiveOrders = () => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;

    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const queryParams = useMemo(() => ({
        page,
        page_size: PAGE_SIZE,
        status_group: 'active',
        ordering: '-created_at', // Или 'sortable_datetime_start' для сортировки по дате события
    }), [page]);

    const {
        data: unifiedOrdersData,
        isLoading,
        isError,
        error,
        isFetching
    } = useQuery({
        queryKey: ['myUnifiedOrders', 'active_list_page', queryParams], // Уникальный ключ
        queryFn: () => fetchMyUnifiedOrders({ queryKey: ['myUnifiedOrders', queryParams] }),
        keepPreviousData: true,
        staleTime: 1 * 60 * 1000,
        retry: 1,
    });

    const ordersList = useMemo(() => unifiedOrdersData?.results || [], [unifiedOrdersData]);
    const totalOrders = useMemo(() => unifiedOrdersData?.count ?? 0, [unifiedOrdersData]);
    const totalPages = Math.ceil(totalOrders / PAGE_SIZE);

    const handlePageChange = useCallback((newPage) => {
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    let content;
    if (isLoading && !unifiedOrdersData) {
        content = (
            <div className={styles.messageContainer}>
                <LoadingSpinner text={t('common.loading_bookings', 'Загрузка активных заказов...')} />
            </div>
        );
    } else if (isError && !isFetching) {
        content = (
            <div className={clsx(styles.messageContainer, styles.errorMessage)}>
                {t('errors.bookings_loading_error', 'Ошибка загрузки заказов:')} {error?.response?.data?.detail || error?.message || ''}
            </div>
        );
    } else if (ordersList.length === 0 && !isLoading && !isFetching) {
        content = (
            <div className={clsx(styles.messageContainer, styles.noBookingsMessage)}>
                {t('my_bookings.no_active_orders_yet', 'У вас пока нет активных заказов.')}
            </div>
        );
    } else {
        content = (
            <div className={styles.bookingList}>
                {(isFetching && !isLoading) && (
                    <div className={styles.loadingIndicator}>
                        <LoadingSpinner size="20px" text="" display="inline" /> {t('common.updating', 'Обновление...')}
                    </div>
                 )}
                {ordersList.map(order => (
                    <OrderItemCard key={`${order.order_type}-${order.id}`} order={order} />
                ))}
            </div>
        );
    }

    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    return (
        <>
            <div className={styles.sectionHeader}>
                <h2 className={styles.title}>{t('my_bookings.title_active', 'Мои активные заказы')}</h2> 
                 <div className={styles.controlsContainer}>
                    <Link to={langPath('/facilities')} className={styles.newBookingButton}>
                        <i className="fas fa-plus"></i> {t('dashboard.new_booking_button', 'Новое бронирование')}
                    </Link>
                 </div>
            </div>
            {content}
            {!isError && totalPages > 0 && !(isLoading && !unifiedOrdersData) && (
                <div className={styles.paginationContainer}>
                     <Pagination
                        currentPage={page}
                        totalCount={totalOrders}
                        pageSize={PAGE_SIZE}
                        onPageChange={handlePageChange}
                    />
                </div>
             )}
        </>
    );
};

export default MyActiveOrders;