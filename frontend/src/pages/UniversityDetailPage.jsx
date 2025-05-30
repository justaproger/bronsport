// --- START OF FULL FILE frontend/src/pages/UniversityDetailPage.jsx ---
import React, { useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom'; // Убедимся, что Link импортирован
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next'; // Импорт для переводов

// Импорт Lightbox и его стилей
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
// Опциональные плагины (если будете использовать)
// import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
// import Zoom from "yet-another-react-lightbox/plugins/zoom";
// import "yet-another-react-lightbox/plugins/fullscreen.css";
// import "yet-another-react-lightbox/plugins/zoom.css";

// Импорты API функций
import {
    fetchUniversityDetail,
    fetchFacilities, // Используем общую функцию для получения объектов
    fetchUniversityStaff,
    fetchUniversityClubs
} from '../services/api'; // Проверьте путь к api.js

// Импорты компонентов
import LoadingSpinner from '../components/Common/LoadingSpinner.jsx';
import FacilityCard from '../components/Facilities/FacilityCard.jsx'; // Карточка объекта
import Pagination from '../components/Common/Pagination.jsx'; // Компонент пагинации
import StaffCard from '../components/Universities/StaffCard.jsx'; // Карточка персонала
import ClubCard from '../components/Universities/ClubCard.jsx'; // Карточка кружка
import { handleImageError } from '../utils/helpers'; // Хелпер для картинок
import styles from './UniversityDetailPage.module.css'; // Стили страницы

const UniversityDetailPage = () => {
    // --- Hooks ---
    const { universityId } = useParams(); // Получаем ID из URL
    const { t, i18n } = useTranslation(); // Для переводов
    const currentLang = i18n.language; // Текущий язык

    // --- State ---
    const [activeTab, setActiveTab] = useState('facilities'); // Активная вкладка
    const [facilitiesPage, setFacilitiesPage] = useState(1); // Текущая страница для объектов
    const [staffPage, setStaffPage] = useState(1); // Текущая страница для персонала
    const [clubsPage, setClubsPage] = useState(1); // Текущая страница для кружков
    const [lightboxOpen, setLightboxOpen] = useState(false); // Состояние лайтбокса
    const [lightboxIndex, setLightboxIndex] = useState(0); // Индекс слайда в лайтбоксе

    // --- Запросы данных с помощью React Query ---

    // 1. Запрос основных данных университета (включая новые счетчики)
    const { data: university, isLoading: isLoadingUni, isError: isErrorUni, error: errorUni } = useQuery({
        queryKey: ['universityDetail', universityId], // Ключ кэша
        queryFn: fetchUniversityDetail, // Функция API запроса
        enabled: !!universityId, // Выполнять только если universityId есть
        staleTime: 10 * 60 * 1000, // Кэшировать данные на 10 минут
    });

    // 2. Запрос списка объектов для текущей страницы (только если вкладка активна)
    const facilitiesQueryParams = useMemo(() => ({ university: universityId, page: facilitiesPage, page_size: 6 }), [universityId, facilitiesPage]);
    const { data: facilitiesData, isLoading: isLoadingFacilities, isFetching: isFetchingFacilities } = useQuery({
        queryKey: ['facilities', facilitiesQueryParams], // Ключ включает параметры
        queryFn: fetchFacilities,
        enabled: !!universityId && activeTab === 'facilities', // Запрос активен только для этой вкладки
        keepPreviousData: true, // Оставлять старые данные при загрузке новой страницы
    });

    // 3. Запрос списка персонала для текущей страницы (только если вкладка активна)
    const staffQueryParams = useMemo(() => ({ page: staffPage, page_size: 8 }), [staffPage]);
    const { data: staffData, isLoading: isLoadingStaff, isFetching: isFetchingStaff } = useQuery({
        queryKey: ['universityStaff', universityId, staffQueryParams],
        queryFn: fetchUniversityStaff,
        enabled: !!universityId && activeTab === 'staff',
         keepPreviousData: true,
    });

    // 4. Запрос списка кружков для текущей страницы (только если вкладка активна)
    const clubsQueryParams = useMemo(() => ({ page: clubsPage, page_size: 8 }), [clubsPage]);
    const { data: clubsData, isLoading: isLoadingClubs, isFetching: isFetchingClubs } = useQuery({
        queryKey: ['universityClubs', universityId, clubsQueryParams],
        queryFn: fetchUniversityClubs,
        enabled: !!universityId && activeTab === 'clubs',
         keepPreviousData: true,
    });


    // --- Мемоизация данных пагинации для каждой вкладки ---
    const { list: facilitiesList, total: totalFacilitiesFromList, pageSize: facilitiesPageSize, totalPages: facilitiesTotalPages } = useMemo(() => {
        const results = facilitiesData?.results || []; const count = facilitiesData?.count ?? 0; const size = facilitiesQueryParams.page_size; // Берем из параметров запроса
        return { list: results, total: count, pageSize: size, totalPages: Math.ceil(count / size) };
    }, [facilitiesData, facilitiesQueryParams.page_size]);

    const { list: staffList, total: totalStaffFromList, pageSize: staffPageSize, totalPages: staffTotalPages } = useMemo(() => {
        const results = staffData?.results || []; const count = staffData?.count ?? 0; const size = staffQueryParams.page_size;
        return { list: results, total: count, pageSize: size, totalPages: Math.ceil(count / size) };
    }, [staffData, staffQueryParams.page_size]);

     const { list: clubsList, total: totalClubsFromList, pageSize: clubsPageSize, totalPages: clubsTotalPages } = useMemo(() => {
        const results = clubsData?.results || []; const count = clubsData?.count ?? 0; const size = clubsQueryParams.page_size;
        return { list: results, total: count, pageSize: size, totalPages: Math.ceil(count / size) };
    }, [clubsData, clubsQueryParams.page_size]);

    // --- Обработчики ---
    // Смена активной вкладки
    const handleTabClick = useCallback((tabName) => {
        setActiveTab(tabName);
        // Сброс пагинации для неактивных вкладок
        if (tabName !== 'facilities') setFacilitiesPage(1);
        if (tabName !== 'staff') setStaffPage(1);
        if (tabName !== 'clubs') setClubsPage(1);
    }, []); // Нет зависимостей, т.к. setActiveTab стабильна

    // Открытие лайтбокса
    const openLightbox = useCallback((index) => {
         if (university?.gallery_images && university.gallery_images.length > 0 && index >= 0) {
            setLightboxIndex(index); setLightboxOpen(true);
        }
    }, [university?.gallery_images]); // Зависит от наличия галереи

    // --- Подготовка данных для рендеринга ---
    // Отображение загрузки или ошибки, если основные данные университета не загружены
    if (isLoadingUni) return <div className={styles.container}><LoadingSpinner text={t('common.loading_university', 'Загрузка университета...')} /></div>;
    if (isErrorUni) return <div className={clsx(styles.container, styles.errorMessage)}>{t('errors.university_load_error', 'Ошибка загрузки:')} {errorUni?.message || 'Не удалось загрузить данные'}</div>;
    if (!university) return <div className={clsx(styles.container, styles.noDataMessage)}>{t('common.university_not_found', 'Университет не найден.')}</div>;

    // Заглушки и данные для лайтбокса
    const placeholderCampus = '/images/placeholders/placeholder-campus.png';
    const placeholderLogo = '/images/placeholders/placeholder-logo.png';
    const lightboxSlides = university?.gallery_images?.map(img => ({ src: img.image, title: img.caption || university.name })) || [];

    // Флаги загрузки/обновления для активной вкладки
    const isLoadingCurrentTab = (activeTab === 'facilities' && isLoadingFacilities) || (activeTab === 'staff' && isLoadingStaff) || (activeTab === 'clubs' && isLoadingClubs);
    const isFetchingCurrentTab = (activeTab === 'facilities' && isFetchingFacilities) || (activeTab === 'staff' && isFetchingStaff) || (activeTab === 'clubs' && isFetchingClubs);

    // Хелпер для генерации путей с языком
    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    // Получаем счетчики из основного объекта university
    const facilitiesCount = university?.active_facilities_count ?? 0;
    const staffCount = university?.staff_count ?? 0;
    const clubsCount = university?.active_clubs_count ?? 0;

    return (
        <div className={styles.pageWrapper}>
             {/* Шапка страницы */}
            <div className={styles.pageHeader}>
                <div className={styles.container}>
                    <div className={styles.breadcrumbs}>
                        <Link to={langPath('/')} className={styles.breadcrumbLink}>{t('footer.home')}</Link> <span>/</span>
                        <Link to={langPath('/universities')} className={styles.breadcrumbLink}>{t('nav.universities')}</Link> <span>/</span>
                        {university.name} {/* Название университета */}
                    </div>
                </div>
            </div>

            <div className={styles.container}>
                 {/* Hero Section */}
                 <div className={styles.heroSection}>
                    <img src={university.campus_image || university.gallery_images?.[0]?.image || placeholderCampus} alt={university.name} className={styles.heroImage} onError={(e) => handleImageError(e, placeholderCampus)} />
                    <div className={styles.heroOverlay}>
                        <h1 className={styles.heroTitle}>{university.name}</h1>
                        <div className={styles.heroLocation}> <i className="fas fa-map-marker-alt"></i> <span>{university.city}</span> </div>
                    </div>
                </div>

                {/* Header Section (Лого, Название, Описание) */}
                <div className={styles.headerSection}>
                     <div className={styles.logoContainer}>
                         <img src={university.logo || placeholderLogo} alt={t('university_detail.logo_alt', { name: university.short_name || university.name })} className={styles.logo} onError={(e) => handleImageError(e, placeholderLogo)} />
                     </div>
                    <div className={styles.headerDetails}>
                        <h2 className={styles.headerTitle}>{university.name} {university.short_name ? `(${university.short_name})` : ''}</h2>
                        <p className={styles.headerDescription}>{university.description || t('university_detail.no_description')}</p>
                    </div>
                </div>

                {/* Contact Section */}
                <div className={styles.contactSection}>
                     {university.address && <div className={styles.contactItem}><span className={styles.contactIcon}><i className="fas fa-map-marker-alt"></i></span><div><div className={styles.contactLabel}>{t('university_detail.contact.address')}</div><div className={styles.contactValue}>{university.address}</div></div></div>}
                     {university.phone_number && <div className={styles.contactItem}><span className={styles.contactIcon}><i className="fas fa-phone-alt"></i></span><div><div className={styles.contactLabel}>{t('university_detail.contact.phone')}</div><div className={styles.contactValue}>{university.phone_number}</div></div></div>}
                     {university.email && <div className={styles.contactItem}><span className={styles.contactIcon}><i className="fas fa-envelope"></i></span><div><div className={styles.contactLabel}>{t('university_detail.contact.email')}</div><div className={styles.contactValue}><a href={`mailto:${university.email}`}>{university.email}</a></div></div></div>}
                     {university.website && <div className={styles.contactItem}><span className={styles.contactIcon}><i className="fas fa-globe"></i></span><div><div className={styles.contactLabel}>{t('university_detail.contact.website')}</div><div className={styles.contactValue}><a href={university.website} target="_blank" rel="noopener noreferrer">{university.website}</a></div></div></div>}
                     {university.working_hours && <div className={styles.contactItem}><span className={styles.contactIcon}><i className="fas fa-clock"></i></span><div><div className={styles.contactLabel}>{t('university_detail.contact.hours')}</div><div className={styles.contactValue}>{university.working_hours}</div></div></div>}
                     {university.established_year && <div className={styles.contactItem}><span className={styles.contactIcon}><i className="fas fa-calendar-alt"></i></span><div><div className={styles.contactLabel}>{t('university_detail.contact.established')}</div><div className={styles.contactValue}>{university.established_year}</div></div></div>}
                </div>

                {/* Tabs Navigation */}
                <nav className={styles.tabNav}>
                    {/* Используем счетчики из объекта university */}
                    <div className={clsx(styles.tabItem, activeTab === 'facilities' && styles.tabItemActive)} onClick={() => handleTabClick('facilities')}>{t('university_detail.tab_facilities')} ({facilitiesCount})</div>
                    <div className={clsx(styles.tabItem, activeTab === 'staff' && styles.tabItemActive)} onClick={() => handleTabClick('staff')}>{t('university_detail.tab_staff')} ({staffCount})</div>
                    <div className={clsx(styles.tabItem, activeTab === 'clubs' && styles.tabItemActive)} onClick={() => handleTabClick('clubs')}>{t('university_detail.tab_clubs')} ({clubsCount})</div>
                    <div className={clsx(styles.tabItem, activeTab === 'about' && styles.tabItemActive)} onClick={() => handleTabClick('about')}>{t('university_detail.tab_about')}</div>
                </nav>

                {/* Tab Content */}
                <div className={styles.tabContentContainer}>
                    {/* Показываем спиннер только при ПЕРВИЧНОЙ загрузке данных вкладки */}
                    {isLoadingCurrentTab && <LoadingSpinner text={`${t('common.loading')}...`} />}

                    {/* Отображаем контент, если НЕ идет первичная загрузка */}
                    {!isLoadingCurrentTab && (
                        <>
                            {/* Facilities Tab Content */}
                            {activeTab === 'facilities' && (
                                facilitiesList.length > 0 ? (
                                    <>
                                        {/* Индикатор фонового обновления */}
                                        {isFetchingCurrentTab && <LoadingSpinner size="20px" text={t('common.updating')} display="inline"/>}
                                        <div className={styles.grid}> {facilitiesList.map(item => <FacilityCard key={item.id} facility={item} />)} </div>
                                        {facilitiesTotalPages > 1 && <div className={styles.paginationContainer}><Pagination currentPage={facilitiesPage} totalCount={totalFacilitiesFromList} pageSize={facilitiesPageSize} onPageChange={setFacilitiesPage} /></div>}
                                    </>
                                ) : (<p className={styles.noDataMessage}>{t('university_detail.no_facilities')}</p>)
                            )}

                            {/* Staff Tab Content */}
                            {activeTab === 'staff' && (
                                staffList.length > 0 ? (
                                    <>
                                        {isFetchingCurrentTab && <LoadingSpinner size="20px" text={t('common.updating')} display="inline"/>}
                                        <div className={styles.staffGrid}> {staffList.map(item => <StaffCard key={item.id} member={item} />)} </div>
                                        {staffTotalPages > 1 && <div className={styles.paginationContainer}><Pagination currentPage={staffPage} totalCount={totalStaffFromList} pageSize={staffPageSize} onPageChange={setStaffPage} /></div>}
                                    </>
                                ) : (<p className={styles.noDataMessage}>{t('university_detail.no_staff')}</p>)
                            )}

                            {/* Clubs Tab Content */}
                            {activeTab === 'clubs' && (
                                clubsList.length > 0 ? (
                                    <>
                                        {isFetchingCurrentTab && <LoadingSpinner size="20px" text={t('common.updating')} display="inline"/>}
                                        <div className={styles.clubsGrid}> {clubsList.map(item => <ClubCard key={item.id} club={item} />)} </div>
                                        {clubsTotalPages > 1 && <div className={styles.paginationContainer}><Pagination currentPage={clubsPage} totalCount={totalClubsFromList} pageSize={clubsPageSize} onPageChange={setClubsPage} /></div>}
                                    </>
                                ) : (<p className={styles.noDataMessage}>{t('university_detail.no_clubs')}</p>)
                            )}

                            {/* About Tab Content */}
                            {activeTab === 'about' && (
                                <div className={styles.aboutSection}>
                                     <h3>{t('university_detail.about_title')}</h3>
                                    <p>{university.description || t('university_detail.no_description')}</p>
                                     {Array.isArray(university.gallery_images) && university.gallery_images.length > 0 && (
                                        <>
                                            <h4>{t('university_detail.gallery_title')}</h4>
                                             <div className={styles.galleryGrid}> {university.gallery_images.map((img, index) => ( <div key={img.id} className={styles.galleryItem} onClick={() => openLightbox(index)} title={img.caption || t('university_detail.gallery_view_photo')}> <img src={img.image} alt={img.caption || university.name} className={styles.galleryImage} onError={(e) => handleImageError(e, placeholderCampus)}/> </div> ))} </div>
                                        </>
                                     )}
                                     {(!Array.isArray(university.gallery_images) || university.gallery_images.length === 0) && ( <p>{t('university_detail.no_gallery')}</p> )}
                                </div>
                            )}
                         </>
                    )}
                </div> {/* Конец .tabContentContainer */}
            </div> {/* Конец .container */}

             {/* Лайтбокс */}
             <Lightbox
                open={lightboxOpen} close={() => setLightboxOpen(false)} slides={lightboxSlides} index={lightboxIndex}
                styles={{ container: { backgroundColor: "rgba(0, 0, 0, .85)" } }}
            />
        </div>
    );
};

export default UniversityDetailPage;
// --- END OF FULL FILE ---