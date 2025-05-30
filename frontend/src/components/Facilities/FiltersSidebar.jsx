// --- START OF FULL FILE frontend/src/components/Facilities/FiltersSidebar.jsx ---
import React, { useState, useEffect ,useMemo} from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next'; // <-- Импорт
import LoadingSpinner from '../Common/LoadingSpinner'; // Для индикатора загрузки
import styles from './FiltersSidebar.module.css';

// Принимаем isLoading для показа индикатора
const FiltersSidebar = ({
    universities = [],
    amenities = [],
    onFilterChange,
    currentFilters = {},
    isLoading = false, // Флаг загрузки данных для фильтров
}) => {
    const { t } = useTranslation(); // <-- Получаем t

    // Состояние открытия групп
    const [openFilters, setOpenFilters] = useState({
        university: true, type: true, price: true, amenities: false,
    });

    // Локальное состояние формы
    const parseIds = (idsString) => idsString ? String(idsString).split(',').map(Number).filter(id => !isNaN(id)) : [];
    const parseTypes = (typesString) => typesString ? String(typesString).split(',') : [];

    const [selectedUniversities, setSelectedUniversities] = useState(() => parseIds(currentFilters.university));
    const [selectedTypes, setSelectedTypes] = useState(() => parseTypes(currentFilters.facility_type));
    const [selectedAmenities, setSelectedAmenities] = useState(() => parseIds(currentFilters.amenities));
    const [minPrice, setMinPrice] = useState(currentFilters.price_per_hour__gte || '');
    const [maxPrice, setMaxPrice] = useState(currentFilters.price_per_hour__lte || '');

    // Синхронизация с внешними фильтрами
    useEffect(() => {
        setSelectedUniversities(parseIds(currentFilters.university));
        setSelectedTypes(parseTypes(currentFilters.facility_type));
        setSelectedAmenities(parseIds(currentFilters.amenities));
        setMinPrice(currentFilters.price_per_hour__gte || '');
        setMaxPrice(currentFilters.price_per_hour__lte || '');
    }, [currentFilters]);

    // Переключение групп
    const toggleFilterGroup = (groupName) => {
        setOpenFilters(prev => ({ ...prev, [groupName]: !prev[groupName] }));
    };

    // Обработчики изменений
    const handleUniversityChange = (e) => { const { value, checked } = e.target; const id = parseInt(value); setSelectedUniversities(prev => checked ? [...prev, id] : prev.filter(uniId => uniId !== id)); };
    const handleTypeChange = (e) => { const { value, checked } = e.target; setSelectedTypes(prev => checked ? [...prev, value] : prev.filter(type => type !== value)); };
    const handleAmenityChange = (e) => { const { value, checked } = e.target; const id = parseInt(value); setSelectedAmenities(prev => checked ? [...prev, id] : prev.filter(amenityId => amenityId !== id)); };

    // Применение и сброс
    const applyFilters = () => {
        const newFilters = {
            university: selectedUniversities.length > 0 ? selectedUniversities.join(',') : undefined,
            facility_type: selectedTypes.length > 0 ? selectedTypes.join(',') : undefined,
            amenities: selectedAmenities.length > 0 ? selectedAmenities.join(',') : undefined,
            price_per_hour__gte: minPrice || undefined,
            price_per_hour__lte: maxPrice || undefined,
        };
        Object.keys(newFilters).forEach(key => newFilters[key] === undefined && delete newFilters[key]);
        onFilterChange(newFilters);
    };
    const resetFilters = () => {
        setSelectedUniversities([]); setSelectedTypes([]); setSelectedAmenities([]);
        setMinPrice(''); setMaxPrice('');
        onFilterChange({});
    };

    // Типы объектов (с ключами для перевода)
    const facilityTypes = useMemo(() => [
        { value: 'football', label: t('facility_type.football', 'Футбольное поле') },
        { value: 'basketball', label: t('facility_type.basketball', 'Баскетбольная площадка') },
        { value: 'tennis', label: t('facility_type.tennis', 'Теннисный корт') },
        { value: 'volleyball', label: t('facility_type.volleyball', 'Волейбольная площадка') },
        { value: 'swimming', label: t('facility_type.swimming', 'Бассейн') },
        { value: 'gym', label: t('facility_type.gym', 'Тренажерный зал') },
        { value: 'other', label: t('facility_type.other', 'Другое') },
    ], [t]);

    return (
        <div className={styles.sidebarContent}>
            {/* Используем t() для заголовка */}
            <h3 className={styles.title}>{t('facilities_page.filters_title', 'Фильтры')}</h3>

            {/* Индикатор загрузки данных для фильтров */}
            {isLoading && (
                <div className={styles.loadingPlaceholder}>
                    <LoadingSpinner size="20px" text={t('common.loading_filters', 'Загрузка фильтров...')} />
                </div>
            )}

            {/* Отображаем фильтры, только если загрузка завершена */}
            {!isLoading && (
                <>
                    {/* Университет */}
                    <div className={styles.filterGroup}>
                        <div className={clsx(styles.groupTitle, !openFilters.university && styles.groupTitleCollapsed)} onClick={() => toggleFilterGroup('university')}>
                             {/* Используем t() */}
                            <span>{t('filters.university_label', 'Университет')}</span>
                            <i className="fas fa-chevron-down"></i>
                        </div>
                        <div className={clsx(styles.groupContent, !openFilters.university && styles.groupContentHidden)}>
                            {universities.length > 0 ? universities.map(uni => (
                                <div key={uni.id} className={styles.checkboxItem}>
                                    <input type="checkbox" id={`university-${uni.id}`} value={uni.id} checked={selectedUniversities.includes(uni.id)} onChange={handleUniversityChange} />
                                    <label htmlFor={`university-${uni.id}`} className={styles.checkboxLabel}>{uni.short_name || uni.name}</label>
                                </div>
                            )) : <small className={styles.noDataText}>{t('filters.no_universities', 'Нет данных')}</small>}
                        </div>
                    </div>

                    {/* Тип объекта */}
                    <div className={styles.filterGroup}>
                        <div className={clsx(styles.groupTitle, !openFilters.type && styles.groupTitleCollapsed)} onClick={() => toggleFilterGroup('type')}>
                            {/* Используем t() */}
                            <span>{t('filters.type_label', 'Тип объекта')}</span>
                            <i className="fas fa-chevron-down"></i>
                        </div>
                        <div className={clsx(styles.groupContent, !openFilters.type && styles.groupContentHidden)}>
                            {facilityTypes.map(type => (
                                <div key={type.value} className={styles.checkboxItem}>
                                    <input type="checkbox" id={`type-${type.value}`} value={type.value} checked={selectedTypes.includes(type.value)} onChange={handleTypeChange} />
                                    <label htmlFor={`type-${type.value}`} className={styles.checkboxLabel}>{type.label}</label> {/* label уже переведен */}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Цена */}
                    <div className={styles.filterGroup}>
                        <div className={clsx(styles.groupTitle, !openFilters.price && styles.groupTitleCollapsed)} onClick={() => toggleFilterGroup('price')}>
                             {/* Используем t() */}
                            <span>{t('filters.price_label', 'Цена (сум/час)')}</span>
                            <i className="fas fa-chevron-down"></i>
                        </div>
                        <div className={clsx(styles.groupContent, !openFilters.price && styles.groupContentHidden)}>
                            <div className={styles.priceInputs}>
                                <div className={styles.priceInputContainer}>
                                     {/* Используем t() */}
                                    <label htmlFor="minPrice" className={styles.priceLabel}>{t('filters.price_from', 'От')}</label>
                                    <input id="minPrice" type="number" min="0" step="10000" placeholder='0' value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className={styles.priceInput} />
                                </div>
                                <div className={styles.priceInputContainer}>
                                     {/* Используем t() */}
                                    <label htmlFor="maxPrice" className={styles.priceLabel}>{t('filters.price_to', 'До')}</label>
                                    <input id="maxPrice" type="number" min="0" step="10000" placeholder={t('filters.price_placeholder_any', 'Любая')} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={styles.priceInput} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Удобства */}
                    <div className={styles.filterGroup}>
                        <div className={clsx(styles.groupTitle, !openFilters.amenities && styles.groupTitleCollapsed)} onClick={() => toggleFilterGroup('amenities')}>
                             {/* Используем t() */}
                            <span>{t('filters.amenities_label', 'Удобства')}</span>
                            <i className="fas fa-chevron-down"></i>
                        </div>
                         <div className={clsx(styles.groupContent, !openFilters.amenities && styles.groupContentHidden)}>
                            {amenities.length > 0 ? amenities.map(amenity => (
                                <div key={amenity.id} className={styles.checkboxItem}>
                                    <input type="checkbox" id={`amenity-${amenity.id}`} value={amenity.id} checked={selectedAmenities.includes(amenity.id)} onChange={handleAmenityChange} />
                                    <label htmlFor={`amenity-${amenity.id}`} className={styles.checkboxLabel}>
                                        {/* Иконку не переводим, название переводим */}
                                        {amenity.icon_class && <i className={clsx(amenity.icon_class, styles.amenityIcon)} style={{ marginRight: '0.5rem', width:'14px' }}></i>}
                                        {t(`amenity.${amenity.name.toLowerCase().replace(/\s+/g,'_')}`, amenity.name)} {/* Переводим название удобства */}
                                    </label>
                                </div>
                            )) : <small className={styles.noDataText}>{t('filters.no_amenities', 'Нет данных')}</small>}
                        </div>
                    </div>
                </>
            )}

            {/* Кнопки */}
            {/* Показываем кнопки всегда, но они могут быть disabled */}
            <div className={styles.actions}>
                {/* Используем t() */}
                <button className={styles.buttonPrimary} onClick={applyFilters} disabled={isLoading}>
                     <i className="fas fa-filter"></i>
                     {t('filters.apply_button', 'Применить')}
                </button>
                <button className={styles.buttonOutline} onClick={resetFilters} disabled={isLoading}>
                     <i className="fas fa-redo"></i>
                     {t('filters.reset_button', 'Сбросить все')}
                </button>
            </div>
        </div>
    );
};

export default FiltersSidebar;
// --- END OF FULL FILE ---