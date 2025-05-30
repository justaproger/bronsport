import React from 'react';
import dayjs from 'dayjs';

// --- НОВОЕ: Константы для дней недели ---
export const DOW_MAP_I18N = {
    0: 'weekdays.monday', 1: 'weekdays.tuesday', 2: 'weekdays.wednesday',
    3: 'weekdays.thursday', 4: 'weekdays.friday', 5: 'weekdays.saturday',
    6: 'weekdays.sunday'
};
export const DOW_FALLBACK = { 0: 'Пн', 1: 'Вт', 2: 'Ср', 3: 'Чт', 4: 'Пт', 5: 'Сб', 6: 'Вс' };
// --- КОНЕЦ НОВОГО ---

// Функция для отображения звезд рейтинга (оставляем как есть)
export const renderStars = (rating) => {
    // ... (код renderStars без изменений) ...
    const stars = [];
    const roundedRating = Math.round(Number(rating) * 2) / 2;
    if (isNaN(roundedRating) || roundedRating < 0 || roundedRating > 5) {
        return Array(5).fill(null).map((_, i) => <i key={`empty-fallback-${i}`} className="far fa-star" style={{ color: '#ccc' }}></i>);
    }
    const fullStars = Math.floor(roundedRating);
    const halfStar = roundedRating % 1 !== 0;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    for (let i = 0; i < fullStars; i++) stars.push(<i key={`full-${i}`} className="fas fa-star" style={{ color: '#fbbc04' }}></i>);
    if (halfStar) stars.push(<i key="half" className="fas fa-star-half-alt" style={{ color: '#fbbc04' }}></i>);
    for (let i = 0; i < emptyStars; i++) stars.push(<i key={`empty-${i}`} className="far fa-star" style={{ color: '#fbbc04' }}></i>);
    return stars;
};

// Убираем секунды
export const formatTime = (timeString) => {
    // ... (код formatTime без изменений) ...
    if (!timeString) return '';
    const parts = timeString.split(':');
    return parts.slice(0, 2).join(':');
};

// Форматирует время начала слота в диапазон (например, "18:00" -> "18:00-19:00")
export const formatSlotTimeRange = (startTimeString) => {
    // ... (код formatSlotTimeRange без изменений) ...
    if (!startTimeString || typeof startTimeString !== 'string' || !startTimeString.includes(':')) {
        return startTimeString || '-';
    }
    try {
        const startDate = dayjs(`1970-01-01T${startTimeString}:00`);
        const endDate = startDate.add(1, 'hour');
        return `${startDate.format('HH:mm')} - ${endDate.format('HH:mm')}`;
    } catch (e) {
        console.error("Error formatting slot time range:", startTimeString, e);
        return `${startTimeString} - ??:??`;
    }
};

// Функция для обработки ошибок загрузки изображений
export const handleImageError = (event, placeholderSrc = '/images/placeholders/placeholder-default.png') => {
    // ... (код handleImageError без изменений) ...
    const currentSrc = event.target.currentSrc || event.target.src;
    const placeholderFullSrc = window.location.origin + placeholderSrc;

    if (currentSrc !== placeholderSrc && currentSrc !== placeholderFullSrc) {
        console.warn(`Image failed to load: ${currentSrc}. Using placeholder: ${placeholderSrc}`);
        event.target.onerror = null; 
        event.target.src = placeholderSrc; 
    } else if (currentSrc === placeholderSrc || currentSrc === placeholderFullSrc) {
         event.target.onerror = null;
         console.error(`Placeholder image failed to load: ${placeholderSrc}`);
    }
};