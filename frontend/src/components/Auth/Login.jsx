// --- START OF FULL FILE frontend/src/components/Auth/Login.jsx ---
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearAuthError } from '../../store/authSlice';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next'; // <-- Импорт useTranslation
import styles from './AuthStyles.module.css';

const Login = () => {
  const { t, i18n } = useTranslation(); // <-- Получаем t и i18n
  const currentLang = i18n.language; // <-- Получаем текущий язык для ссылок

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, error } = useSelector((state) => state.auth);

  // Определяем целевой путь после логина с учетом языка
  const from = location.state?.from?.pathname || `/${currentLang}/dashboard`;

  // Очистка ошибок API при монтировании/размонтировании
  useEffect(() => {
      dispatch(clearAuthError());
      return () => { dispatch(clearAuthError()); };
  }, [dispatch]);

  // Редирект после успешного логина
  useEffect(() => {
    if (isAuthenticated) {
      // Убедимся, что редирект идет на URL с правильным языком
      // Если 'from' уже содержит язык, используем его, иначе - текущий язык
      const redirectPath = from.startsWith(`/${currentLang}/`) ? from : `/${currentLang}${from.startsWith('/') ? '' : '/'}${from}`;
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, from, currentLang]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isLoading) {
      dispatch(clearAuthError());
      dispatch(login({ email, password }))
        .unwrap()
        .catch((loginError) => {
            console.error('Login failed:', loginError);
        });
    }
  };

   // Функция рендеринга ошибок (без изменений в логике, но текст ошибок тоже можно перевести)
   const renderError = () => {
        if (!error) return null;
        const generalError = error?.detail || (typeof error === 'string' ? error : null);
        // Пытаемся перевести стандартные ошибки или показываем как есть
        const translatedError = generalError ? t(`errors.${generalError}`, generalError) : null;
        if (translatedError) {
            return <p className={styles.errorMessage}>{translatedError}</p>;
        }
        return null;
    };
   const renderFieldError = (field) => {
        const messages = error?.[field];
        if (messages && Array.isArray(messages)) {
             // Пытаемся перевести первую ошибку поля
             const key = `errors.field.${field}.${messages[0].toLowerCase().replace(/\s+/g, '_')}`; // Генерируем ключ
            return <small className={styles.fieldError}>{t(key, messages[0])}</small>;
        }
        return null;
    }

  return (
    <div className={styles.container}>
      {/* Используем t() для заголовков и текста */}
      <h2 className={styles.title}>{t('login.title')}</h2>
      <p className={styles.subtitle}>{t('login.subtitle')}</p>

      {renderError()} {/* Общие ошибки */}
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="login-email">{t('login.email_label')}</label>
          <input
            id="login-email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            placeholder={t('login.email_placeholder')} // <-- Перевод плейсхолдера
            className={clsx(styles.input, error?.email && styles.inputError)}
            aria-invalid={!!error?.email}
          />
           {renderFieldError('email')}
        </div>
        <div className={styles.formGroup} style={{ marginBottom: '0.5rem' }}>
          <label className={styles.label} htmlFor="login-password">{t('login.password_label')}</label>
          <input
            id="login-password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} required
            placeholder={t('login.password_placeholder')} // <-- Перевод плейсхолдера
            className={clsx(styles.input, error?.password && styles.inputError)}
            aria-invalid={!!error?.password}
          />
           {renderFieldError('password')}
        </div>
        <div className={styles.forgotPasswordLinkContainer}>
          {/* Ссылка с учетом языка */}
          <Link to={`/${currentLang}/forgot-password`} className={styles.forgotPasswordLink}>
            {t('login.forgot_password_link')}
          </Link>
        </div>
        <button type="submit" disabled={isLoading} className={styles.button}>
          {isLoading ? t('login.loading_button') : t('login.submit_button')}
        </button>
      </form>
      <div className={styles.linksContainer}>
        {t('login.no_account_prompt')}{' '}
        {/* Ссылка с учетом языка */}
        <Link to={`/${currentLang}/register`} className={styles.link}>
          {t('login.register_link')}
        </Link>
      </div>
    </div>
  );
};

export default Login;
// --- END OF FULL FILE ---