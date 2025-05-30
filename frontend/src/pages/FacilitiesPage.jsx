// --- START OF FULL FILE frontend/src/pages/FacilitiesPage.jsx ---
import React, { useState, useMemo, useCallback, useEffect } from 'react'; // <-- Добавили useEffect
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom'; // <-- Импортировали useSearchParams
import clsx from 'clsx';
import { useTranslation } from 'react-i18next'; // <-- Импорт для переводов

// Импорты API и компонентов
import { fetchFacilities, fetchUniversities, fetchAmenities } from '../services/api';
import FacilityCard from '../components/Facilities/FacilityCard.jsx';
import FacilityListItem from '../components/Facilities/FacilityListItem.jsx';
import FiltersSidebar from '../components/Facilities/FiltersSidebar.jsx';
import LoadingSpinner from '../components/Common/LoadingSpinner.jsx';
import Pagination from '../components/Common/Pagination.jsx';
import styles from './FacilitiesPage.module.css'; // Импорт стилей

// Хелпер для парсинга параметров из URLSearchParams
// Вынесен за пределы компонента, так как не зависит от пропсов или стейта
const getInitialFiltersFromURL = (searchParams) => {
    const initialFilters = {};
    // Список ключей, которые мы ожидаем как фильтры из URL
    const possibleFilterKeys = [
        'university', // ID университета(ов), строка через запятую
        'facility_type', // Тип(ы) объекта, строка через запятую
        'amenities', // ID удобств, строка через запятую
        'price_per_hour__gte', // Мин. цена
        'price_per_hour__lte', // Макс. цена
        'city__icontains' // Город (для поиска по части строки)
        // Добавьте другие ключи фильтров, если они поддерживаются API
    ];
    possibleFilterKeys.forEach(key => {
        const value = searchParams.get(key); // Получаем значение из URL
        if (value !== null && value !== '') { // Проверяем, что значение существует и не пустое
            initialFilters[key] = value;
        }
    });
    console.log("[FacilitiesPage] Initial filters from URL:", initialFilters); // Лог для отладки
    return initialFilters;
};


const FacilitiesPage = () => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;
    const [searchParams, setSearchParams] = useSearchParams(); // Хук для работы с URL параметрами

    // Инициализация состояния фильтров из URL при первом рендере
    const [filters, setFilters] = useState(() => getInitialFiltersFromURL(searchParams));

    // Остальные состояния
    const [viewMode, setViewMode] = useState('grid'); // 'grid' или 'list'
    const [sorting, setSorting] = useState(() => searchParams.get('ordering') || '-created_at'); // Инициализация сортировки из URL или по умолчанию
    const [page, setPage] = useState(() => parseInt(searchParams.get('page') || '1', 10)); // Инициализация страницы из URL или 1
    const [isMobileFiltersVisible, setIsMobileFiltersVisible] = useState(false); // Для мобильных фильтров

    // Формируем параметры запроса для API на основе текущих состояний
    const queryParams = useMemo(() => {
        const params = { page, ordering: sorting, page_size: 12, ...filters };
        // Очистка пустых параметров (кроме page=1)
        Object.keys(params).forEach(key => {
            if (params[key] === undefined || params[key] === null || params[key] === '') {
                 if (key !== 'page' || params[key] !== 1) { delete params[key]; }
            }
        });
        if (!params.page) params.page = 1; // Гарантируем наличие page
        return params;
    }, [page, sorting, filters]);

    // --- Эффект для синхронизации URL с состоянием ---
    useEffect(() => {
        const newSearchParams = new URLSearchParams();
        // Добавляем фильтры
        Object.entries(filters).forEach(([key, value]) => {
            // Убедимся, что значение не пустое перед добавлением
            if (value !== null && value !== undefined && value !== '') {
                newSearchParams.set(key, value);
            }
        });
        // Добавляем сортировку (если не дефолтная)
        if (sorting !== '-created_at') { newSearchParams.set('ordering', sorting); }
        // Добавляем страницу (если не первая)
        if (page > 1) { newSearchParams.set('page', page.toString()); }

        // Обновляем URL, заменяя текущую запись в истории
        setSearchParams(newSearchParams, { replace: true });
    }, [filters, sorting, page, setSearchParams]);
    // -------------------------------------------------

    // Запрос данных объектов
    const { data: facilitiesData, isLoading, isError, error, isFetching } = useQuery({
        queryKey: ['facilities', queryParams], // Ключ зависит от ВСЕХ параметров запроса
        queryFn: () => fetchFacilities({ queryKey: ['facilities', queryParams] }),
        keepPreviousData: true, // Оставляем старые данные при загрузке новых
        staleTime: 1 * 60 * 1000, // Не считаем данные устаревшими 1 минуту
    });

     // Запросы данных для фильтров (университеты и удобства)
     const { data: universitiesData, isLoading: isLoadingUniversities } = useQuery({
         queryKey: ['universitiesListSimple'], // Кэшируем список университетов
         queryFn: () => fetchUniversities({ queryKey: ['universitiesListSimple', { page_size: 500 }]}), // Запрашиваем много для списка
         staleTime: 60 * 60 * 1000, // Кэш на час
         select: (data) => data?.results || data || [], // Выбираем только массив results
        });
     const { data: amenitiesData, isLoading: isLoadingAmenities } = useQuery({
         queryKey: ['amenitiesList'], // Кэшируем список удобств
         queryFn: fetchAmenities,
         staleTime: 60 * 60 * 1000 // Кэш на час
        });

    // --- Обработчики ---
    // Применение новых фильтров
    const handleFilterChange = useCallback((newFilters) => {
        setPage(1); // Сбрасываем на первую страницу
        setFilters(newFilters); // Устанавливаем новые фильтры
        setIsMobileFiltersVisible(false); // Закрываем мобильный сайдбар
        document.body.style.overflow = ''; // Восстанавливаем скролл
    }, []); // Нет зависимостей, т.к. сеттеры стейта стабильны

     // Смена сортировки
     const handleSortChange = useCallback((e) => {
        setPage(1); // Сбрасываем на первую страницу
        setSorting(e.target.value); // Устанавливаем новую сортировку
     }, []);

     // Смена страницы пагинации
     const handlePageChange = useCallback((newPage) => {
        setPage(newPage); // Устанавливаем новую страницу
         window.scrollTo({ top: 0, behavior: 'smooth' }); // Плавный скролл вверх
     }, []);

     // Смена вида (сетка/список)
     const handleViewChange = (newMode) => { setViewMode(newMode); }

     // Переключение видимости мобильных фильтров
     const toggleMobileFilters = useCallback(() => {
         setIsMobileFiltersVisible(prev => {
             const nextState = !prev;
             document.body.style.overflow = nextState ? 'hidden' : ''; // Блокируем/разблокируем скролл body
             return nextState;
         });
     }, []);

     // Эффект для сброса блокировки скролла при размонтировании
     useEffect(() => {
         return () => { document.body.style.overflow = ''; };
     }, []);

     // Опции сортировки для select
     const sortOptions = useMemo(() => [
        { value: '-created_at', label: t('facilities_page.sort.newest', 'Сначала новые') },
        { value: 'name', label: t('facilities_page.sort.name_asc', 'По названию (А-Я)') },
        { value: '-name', label: t('facilities_page.sort.name_desc', 'По названию (Я-А)') },
        { value: 'price_per_hour', label: t('facilities_page.sort.price_asc', 'По цене (возр.)') },
        { value: '-price_per_hour', label: t('facilities_page.sort.price_desc', 'По цене (убыв.)') },
     ], [t]);

    // Подготовка данных для рендеринга
    const facilitiesList = facilitiesData?.results || [];
    const totalFacilities = facilitiesData?.count ?? 0;
    const pageSize = queryParams.page_size || 12;
    const totalPages = Math.ceil(totalFacilities / pageSize);
    const isLoadingFiltersData = isLoadingUniversities || isLoadingAmenities;

    // Хелпер для путей с языком
    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    return (
        <div className={styles.pageWrapper}>
            {/* Шапка страницы */}
            <div className={styles.pageHeader}>
                <div className={styles.container}>
                     <div className={styles.breadcrumbs}>
                         <Link to={langPath('/')} className={styles.breadcrumbLink}>{t('footer.home', 'Главная')}</Link>
                         <span>/</span> {t('nav.facilities', 'Объекты')} {/* Используем новый ключ */}
                     </div>
                    <h1 className={styles.pageTitle}>{t('facilities_page.title', 'Каталог спортивных объектов')}</h1>
                </div>
            </div>

            <div className={styles.container}>
                {/* Кнопка мобильных фильтров */}
                <button className={styles.mobileFilterButton} onClick={toggleMobileFilters}>
                    <i className="fas fa-filter"></i> {t('facilities_page.mobile_filter_button', 'Фильтры')} ({Object.keys(filters).filter(k => filters[k]).length})
                </button>

                {/* Основной Layout */}
                <div className={styles.layout}>
                    {/* Обертка сайдбара фильтров */}
                    <div className={clsx(styles.sidebarWrapper, isMobileFiltersVisible && styles.sidebarWrapperVisible)}>
                        <div className={styles.mobileSidebarHeader}>
                            <span>{t('facilities_page.filters_title', 'Фильтры')}</span>
                            <button onClick={toggleMobileFilters} className={styles.closeMobileFiltersButton} aria-label={t('common.close', 'Закрыть')}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        {/* Передаем актуальные фильтры в сайдбар */}
                        <FiltersSidebar
                            universities={universitiesData}
                            amenities={amenitiesData}
                            onFilterChange={handleFilterChange}
                            currentFilters={filters} // Передаем filters из стейта
                            isLoading={isLoadingFiltersData}
                         />
                    </div>
                    {/* Оверлей */}
                    {isMobileFiltersVisible && <div className={styles.mobileFilterOverlay} onClick={toggleMobileFilters}></div>}

                    {/* Основной контент */}
                    <div className={styles.content}>
                        {/* Панель сортировки и вида */}
                        <div className={styles.sortingBar}>
                            <div className={styles.resultsCount}>
                                {isLoading || isFetching ? t('common.searching', 'Поиск...') : t('facilities_page.results_count', 'Найдено: {{count}} объектов', { count: totalFacilities })}
                            </div>
                            <div className={styles.controls}>
                                {/* Select для сортировки */}
                                <select value={sorting} onChange={handleSortChange} className={styles.sortSelect} aria-label={t('facilities_page.sort.label', 'Сортировка')}>
                                    {sortOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                                {/* Переключатель вида */}
                                <div className={styles.viewToggle}>
                                    <button onClick={() => handleViewChange('grid')} title={t('facilities_page.view_grid_title', 'Вид сетки')} className={clsx(styles.viewButton, viewMode === 'grid' && styles.viewButtonActive)}>
                                        <i className="fas fa-th"></i>
                                    </button>
                                    <button onClick={() => handleViewChange('list')} title={t('facilities_page.view_list_title', 'Вид списка')} className={clsx(styles.viewButton, viewMode === 'list' && styles.viewButtonActive)}>
                                        <i className="fas fa-list"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Отображение объектов */}
                        {isLoading && <div className={styles.loadingContainer}><LoadingSpinner text={t('common.loading_facilities', 'Загрузка объектов...')} /></div>}
                        {isError && !isLoading && (
                            <div className={clsx(styles.errorContainer, styles.errorMessage)}>
                                {t('errors.facilities_loading_error', 'Ошибка загрузки объектов:')} {error?.message || ''}
                            </div>
                         )}
                        {!isLoading && !isError && facilitiesList.length === 0 && (
                             <div className={styles.noResultsContainer}>
                                 {t('facilities_page.no_results', 'Объекты по вашим критериям не найдены. Попробуйте изменить фильтры.')}
                            </div>
                        )}
                        {!isLoading && !isError && facilitiesList.length > 0 && (
                            viewMode === 'grid' ? (
                                <div className={styles.grid}>
                                    {facilitiesList.map(facility => (
                                        <FacilityCard key={facility.id} facility={facility} />
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.list}>
                                    {facilitiesList.map(facility => (
                                        <FacilityListItem key={facility.id} facility={facility} />
                                    ))}
                                </div>
                            )
                        )}

                         {/* Пагинация */}
                         {!isLoading && !isError && totalPages > 1 && (
                             <div className={styles.paginationContainer}>
                                <Pagination
                                    currentPage={page}
                                    totalCount={totalFacilities}
                                    pageSize={pageSize}
                                    onPageChange={handlePageChange}
                                    // t={t} // Можно передать t, если он нужен внутри Pagination
                                />
                             </div>
                         )}
                    </div> {/* Конец .content */}
                </div> {/* Конец .layout */}
            </div> {/* Конец .container */}
        </div>
    );
};

export default FacilitiesPage;
// --- END OF FULL FILE ---