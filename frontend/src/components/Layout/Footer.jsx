// --- START OF FULL MODIFIED frontend/src/components/Layout/Footer.jsx ---
import React from 'react'; // Убрали useMemo, если он не используется для других целей
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useSelector } from 'react-redux'; // Для ссылки на QR-сканер
import styles from './Footer.module.css';

const Footer = ({ currentLang }) => { // currentLang можно убрать, если всегда берем из i18n
    const { t, i18n } = useTranslation();
    const lang = currentLang || i18n.language || 'uz'; // Язык для langPath
    const { user, isAuthenticated } = useSelector(state => state.auth); // Для условной ссылки

    const langPath = (path) => `/${lang}${path.startsWith('/') ? '' : '/'}${path}`;
    
    const currentYear = new Date().getFullYear(); // Получаем текущий год

    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.grid}>
                    {/* Колонка 1: Лого и описание */}
                    <div className={styles.col}>
                        <Link to={langPath('/')} className={styles.logo}>
                             <i className="fas fa-volleyball-ball"></i> {/* Или ваш новый логотип */}
                             <span>{t('site_name', 'Bronsport')}</span>
                        </Link>
                        <p className={styles.description}>
                            {t('footer.description')}
                        </p>
                         <div className={styles.socialLinks}>
                            <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Telegram" title="Telegram"><i className="fab fa-telegram-plane"></i></a>
                            <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook"><i className="fab fa-facebook-f"></i></a>
                            <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram"><i className="fab fa-instagram"></i></a>
                        </div>
                    </div>

                    {/* Колонка 2: Навигация */}
                    <div className={styles.col}>
                        <h4 className={styles.colTitle}>{t('footer.navigation')}</h4>
                        <ul className={styles.linkList}>
                            <li><Link to={langPath('/')}>{t('footer.home')}</Link></li>
                            <li><Link to={langPath('/facilities')}>{t('nav.facilities')}</Link></li>
                            <li><Link to={langPath('/universities')}>{t('nav.universities')}</Link></li>
                            <li><Link to={langPath('/dashboard')}>{t('footer.my_account')}</Link></li>
                        </ul>
                    </div>

                     {/* Колонка 3: Информация */}
                     <div className={styles.col}>
                        <h4 className={styles.colTitle}>{t('footer.information')}</h4>
                         <ul className={styles.linkList}>
                            <li><Link to={langPath('/info/about')}>{t('footer.about')}</Link></li>
                            <li><Link to={langPath('/info/faq')}>{t('footer.faq')}</Link></li>
                            <li><Link to={langPath('/info/terms')}>{t('footer.terms')}</Link></li>
                            <li><Link to={langPath('/info/privacy')}>{t('footer.privacy')}</Link></li>
                        </ul>
                    </div>

                     {/* Колонка 4: Поддержка (включая ссылку на QR-сканер) */}
                     <div className={styles.col}>
                        <h4 className={styles.colTitle}>{t('footer.support')}</h4>
                        <ul className={styles.contactList}>
                            <li><i className="fas fa-phone-alt"></i> <a href="tel:+998993748277">+998 99 374 82 77</a></li>
                            <li><i className="fas fa-envelope"></i> <a href="mailto:main.teamx@gmail.com">main.teamx@gmail.com</a></li>
                            <li><i className="fas fa-map-marker-alt"></i> {t('footer.address')}</li>
                             {isAuthenticated && user?.is_staff && ( // Ссылка на QR-сканер
                                <li style={{ marginTop: '0.5rem' }}> {/* Добавил небольшой отступ для ссылки на QR */}
                                    <i className="fas fa-qrcode"></i>
                                    <Link to={langPath('/qr-scanner')} style={{color: 'var(--gray-medium)'}}>{t('footer.qr_scanner_link')}</Link>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
             </div>

             <div className={styles.bottomBar}>
                <div className={clsx(styles.container, styles.bottomBarContent)}>
                     {/* Используем интерполяцию для года */}
                     <span>{t('footer.copyright', { year: currentYear })}</span>
                     <div className={styles.teamCredit}>
                         {t('footer.made_by')} <span className={styles.heart}>❤️</span> by TEAMx
                     </div>
                 </div>
            </div>
        </footer>
    );
};

export default Footer;
// --- END OF FULL MODIFIED frontend/src/components/Layout/Footer.jsx ---