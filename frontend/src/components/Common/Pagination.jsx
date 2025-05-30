// --- START OF FULL FILE frontend/src/components/Common/Pagination.jsx ---
import React, { useMemo } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next'; // <-- Импорт
import styles from './Pagination.module.css'; // Стили

const DOTS = '...'; // Константа для точек

// Хелпер для генерации диапазона (без изменений)
const range = (start, end) => {
  let length = end - start + 1;
  return Array.from({ length }, (_, idx) => idx + start);
};

const Pagination = ({
    currentPage,
    totalCount,
    pageSize,
    onPageChange,
    siblingCount = 1,
    className = ''
}) => {
    const { t } = useTranslation(); // <-- Получаем t

    // Расчет диапазона страниц (без изменений в логике)
    const paginationRange = useMemo(() => {
        const totalPages = Math.ceil(totalCount / pageSize);
        const totalPageNumbers = siblingCount + 5;

        if (totalPageNumbers >= totalPages) { return range(1, totalPages); }

        const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
        const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);
        const shouldShowLeftDots = leftSiblingIndex > 2;
        const shouldShowRightDots = rightSiblingIndex < totalPages - 2;
        const firstPageIndex = 1;
        const lastPageIndex = totalPages;

        if (!shouldShowLeftDots && shouldShowRightDots) {
          let leftItemCount = 3 + 2 * siblingCount;
          let leftRange = range(1, leftItemCount);
          return [...leftRange, DOTS, lastPageIndex];
        }
        if (shouldShowLeftDots && !shouldShowRightDots) {
          let rightItemCount = 3 + 2 * siblingCount;
          let rightRange = range(totalPages - rightItemCount + 1, totalPages);
          return [firstPageIndex, DOTS, ...rightRange];
        }
        if (shouldShowLeftDots && shouldShowRightDots) {
          let middleRange = range(leftSiblingIndex, rightSiblingIndex);
          return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
        }
        // На всякий случай возвращаем полный диапазон, если что-то пошло не так
        return range(1, totalPages);

    }, [totalCount, pageSize, siblingCount, currentPage]);

    // Если страниц <= 1, не рендерим пагинацию
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages <= 1) {
        return null;
    }

    // Обработчики (без изменений)
    const handlePrevious = () => { if (currentPage > 1) onPageChange(currentPage - 1); };
    const handleNext = () => { if (currentPage < totalPages) onPageChange(currentPage + 1); };
    const handlePageNumberClick = (pageNumber) => { if (pageNumber !== currentPage) onPageChange(pageNumber); };

    return (
        <nav className={clsx(styles.container, className)} aria-label={t('pagination.aria_label', "Навигация по страницам")}>
            <ul className={styles.list}>
                {/* Кнопка Назад */}
                <li
                    className={clsx(styles.item, currentPage === 1 && styles.itemDisabled)}
                    onClick={handlePrevious}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && currentPage > 1) handlePrevious(); }}
                    role="button"
                    tabIndex={currentPage === 1 ? -1 : 0}
                    aria-disabled={currentPage === 1}
                    // Используем t() для aria-label
                    aria-label={t('pagination.prev_page_aria', "Предыдущая страница")}
                >
                     <i className="fas fa-chevron-left"></i>
                </li>

                {/* Номера страниц и точки */}
                {paginationRange.map((pageNumber, index) => {
                    if (pageNumber === DOTS) {
                        // Для точек можно не добавлять aria-label, они не интерактивны
                        return <li key={`${DOTS}-${index}`} className={styles.ellipsis} aria-hidden="true">…</li>;
                    }
                    return (
                        <li
                            key={pageNumber}
                            className={clsx(styles.item, pageNumber === currentPage && styles.itemActive)}
                            onClick={() => handlePageNumberClick(pageNumber)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePageNumberClick(pageNumber); }}
                            role="button"
                            tabIndex={0}
                            aria-current={pageNumber === currentPage ? 'page' : undefined}
                             // Используем t() для aria-label с интерполяцией
                            aria-label={t('pagination.page_aria', 'Страница {{page}}', { page: pageNumber })}
                        >
                            {pageNumber}
                        </li>
                    );
                })}

                {/* Кнопка Вперед */}
                <li
                    className={clsx(styles.item, currentPage === totalPages && styles.itemDisabled)}
                    onClick={handleNext}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && currentPage < totalPages) handleNext(); }}
                    role="button"
                    tabIndex={currentPage === totalPages ? -1 : 0}
                    aria-disabled={currentPage === totalPages}
                    // Используем t() для aria-label
                    aria-label={t('pagination.next_page_aria', "Следующая страница")}
                >
                     <i className="fas fa-chevron-right"></i>
                </li>
            </ul>
        </nav>
    );
};

export default Pagination;
// --- END OF FULL FILE ---