import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import { fetchMySubscriptions } from '../../services/api'; 
import LoadingSpinner from '../Common/LoadingSpinner.jsx';
import Pagination from '../Common/Pagination.jsx';
import OrderItemCard from '../Bookings/OrderItemCard'; 
import styles from './Subscriptions.module.css'; 

const Subscriptions = () => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;
    const location = useLocation();

    const [page, setPage] = useState(1);
    
    const successMessageFromState = location.state?.successMessage;
    const successMessageKey = successMessageFromState 
        ? `subscriptions.success.${successMessageFromState.toLowerCase().replace(/[^a-z0-9_]/g, '_')}` 
        : null;

    const queryParams = useMemo(() => ({
        page,
        page_size: 10,
        ordering: '-created_at', // Сортируем подписки по дате создания (новые сначала)
                                 // или '-subscription_start_date' для сортировки по дате начала подписки
        // order_type: 'subscription' будет добавлен внутри fetchMySubscriptions
    }), [page]);

    const { 
        data: subscriptionsData, 
        isLoading, 
        isError, 
        error, 
        isFetching 
    } = useQuery({
        queryKey: ['mySubscriptions', queryParams], // Используем этот ключ, т.к. fetchMySubscriptions его ожидает
        queryFn: () => fetchMySubscriptions({ queryKey: ['mySubscriptions', queryParams] }),
        keepPreviousData: true,
        staleTime: 1 * 60 * 1000, 
        retry: 1,
    });

    const handlePageChange = useCallback((newPage) => {
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const subscriptionsList = subscriptionsData?.results || [];
    const totalSubscriptions = subscriptionsData?.count ?? 0;
    const pageSize = queryParams.page_size || 10;
    const totalPages = Math.ceil(totalSubscriptions / pageSize);

    let content;
    if (isLoading && !subscriptionsData) {
        content = <div className={styles.messageContainer}><LoadingSpinner text={t('common.loading_subscriptions', 'Загрузка подписок...')}/></div>;
    } else if (isError && !isFetching) {
        content = <div className={clsx(styles.messageContainer, styles.errorMessage)}>{t('errors.subscriptions_loading_error', 'Ошибка загрузки подписок:')} {error?.response?.data?.detail || error?.message || ''}</div>;
    } else if (subscriptionsList.length === 0 && !isLoading && !isFetching) {
        content = <div className={clsx(styles.messageContainer, styles.noDataMessage)}>{t('subscriptions.no_subscriptions', 'У вас нет оформленных подписок.')}</div>;
    } else {
        content = (
            <div className={styles.list}>
                {(isFetching && !isLoading) && (
                    <div className={styles.loadingIndicator}>
                        <LoadingSpinner size="20px" text="" display="inline" /> {t('common.updating', 'Обновление...')}
                    </div>
                )}
                {subscriptionsList.map(subscriptionOrder => (
                    <OrderItemCard key={subscriptionOrder.id} order={subscriptionOrder} /> // ID должен быть уникален для Order
                ))}
            </div>
        );
    }

    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    return (
        <>
            <div className={styles.sectionHeader}>
                <h2 className={styles.title}>{t('subscriptions.title', 'Мои подписки')}</h2>
                <Link to={langPath('/facilities')} className={styles.newButton}>
                    <i className="fas fa-plus"></i> {t('subscriptions.new_button', 'Оформить новую')}
                </Link>
            </div>

            {successMessageFromState && (
                <p className={styles.successMessage}>
                    {successMessageKey ? t(successMessageKey, successMessageFromState) : successMessageFromState}
                </p>
            )}
            {content}
            {!isError && totalPages > 1 && !(isLoading && !subscriptionsData) && (
                <div className={styles.paginationContainer}>
                     <Pagination
                        currentPage={page}
                        totalCount={totalSubscriptions}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                    />
                </div>
             )}
        </>
    );
};

export default Subscriptions;