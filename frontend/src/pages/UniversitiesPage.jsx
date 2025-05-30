// --- START OF FULL FILE frontend/src/pages/UniversitiesPage.jsx ---
import React, { useState, useMemo, useCallback, useEffect } from 'react'; // Добавили useEffect
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom'; // Добавили useSearchParams
import clsx from 'clsx'; // Добавили clsx
import { useTranslation } from 'react-i18next'; // Добавили useTranslation

// Импорты API и компонентов
import { fetchUniversities } from '../services/api'; // Убедимся, что путь правильный
import UniversityCard from '../components/Universities/UniversityCard.jsx';
import LoadingSpinner from '../components/Common/LoadingSpinner.jsx';
import Pagination from '../components/Common/Pagination.jsx';
import styles from './UniversitiesPage.module.css'; // Импорт стилей

// Хелпер для извлечения фильтров из URL
const getInitialFiltersFromURL = (searchParams) => {
    const initialFilters = {};
    const cityParam = searchParams.get('city__icontains'); // Используем правильный ключ
    if (cityParam) {
        initialFilters.city__icontains = cityParam;
    }
    // Можно добавить другие фильтры, если они появятся
    return initialFilters;
};

const UniversitiesPage = () => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;
    const [searchParams, setSearchParams] = useSearchParams(); // Хук для URL

    // Инициализация состояний из URL или по умолчанию
    const [page, setPage] = useState(() => parseInt(searchParams.get('page') || '1', 10));
    // Используем city__icontains как ключ в стейте фильтра
    const [filters, setFilters] = useState(() => getInitialFiltersFromURL(searchParams));
    // Отдельно храним выбранный город для select'а для удобства
    const [selectedCity, setSelectedCity] = useState(() => filters.city__icontains || '');


    // Параметры запроса для API (используем filters)
    const queryParams = useMemo(() => {
        const params = { page, page_size: 12, ...filters }; // Передаем объект filters
        // Очистка пустых/null параметров (не нужна, т.к. filters содержит только активные)
        // params.ordering = 'name'; // Опциональная сортировка
        return params;
    }, [page, filters]); // Зависимость от filters

    // --- Эффект для синхронизации состояния с URL ---
    useEffect(() => {
        const newSearchParams = new URLSearchParams();
        // Добавляем город, если выбран
        if (selectedCity) { newSearchParams.set('city__icontains', selectedCity); }
        // Добавляем страницу, если не первая
        if (page > 1) { newSearchParams.set('page', page.toString()); }
        // Обновляем URL
        setSearchParams(newSearchParams, { replace: true });
    }, [selectedCity, page, setSearchParams]); // Следим за selectedCity и page

    // Запрос списка университетов для текущей страницы/фильтра
    const { data: universitiesData, isLoading, isError, error, isFetching } = useQuery({
        queryKey: ['universitiesList', queryParams],
        queryFn: () => fetchUniversities({ queryKey: ['universitiesList', queryParams] }),
        keepPreviousData: true,
        staleTime: 5 * 60 * 1000,
    });

    // Запрос ВСЕХ университетов для списка городов
    const { data: allUniversitiesData, isLoading: isLoadingCities } = useQuery({
        queryKey: ['allUniversitiesForCities'],
        queryFn: () => fetchUniversities({ queryKey: ['allUniversitiesForCities', { page_size: 1000 }] }),
        staleTime: 60 * 60 * 1000,
        select: (data) => {
            const allCities = data?.results?.map(uni => uni.city).filter(Boolean) || [];
            return [...new Set(allCities)].sort((a, b) => a.localeCompare(b, currentLang));
        },
    });
    const cities = allUniversitiesData || [];

    // --- Обработчики ---
    // Смена города
    const handleCityChange = useCallback((e) => {
        const newCity = e.target.value;
        setSelectedCity(newCity); // Обновляем стейт для селекта
        setFilters(prev => ({ // Обновляем стейт фильтров для запроса API
            ...prev, // Сохраняем другие возможные фильтры
            city__icontains: newCity || undefined // Устанавливаем или удаляем (если выбрано "Все города")
        }));
        setPage(1); // Сбрасываем на первую страницу
    }, []); // Нет зависимостей, сеттеры стабильны

    // Смена страницы пагинации
    const handlePageChange = useCallback((newPage) => {
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    // Данные для пагинации и списка
    const universitiesList = universitiesData?.results || [];
    const totalUniversities = universitiesData?.count ?? 0;
    const pageSize = queryParams.page_size || 12;
    const totalPages = Math.ceil(totalUniversities / pageSize);

    // Хелпер для пути
    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    return (
         <div className={styles.pageWrapper}>
             {/* Шапка страницы */}
             <div className={styles.pageHeader}>
                <div className={styles.container}>
                    <div className={styles.breadcrumbs}>
                        <Link to={langPath('/')} className={styles.breadcrumbLink}>{t('footer.home')}</Link>
                        <span>/</span> {t('nav.universities')}
                    </div>
                    <h1 className={styles.pageTitle}>{t('universities_page.title')}</h1>
                </div>
            </div>

             {/* Основной контент */}
             <div className={styles.container}>
                {/* Панель фильтрации */}
                <div className={styles.filterBar}>
                    <label htmlFor="cityFilter" className={styles.filterLabel}>{t('universities_page.city_filter_label')}</label>
                    <select
                        id="cityFilter"
                        value={selectedCity} // Используем selectedCity для value
                        onChange={handleCityChange}
                        className={styles.citySelect}
                        disabled={isLoadingCities}
                        aria-label={t('universities_page.city_filter_label')}
                    >
                        <option value="">{t('universities_page.all_cities')}</option>
                        {cities.map(city => ( <option key={city} value={city}>{city}</option> ))}
                        {isLoadingCities && <option disabled>{t('common.loading')}</option>}
                    </select>
                    <span className={styles.resultsCount}>
                        {isLoading || isFetching
                            ? t('common.loading')
                            : t('universities_page.results_count', { count: totalUniversities })
                        }
                    </span>
                </div>

                {/* Сетка Университетов */}
                {isLoading && <div className={styles.loadingContainer}><LoadingSpinner text={t('common.loading_universities')} /></div>}
                {isError && !isLoading && (
                    <div className={styles.errorContainer}>
                        {t('errors.universities_load_error')} {error?.message || ''}
                    </div>
                 )}
                {!isLoading && !isError && universitiesList.length === 0 && (
                    <div className={styles.noResultsContainer}>
                        {t('universities_page.no_results')}
                    </div>
                )}
                {!isLoading && !isError && universitiesList.length > 0 && (
                    <div className={styles.grid}>
                        {universitiesList.map(university => (
                            <UniversityCard key={university.id} university={university} />
                        ))}
                    </div>
                )}

                 {/* Пагинация */}
                 {!isLoading && !isError && totalPages > 1 && (
                    <div className={styles.paginationContainer}>
                         <Pagination
                            currentPage={page}
                            totalCount={totalUniversities}
                            pageSize={pageSize}
                            onPageChange={handlePageChange}
                        />
                    </div>
                 )}
             </div>
         </div>
    );
};

export default UniversitiesPage;
// --- END OF FULL FILE ---