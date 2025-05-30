// --- START OF FULL FILE frontend/src/pages/PaymentCancelledPage.jsx ---
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './PaymentCancelledPage.module.css'; // Создадим новые стили

const PaymentCancelledPage = () => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;

    // Хелпер для пути
    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.iconContainer}>
                    <i className="fas fa-times-circle"></i>
                </div>
                <h2 className={styles.title}>{t('payment_cancelled.title', 'Платеж отменен')}</h2>
                <p className={styles.message}>
                    {t('payment_cancelled.message', 'Вы отменили процесс оплаты. Ваше бронирование не было завершено.')}
                </p>
                <div className={styles.actions}>
                    <Link to={langPath('/facilities')} className={clsx(styles.button, styles.buttonPrimary)}>
                        <i className="fas fa-search"></i> {t('payment_cancelled.back_to_catalog', 'Вернуться в каталог')}
                    </Link>
                    <Link to={langPath('/')} className={clsx(styles.button, styles.buttonOutline)}>
                        <i className="fas fa-home"></i> {t('payment_cancelled.back_home', 'Вернуться на главную')}
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PaymentCancelledPage;
// --- END OF FULL FILE ---