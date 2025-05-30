// src/components/Common/BookingQRCode.jsx
import React from 'react';
import { QRCodeCanvas } from 'qrcode.react'; // Импортируем именованный экспорт

const BookingQRCode = ({ bookingCode, size = 150, level = "L", includeMargin = true, className = '' }) => {
    if (!bookingCode) {
        return <div className={className}>Код бронирования отсутствует.</div>; // Или null
    }

    return (
        <div className={className} style={{ display: 'inline-block' }}> {/* Контейнер для QR */}
            <QRCodeCanvas
                value={bookingCode} // Данные для кодирования
                size={size}        // Размер QR кода
                level={level}      // Уровень коррекции ошибок
                includeMargin={includeMargin} // Отступы вокруг кода
                // Можно добавить другие опции qrcode.react, например, цвета:
                // fgColor="#000000"
                // bgColor="#ffffff"
            />
        </div>
    );
};

export default BookingQRCode;