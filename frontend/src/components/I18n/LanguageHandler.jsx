// --- START OF FILE frontend/src/components/I18n/LanguageHandler.jsx ---
import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n'; // Импортируем наш инстанс i18n

const supportedLngs = ['uz', 'ru']; // Должно совпадать с i18n.js
const fallbackLng = 'uz'; // Язык по умолчанию

const LanguageHandler = () => {
    const { lang } = useParams(); // Получаем язык из URL
    const navigate = useNavigate();
    const location = useLocation();
    const { i18n: i18nInstance } = useTranslation(); // Получаем инстанс из хука

    useEffect(() => {
        const currentLang = lang || fallbackLng; // Берем из URL или язык по умолчанию

        // 1. Валидация языка
        if (!supportedLngs.includes(currentLang)) {
            console.warn(`[i18n] Unsupported language '${currentLang}' in URL, redirecting to fallback '${fallbackLng}'.`);
            // Заменяем невалидный язык на язык по умолчанию в текущем пути
            const newPath = location.pathname.replace(`/${lang}`, `/${fallbackLng}`);
            navigate(newPath + location.search + location.hash, { replace: true });
            return; // Прерываем выполнение эффекта
        }

        // 2. Установка языка, если он отличается от текущего в i18next
        if (i18nInstance.language !== currentLang) {
             console.log(`[i18n] Changing language from '${i18nInstance.language}' to '${currentLang}' based on URL.`);
             i18nInstance.changeLanguage(currentLang);
             // Локаль для dayjs уже меняется через слушатель в i18n.js
        }

        // 3. Установка атрибута lang для тега <html>
        document.documentElement.lang = currentLang;

    }, [lang, location.pathname, location.search, location.hash, navigate, i18nInstance]);

    // Если язык еще не установлен (например, при первой загрузке)
    // или если язык некорректен и идет редирект,
    // можно показать заглушку или просто вернуть Outlet
    // if (!i18nInstance.language || !supportedLngs.includes(i18nInstance.language)) {
    //     // Можно вернуть спиннер, но Suspense в main.jsx должен справиться
    //     return <div>Loading language...</div>;
    // }

    // Рендерим дочерние роуты
    return <Outlet />;
};

export default LanguageHandler;
// --- END OF FILE ---