import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import { fetchMyUnifiedOrders } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner.jsx';
import Pagination from '../Common/Pagination.jsx';
// --- ИЗМЕНЕНИЕ: Импортируем OrderItemCard ---
import OrderItemCard from '../Bookings/OrderItemCard';
// --- КОНЕЦ ИЗМЕНЕНИЯ ---
import styles from './OrderHistory.module.css'; // Стили остаются прежними

const OrderHistory = () => {
    const { t } = useTranslation();

    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const queryParams = useMemo(() => ({
        page,
        page_size: PAGE_SIZE,
        status_group: 'history',
        ordering: '-created_at', // Сначала более новые исторические записи
    }), [page]);

    const {
        data: unifiedOrdersData,
        isLoading,
        isError,
        error,
        isFetching
    } = useQuery({
        queryKey: ['myUnifiedOrders', 'history', queryParams], 
        queryFn: () => fetchMyUnifiedOrders({ queryKey: ['myUnifiedOrders', queryParams] }),
        keepPreviousData: true,
        staleTime: 5 * 60 * 1000,
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
    if (isLoading && !unifiedOrdersData) { // Показываем лоадер только при первой загрузке
        content = (
            <div className={styles.messageContainer}>
                <LoadingSpinner text={t('common.loading_history', 'Загрузка истории...')} />
            </div>
        );
    } else if (isError && !isFetching) {
        content = (
            <div className={clsx(styles.messageContainer, styles.errorMessage)}>
                {t('errors.history_loading_error', 'Ошибка загрузки истории:')} {error?.response?.data?.detail || error?.message || ''}
            </div>
        );
    } else if (ordersList.length === 0 && !isLoading && !isFetching) {
        content = (
            <div className={clsx(styles.messageContainer, styles.noBookingsMessage)}>
                {t('booking_history.no_history', 'История заказов пуста.')}
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
                {/* --- ИЗМЕНЕНИЕ: Используем OrderItemCard и передаем order --- */}
                {ordersList.map(order => (
                    <OrderItemCard key={`${order.order_type}-${order.id}`} order={order} />
                ))}
                {/* --- КОНЕЦ ИЗМЕНЕНИЯ --- */}
            </div>
        );
    }

    return (
        <>
            <div className={styles.sectionHeader}>
                <h2 className={styles.title}>{t('booking_history.title', 'История заказов')}</h2>
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

export default OrderHistory;