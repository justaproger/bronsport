// src/components/Common/QRCodeModal.jsx
// --- START OF FULL FILE frontend/src/components/Common/QRCodeModal.jsx ---
import React from 'react';
import { useTranslation } from 'react-i18next';
import BookingQRCode from './BookingQRCode'; // Наш существующий компонент
import styles from './QRCodeModal.module.css';

const QRCodeModal = ({ isOpen, onClose, bookingCode, title }) => {
    const { t } = useTranslation();

    if (!isOpen) {
        return null;
    }

    return (
        <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="qrCodeModalTitle">
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3 id="qrCodeModalTitle" className={styles.title}>
                        {title || t('booking_confirmation.qr_code_title', 'Ваш QR-код для входа:')}
                    </h3>
                    <button onClick={onClose} className={styles.closeButton} aria-label={t('common.close', 'Закрыть')}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className={styles.content}>
                    {bookingCode ? (
                        <BookingQRCode bookingCode={bookingCode} size={256} />
                    ) : (
                        <p>{t('common.not_available', 'Код недоступен')}</p>
                    )}
                    <p className={styles.hint}>
                        {t('booking_confirmation.qr_code_hint', 'Предъявите этот QR-код администратору объекта для подтверждения вашего заказа.')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default QRCodeModal;
// --- END OF FULL FILE ---