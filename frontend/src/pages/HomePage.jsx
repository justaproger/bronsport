// --- START OF FULL FILE frontend/src/pages/HomePage.jsx ---
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs'; // Используется для min даты, оставляем
import clsx from 'clsx';
import { useTranslation } from 'react-i18next'; // <-- Импорт

// Импорт Swiper
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

// Импорты API и компонентов
import { fetchUniversities, fetchFacilities } from '../services/api';
import FacilityCard from '../components/Facilities/FacilityCard.jsx';
import LoadingSpinner from '../components/Common/LoadingSpinner.jsx';
// import { handleImageError } from '../utils/helpers'; // Не используется напрямую здесь
import styles from './HomePage.module.css';

const HomePage = () => {
    const { t, i18n } = useTranslation(); // <-- Получаем t и i18n
    const currentLang = i18n.language; // Текущий язык для ссылок
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useState({
        university: '',
        facility_type: '',
        // date: '', // Убрали дату из быстрого поиска
    });

    // Загрузка университетов для поиска
    const { data: universitiesData, isLoading: isLoadingUniversities } = useQuery({
        queryKey: ['universitiesListSimple'], // Используем один ключ
        queryFn: () => fetchUniversities({ queryKey: ['universitiesListSimple', { page_size: 500 }]}),
        staleTime: 24 * 60 * 60 * 1000,
        select: (data) => data?.results || data || [], // Обработка разных форматов ответа
    });

    // Загрузка объектов для слайдера
    const sliderQueryParams = useMemo(() => ({ page_size: 10, ordering: '-created_at' }), []);
    const { data: sliderFacilities, isLoading: isLoadingSlider } = useQuery({
        queryKey: ['facilitiesSlider', sliderQueryParams],
        queryFn: () => fetchFacilities({ queryKey: ['facilitiesSlider', sliderQueryParams] }),
        staleTime: 10 * 60 * 1000,
        select: (data) => data?.results || data || [], // Обработка разных форматов
    });

    // Обработчики
    const handleSearchChange = (e) => {
        setSearchParams(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        const query = new URLSearchParams();
        if (searchParams.university) query.set('university', searchParams.university);
        if (searchParams.facility_type) query.set('facility_type', searchParams.facility_type);
        // Переход на страницу каталога с языком
        navigate(`/${currentLang}/facilities?${query.toString()}`);
    };

    // Типы объектов для селекта поиска (с ключами для перевода)
    const facilityTypes = useMemo(() => [
        { value: '', label: t('home.search.all_types', 'Все типы') },
        { value: 'football', label: t('facility_type.football', 'Футбольное поле') },
        { value: 'basketball', label: t('facility_type.basketball', 'Баскетбольная площадка') },
        { value: 'tennis', label: t('facility_type.tennis', 'Теннисный корт') },
        { value: 'volleyball', label: t('facility_type.volleyball', 'Волейбольная площадка') },
        { value: 'swimming', label: t('facility_type.swimming', 'Бассейн') },
        { value: 'gym', label: t('facility_type.gym', 'Тренажерный зал') },
        { value: 'other', label: t('facility_type.other', 'Другое') },
    ], [t]); // Зависимость от t

    // Хелпер для путей
    const langPath = (path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`;

    return (
        <div className={styles.pageWrapper}>
            {/* Hero Section */}
            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    {/* Используем t() */}
                    <h1 className={styles.heroTitle}>{t('home.hero.title', 'Бронируйте спортивные объекты университетов Узбекистана')}</h1>
                    <p className={styles.heroSubtitle}>{t('home.hero.subtitle', 'Найдите и забронируйте площадки, бассейны, корты и другие объекты в ведущих ВУЗах страны.')}</p>
                    <div className={styles.heroCta}>
                        <Link to={langPath('/facilities')} className={clsx(styles.button, styles.buttonSecondary)}>
                            <i className="fas fa-search"></i> {t('home.hero.find_button', 'Найти объект')}
                        </Link>
                        {/* <Link to={langPath('/info/faq')} className={clsx(styles.button, styles.buttonOutline)}> <i className="fas fa-info-circle"></i> {t('home.hero.how_it_works_button', 'Как это работает')} </Link> */}
                    </div>
                </div>
            </section>

            {/* Основной контент */}
            <div className={styles.container}>

                {/* Search Section */}
                <section className={styles.searchSection}>
                     {/* Используем t() */}
                    <h2 className={styles.searchTitle}>{t('home.search.title', 'Быстрый поиск')}</h2>
                    <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
                        <div className={styles.formGroup}>
                            <label htmlFor="search-university" className={styles.label}>{t('home.search.university_label', 'Университет')}</label>
                            <select id="search-university" name="university" value={searchParams.university} onChange={handleSearchChange} className={styles.select} disabled={isLoadingUniversities}>
                                {/* Используем t() */}
                                <option value="">{t('home.search.all_universities', 'Все университеты')}</option>
                                {universitiesData?.map(uni => ( <option key={uni.id} value={uni.id}> {uni.short_name || uni.name} </option> ))}
                                {isLoadingUniversities && <option disabled>{t('common.loading', 'Загрузка...')}</option>}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="search-facility-type" className={styles.label}>{t('home.search.type_label', 'Тип объекта')}</label>
                            <select id="search-facility-type" name="facility_type" value={searchParams.facility_type} onChange={handleSearchChange} className={styles.select}>
                                {/* Используем массив facilityTypes с переведенными label */}
                                {facilityTypes.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label} style={{visibility: 'hidden'}}>{t('home.search.search_button_label', 'Поиск')}</label>
                             <button type="submit" className={styles.searchButton}> <i className="fas fa-search"></i> {t('home.search.search_button', 'Найти')} </button>
                         </div>
                    </form>
                </section>

                {/* Секция Слайдера Объектов */}
                <section className={clsx(styles.section, styles.sliderSection)}>
                     <h2 className={styles.sectionTitle}>{t('home.slider.title', 'Новые Объекты')}</h2>
                     {isLoadingSlider && <div className={styles.loadingPlaceholder}><LoadingSpinner text={t('common.loading_facilities', 'Загрузка объектов...')} /></div>}
                     {!isLoadingSlider && sliderFacilities && sliderFacilities.length > 0 && (
                         <Swiper
                            modules={[Pagination, Autoplay, Navigation]}
                            spaceBetween={20} slidesPerView={1}
                            pagination={{ clickable: true, el: `.${styles.swiperPagination}` }}
                            navigation={{ nextEl: `.${styles.swiperButtonNext}`, prevEl: `.${styles.swiperButtonPrev}`, disabledClass: styles.swiperButtonDisabled, }}
                            autoplay={{ delay: 5000, disableOnInteraction: false }}
                            loop={sliderFacilities.length > 4}
                            breakpoints={{ 576: { slidesPerView: 2, spaceBetween: 20, }, 768: { slidesPerView: 3, spaceBetween: 20, }, 1200: { slidesPerView: 4, spaceBetween: 30, }, }}
                            className={styles.swiperContainer}
                        >
                             {sliderFacilities.map(facility => (
                                 <SwiperSlide key={facility.id} className={styles.swiperSlide}>
                                     <FacilityCard facility={facility} /> {/* Карточка будет использовать свои переводы */}
                                 </SwiperSlide>
                             ))}
                             <div className={styles.swiperPagination}></div>
                             <div className={styles.swiperButtonPrev} aria-label={t('common.prev_slide', 'Предыдущий слайд')}><i className="fas fa-chevron-left"></i></div>
                             <div className={styles.swiperButtonNext} aria-label={t('common.next_slide', 'Следующий слайд')}><i className="fas fa-chevron-right"></i></div>
                        </Swiper>
                     )}
                     {!isLoadingSlider && (!sliderFacilities || sliderFacilities.length === 0) && (
                        <p className={styles.noDataMessage}>{t('errors.facilities_load_failed', 'Не удалось загрузить объекты.')}</p>
                     )}
                </section>

                 {/* How it Works Section */}
                 <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>{t('home.how_it_works.title', 'Как это работает')}</h2>
                    <div className={styles.howItWorksGrid}>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}><i className="fas fa-search"></i></div>
                            <h3 className={styles.stepTitle}>{t('home.how_it_works.step1_title', '1. Найдите объект')}</h3>
                            <p className={styles.stepText}>{t('home.how_it_works.step1_text', 'Используйте поиск или просмотрите каталог, чтобы найти подходящую площадку.')}</p>
                        </div>
                        <div className={styles.stepCard}>
                             <div className={styles.stepIcon}><i className="far fa-calendar-alt"></i></div>
                            <h3 className={styles.stepTitle}>{t('home.how_it_works.step2_title', '2. Выберите время')}</h3>
                            <p className={styles.stepText}>{t('home.how_it_works.step2_text', 'Проверьте доступность в календаре и выберите удобные часы или оформите абонемент.')}</p>
                        </div>
                        <div className={styles.stepCard}>
                             <div className={styles.stepIcon}><i className="fas fa-credit-card"></i></div>
                            <h3 className={styles.stepTitle}>{t('home.how_it_works.step3_title', '3. Подтвердите')}</h3>
                            <p className={styles.stepText}>{t('home.how_it_works.step3_text', 'Проверьте детали заказа и следуйте инструкциям для завершения бронирования.')}</p>
                        </div>
                        <div className={styles.stepCard}>
                             <div className={styles.stepIcon}><i className="fas fa-check-circle"></i></div>
                            <h3 className={styles.stepTitle}>{t('home.how_it_works.step4_title', '4. Готово!')}</h3>
                            <p className={styles.stepText}>{t('home.how_it_works.step4_text', 'Ваша бронь или подписка подтверждена! Приходите и занимайтесь спортом.')}</p>
                        </div>
                    </div>
                </section>

             </div> {/* Конец .container */}
        </div>
    );
};

export default HomePage;
// --- END OF FULL FILE ---