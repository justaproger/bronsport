// --- START OF FULL FILE frontend/src/pages/Info/InfoPageLayout.jsx ---
import React, {useMemo} from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // <-- Импорт
import clsx from 'clsx';
import styles from './InfoPageLayout.module.css'; // Стили макета

const InfoPageLayout = () => {
    const { t, i18n } = useTranslation(); // <-- Получаем t и i18n
    const currentLang = i18n.language; // Текущий язык
    const location = useLocation();

    // --- Список инфо-страниц с ключами для перевода ---
    const infoPages = useMemo(() => [
        // Путь теперь формируется без языкового префикса
        { path: 'about', titleKey: 'info_nav.about', defaultTitle: 'О нас' },
        { path: 'contact', titleKey: 'info_nav.contact', defaultTitle: 'Контакты' },
        { path: 'faq', titleKey: 'info_nav.faq', defaultTitle: 'ЧаВо' },
        { path: 'terms', titleKey: 'info_nav.terms', defaultTitle: 'Условия пользования' },
        { path: 'privacy', titleKey: 'info_nav.privacy', defaultTitle: 'Политика конфиденциальности' },
    ], [t]); // Пересчитываем, если язык изменился (хотя ключи стабильны)

    // Хелпер для полного пути с языком
    const langPath = (subpath) => `/${currentLang}/info/${subpath}`;

    // Определяем заголовок текущей страницы
    // Сравниваем конец pathname с путями из infoPages
    const currentPage = infoPages.find(page => location.pathname.endsWith(`/${page.path}`));
    const pageTitle = currentPage ? t(currentPage.titleKey, currentPage.defaultTitle) : t('info_nav.default_title', 'Информация');


    return (
        <div className={styles.pageWrapper}>
            <div className={styles.container}>
                {/* Хлебные крошки */}
                <div className={styles.pageHeader}>
                    <div className={styles.breadcrumbs}>
                        <Link to={`/${currentLang}/`} className={styles.breadcrumbLink}>{t('footer.home', 'Главная')}</Link>
                         <span>/</span> {pageTitle}
                    </div>
                    <h1 className={styles.pageTitle}>{pageTitle}</h1>
                </div>

                {/* Макет: Сайдбар + Контент */}
                <div className={styles.layoutGrid}>
                    {/* Левый сайдбар с навигацией */}
                    <aside className={styles.sidebar}>
                        <nav>
                            <ul className={styles.sidebarNav}>
                                {infoPages.map(page => (
                                    <li key={page.path}>
                                        {/* NavLink использует полный путь с языком */}
                                        <NavLink
                                            to={langPath(page.path)}
                                            // Класс активности проверяется по полному совпадению пути
                                            className={({ isActive }) => clsx(styles.navLink, isActive && styles.navLinkActive)}
                                        >
                                            {/* Текст ссылки переводится */}
                                            {t(page.titleKey, page.defaultTitle)}
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </aside>

                    {/* Область для отображения контента */}
                    <main className={styles.contentArea}>
                        {/* Сюда рендерятся AboutContent, TermsContent и т.д. */}
                        {/* Переводы внутри этих компонентов нужно будет сделать отдельно */}
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
};

export default InfoPageLayout;
// --- END OF FULL FILE ---