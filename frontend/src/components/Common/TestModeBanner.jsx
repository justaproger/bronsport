// frontend/src/components/Common/TestModeBanner.jsx
// --- START OF FULL FILE frontend/src/components/Common/TestModeBanner.jsx ---
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TestModeBanner.module.css';

const TestModeBanner = () => {
    const { t } = useTranslation();

    // Определяем, нужно ли показывать баннер
    // VITE_APP_ENVIRONMENT должно быть установлено в 'test' или 'test_release'
    // или любой другой флаг, который вы решите использовать для обозначения тестового режима на проде.
    // Если VITE_APP_ENVIRONMENT не установлено, баннер не показывается.
    const appEnvironment = import.meta.env.VITE_APP_ENVIRONMENT;
    const showBanner = appEnvironment === 'test' || appEnvironment === 'test_release' || import.meta.env.DEV; // Показываем в DEV всегда или если ENV=test*

    if (!showBanner) {
        return null;
    }

    return (
        <div className={styles.testModeBanner} role="alert">
            <p className={styles.bannerText}>
                {t('common.test_mode_banner_text', 'The site is currently running in test mode!')}
            </p>
        </div>
    );
};

export default TestModeBanner;
// --- END OF FULL FILE ---