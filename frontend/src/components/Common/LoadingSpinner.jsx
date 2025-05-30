// src/components/Common/LoadingSpinner.jsx
import React from 'react';
import clsx from 'clsx';
// --- ИМПОРТ СТИЛЕЙ ---
import styles from './LoadingSpinner.module.css';
// --------------------

const LoadingSpinner = ({
    size = '30px', // Размер спиннера (ширина и высота)
    color = '#1a73e8', // Основной цвет (var(--primary))
    text = 'Загрузка...', // Текст под спиннером
    thickness = '4px', // Толщина линии спиннера
    // display: block | inline - для позиционирования
    // style: для дополнительных inline-стилей контейнера, если нужно
    // className: для дополнительных классов контейнера
    display = 'block',
    style = {},
    className = ''
}) => {
    // Стиль для самого вращающегося элемента (динамический)
    const spinnerInlineStyle = {
        width: size,
        height: size,
        borderWidth: thickness,
        borderTopColor: color, // Устанавливаем цвет основной дуги
        borderRightColor: 'transparent', // Делаем остальные сегменты прозрачными
        borderBottomColor: 'transparent',
        borderLeftColor: 'transparent',
    };

    // Определяем класс контейнера
    const containerClassName = clsx(
        styles.container,
        display === 'inline' && styles.inline,
        className // Добавляем внешние классы
    );

    return (
        // Передаем внешние стили и классы контейнеру
        <div className={containerClassName} style={style}>
            <div className={styles.spinner} style={spinnerInlineStyle} role="status" aria-live="polite">
                {/* Добавляем текст для скринридеров */}
                <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
                    {text || 'Загрузка'}
                </span>
            </div>
            {/* Отображаем текст визуально, если он есть */}
            {text && <span className={styles.text}>{text}</span>}
        </div>
    );
};

export default LoadingSpinner;