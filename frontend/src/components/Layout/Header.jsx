// --- START OF FULL FILE frontend/src/components/Layout/Header.jsx ---
import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next'; // Импорт для переводов
import { logout } from '../../store/authSlice'; // Путь к authSlice
import styles from './Header.module.css'; // Используем CSS Modules

const Header = () => {
    // --- Hooks ---
    const { isAuthenticated, user } = useSelector(state => state.auth);
    const dispatch = useDispatch();
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation(); // Получаем t и инстанс i18n
    const currentLang = i18n.language; // Текущий язык ('uz' или 'ru')
    const supportedLngs = i18n.options.supportedLngs || ['uz', 'ru']; // Получаем поддерживаемые языки из конфига i18n

    // --- State for Mobile Menu ---
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const mobileMenuRef = useRef(null); // Ref для области меню
    const burgerButtonRef = useRef(null); // Ref для кнопки бургера

    // --- Mobile Menu Handlers ---
    const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);
    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    // --- Effects ---
    // Закрытие меню при смене URL
    useEffect(() => {
        closeMobileMenu();
    }, [location]);

    // Закрытие меню при клике вне области меню и кнопки бургера
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                isMobileMenuOpen && // Только если меню открыто
                mobileMenuRef.current &&
                !mobileMenuRef.current.contains(event.target) &&
                burgerButtonRef.current &&
                !burgerButtonRef.current.contains(event.target)
            ) {
                closeMobileMenu();
            }
        };
        // Добавляем слушатель только когда меню открыто для оптимизации
        if (isMobileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        // Очистка слушателя
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMobileMenuOpen]); // Зависимость от состояния меню

    // Блокировка скролла основной страницы при открытом мобильном меню
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = ''; // Возвращаем скролл по умолчанию
        }
        // Очистка стиля при размонтировании компонента
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileMenuOpen]); // Зависимость от состояния меню

    // --- Action Handlers ---
    // Выход из системы
    const handleLogout = () => {
        dispatch(logout());
        closeMobileMenu(); // Закрываем меню при выходе
        navigate(`/${currentLang}/login`); // Редирект на страницу входа с текущим языком
    };

    // Функция смены языка и навигации
    const changeLanguage = (lng) => {
        if (lng === currentLang) return; // Не делаем ничего, если язык уже выбран

        const currentPath = location.pathname;
        let basePath = '/'; // Путь по умолчанию

        // Ищем языковой префикс в начале пути
        const langPrefixMatch = currentPath.match(/^\/([a-z]{2})(\/.*)?$/);
        if (langPrefixMatch && supportedLngs.includes(langPrefixMatch[1])) {
             // Если найден поддерживаемый префикс, берем путь после него
             basePath = langPrefixMatch[2] || '/'; // Путь после языка или просто '/'
        } else if (currentPath.startsWith('/')) {
            // Если префикс не найден или не поддерживается, считаем весь путь базовым
             basePath = currentPath;
        }

        // Убираем лишний слэш в начале basePath, если он там есть (кроме случая, когда это корень)
        basePath = basePath !== '/' && basePath.startsWith('/') ? basePath.substring(1) : basePath;
        // Убеждаемся, что базовый путь начинается со слэша (если он не пустой)
        basePath = basePath && !basePath.startsWith('/') ? '/' + basePath : basePath;
         // Корректируем для корня языка
        basePath = (basePath === '/') ? '' : basePath;

        const newPath = `/${lng}${basePath}`; // Формируем новый полный путь

        console.log(`[Lang Switch] Current: ${currentPath}, Base: ${basePath}, New Lang: ${lng}, New Path: ${newPath}`);
        navigate(newPath + location.search + location.hash); // Переходим по новому пути
        closeMobileMenu(); // Закрываем мобильное меню
    };

    // Вспомогательная функция для генерации путей с текущим языком
    const langPath = (path) => {
        // Убираем начальный слэш из path, если он есть, чтобы избежать двойного слэша
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        // Формируем путь
        const finalPath = `/${currentLang}/${cleanPath}`;
        // Убираем конечный слэш, если он есть и путь не корневой для языка
        return finalPath.length > currentLang.length + 2 && finalPath.endsWith('/') ? finalPath.slice(0, -1) : finalPath;
     };


    return (
        <header className={styles.header}>
            <div className={styles.container}>
                {/* Логотип -> ссылка на главную страницу текущего языка */}
                <Link to={langPath('/')} className={styles.logo} onClick={closeMobileMenu}>
                    <i className="fas fa-volleyball-ball"></i>
                    <span>{t('site_name', 'UniSport')}</span>
                </Link>

                {/* Десктопная Навигация */}
                <nav className={styles.nav}>
                    {/* Используем КОРРЕКТНЫЕ КЛЮЧИ i18n и langPath */}
                    <NavLink to={langPath('/facilities')} className={({ isActive }) => clsx(styles.navLink, isActive && styles.navLinkActive)}>
                        {t('nav.facilities', 'Объекты')}
                    </NavLink>
                    <NavLink to={langPath('/universities')} className={({ isActive }) => clsx(styles.navLink, isActive && styles.navLinkActive)}>
                        {t('nav.universities', 'Университеты')}
                    </NavLink>
                    {/* Можно добавить другие ссылки, например: */}
                    {/* <NavLink to={langPath('/info/faq')} className={({ isActive }) => clsx(styles.navLink, isActive && styles.navLinkActive)}> {t('nav.faq', 'ЧаВо')} </NavLink> */}
                </nav>

                 {/* Переключатель языка (Десктоп) */}
                 <div className={styles.langSwitcher}>
                    <button onClick={() => changeLanguage('uz')} className={clsx(styles.langButton, currentLang === 'uz' && styles.langButtonActive)} disabled={currentLang === 'uz'} > UZ </button>
                    <span className={styles.langSeparator}>|</span>
                    <button onClick={() => changeLanguage('ru')} className={clsx(styles.langButton, currentLang === 'ru' && styles.langButtonActive)} disabled={currentLang === 'ru'} > RU </button>
                </div>

                 {/* Действия пользователя (Десктоп) */}
                <div className={styles.actions}>
                    {isAuthenticated ? (
                        <>
                            <Link to={langPath('/dashboard')} className={styles.userName} title={user?.email}>
                                <i className="fas fa-user-circle"></i>
                                <span>{user?.first_name || t('common.profile', 'Профиль')}</span>
                            </Link>
                            {/* Используем КОРРЕКТНЫЙ КЛЮЧ */}
                            <button onClick={handleLogout} className={styles.logoutButton} title={t('header.logout_button', 'Выйти')}>
                                <i className="fas fa-sign-out-alt"></i>
                            </button>
                        </>
                    ) : (
                        <>
                             {/* Используем КОРРЕКТНЫЕ КЛЮЧИ */}
                            <Link to={langPath('/login')} className={clsx(styles.button, styles.buttonOutline)}> {t('header.login_button', 'Войти')} </Link>
                            <Link to={langPath('/register')} className={clsx(styles.button, styles.buttonPrimary)}> {t('header.register_button', 'Регистрация')} </Link>
                        </>
                    )}
                </div>

                {/* Кнопка Бургер (Мобильные) */}
                <button ref={burgerButtonRef} className={styles.burgerButton} onClick={toggleMobileMenu} aria-label={isMobileMenuOpen ? t('header.close_menu', "Закрыть меню") : t('header.open_menu', "Открыть меню")} aria-expanded={isMobileMenuOpen} aria-controls="mobileMenu">
                     <i className={clsx("fas", isMobileMenuOpen ? "fa-times" : "fa-bars")}></i>
                </button>
            </div>

            {/* Мобильное меню */}
             <div ref={mobileMenuRef} id="mobileMenu" className={clsx(styles.mobileMenu, isMobileMenuOpen && styles.mobileMenuOpen)} aria-hidden={!isMobileMenuOpen}>
                 <>
                     {/* Переключатель языка (Мобильный) */}
                     <div className={styles.mobileLangSwitcher}>
                         <button onClick={() => changeLanguage('uz')} className={clsx(styles.langButton, currentLang === 'uz' && styles.langButtonActive)} disabled={currentLang === 'uz'} > O'zbekcha </button>
                         <button onClick={() => changeLanguage('ru')} className={clsx(styles.langButton, currentLang === 'ru' && styles.langButtonActive)} disabled={currentLang === 'ru'} > Русский </button>
                     </div>
                     <hr className={styles.mobileDivider} />

                     {/* Навигация в моб. меню */}
                     <nav className={styles.mobileNav}>
                          {/* Используем КОРРЕКТНЫЕ КЛЮЧИ */}
                         <NavLink to={langPath('/facilities')} className={({ isActive }) => clsx(styles.mobileNavLink, isActive && styles.mobileNavLinkActive)} onClick={closeMobileMenu} > <i className="fas fa-futbol"></i> {t('nav.facilities', 'Объекты')} </NavLink>
                         <NavLink to={langPath('/universities')} className={({ isActive }) => clsx(styles.mobileNavLink, isActive && styles.mobileNavLinkActive)} onClick={closeMobileMenu} > <i className="fas fa-university"></i> {t('nav.universities', 'Университеты')} </NavLink>
                         <NavLink to={langPath('/info/faq')} className={({ isActive }) => clsx(styles.mobileNavLink, isActive && styles.mobileNavLinkActive)} onClick={closeMobileMenu} > <i className="fas fa-question-circle"></i> {t('nav.faq', 'ЧаВо')} </NavLink>
                     </nav>
                     <hr className={styles.mobileDivider} />

                     {/* Действия пользователя в моб. меню */}
                     <div className={styles.mobileActions}>
                         {isAuthenticated ? (
                             <>
                                 <Link to={langPath('/dashboard')} className={styles.mobileUserLink} onClick={closeMobileMenu}> <i className="fas fa-user-circle"></i> <span>{user?.first_name || t('common.profile', 'Профиль')}</span> <i className={clsx("fas fa-chevron-right", styles.mobileActionChevron)}></i> </Link>
                                 {/* Используем КОРРЕКТНЫЙ КЛЮЧ */}
                                 <button onClick={handleLogout} className={styles.mobileLogoutButton}> <i className="fas fa-sign-out-alt"></i> <span>{t('header.logout_button', 'Выйти')}</span> </button>
                             </>
                         ) : (
                             <>
                                  {/* Используем КОРРЕКТНЫЕ КЛЮЧИ */}
                                 <Link to={langPath('/login')} className={clsx(styles.mobileButton, styles.buttonOutline)} onClick={closeMobileMenu}> <i className="fas fa-sign-in-alt"></i> {t('header.login_button', 'Войти')} </Link>
                                 <Link to={langPath('/register')} className={clsx(styles.mobileButton, styles.buttonPrimary)} onClick={closeMobileMenu}> <i className="fas fa-user-plus"></i> {t('header.register_button', 'Регистрация')} </Link>
                             </>
                         )}
                     </div>
                 </>
             </div>
             {/* Оверлей для мобильного меню */}
             {isMobileMenuOpen && <div className={styles.mobileMenuOverlay} onClick={closeMobileMenu}></div>}
        </header>
    );
};
export default Header;
// --- END OF FULL FILE ---