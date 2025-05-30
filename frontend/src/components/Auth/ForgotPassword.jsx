// --- START OF FULL FILE frontend/src/components/Auth/ForgotPassword.jsx ---
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query'; // Используем useMutation для запроса
import { useDispatch } from 'react-redux'; // Если нужно диспатчить что-то
import { useTranslation } from 'react-i18next'; // <-- Импорт для переводов
import clsx from 'clsx';

import { requestPasswordReset } from '../../services/api'; // API функция
import LoadingSpinner from '../Common/LoadingSpinner'; // Импорт спиннера
import styles from './AuthStyles.module.css'; // Общие стили аутентификации

const ForgotPassword = () => {
  const { t, i18n } = useTranslation(); // <-- Получаем t и i18n
  const currentLang = i18n.language; // Текущий язык для ссылок

  const [email, setEmail] = useState('');
  // Состояния для сообщений теперь управляются мутацией useMutation
  // const [isLoading, setIsLoading] = useState(false);
  // const [message, setMessage] = useState('');
  // const [error, setError] = useState('');

  // Мутация для запроса сброса пароля
  const mutation = useMutation({
    mutationFn: requestPasswordReset, // Функция, выполняющая API запрос
    onSuccess: (data) => {
        // Действия при успехе (сообщение уже обработано в JSX)
        console.log("Password reset request success:", data);
        setEmail(''); // Очищаем поле email
    },
    onError: (error) => {
        // Действия при ошибке (сообщение уже обработано в JSX)
        console.error("Password reset request error:", error.response?.data || error.message);
    },
  });

  // Обработчик отправки формы
  const handleSubmit = (e) => {
    e.preventDefault();
    if (mutation.isLoading) return; // Предотвращаем двойной сабмит
    mutation.mutate({ email }); // Выполняем мутацию с данными email
  };

  // Функция рендеринга ошибок (для email поля, если API его вернет)
   const renderFieldError = (field) => {
        const apiError = mutation.error?.response?.data; // Ошибка от useMutation
        const messages = apiError?.[field];
        if (messages && Array.isArray(messages)) {
             // Пытаемся перевести первую ошибку поля
             const firstMessage = messages[0];
             const translationKey = `errors.field.${field}.${firstMessage.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
            return <small className={styles.fieldError}>{t(translationKey, firstMessage)}</small>;
        }
        return null;
    }
   // Функция рендеринга общих ошибок (например, 'Not found')
   const renderGeneralError = () => {
       if (mutation.isError && mutation.error) {
           const apiError = mutation.error.response?.data;
           // Ищем 'detail' или строковую ошибку, ИСКЛЮЧАЯ ошибки поля email
           const generalError = apiError?.detail ||
                                (!apiError?.email && typeof apiError === 'string' ? apiError : null) || // Строка, если не ошибка поля
                                (!apiError?.email && !apiError?.detail && mutation.error.message ? mutation.error.message : null); // Ошибка сети/axios

            if (generalError) {
                 const key = `errors.forgot_password.${generalError.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
                 return <p className={styles.errorMessage}>{t(key, generalError)}</p>;
             }
       }
       return null;
   }


  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{t('forgot_password.title', 'Сброс пароля')}</h2>
      <p className={styles.subtitle}>{t('forgot_password.subtitle', 'Введите email, связанный с вашим аккаунтом.')}</p>

      {/* Сообщение об успехе из useMutation */}
      {mutation.isSuccess && (
        <p className={styles.successMessage}>
            {t('forgot_password.success_message', 'Письмо для сброса пароля отправлено на ваш email (если аккаунт существует). Пожалуйста, проверьте почту.')}
        </p>
      )}

      {/* Общие ошибки из useMutation */}
      {renderGeneralError()}

      {/* Показываем форму, только если нет сообщения об успехе */}
      {!mutation.isSuccess && (
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="forgot-email">{t('forgot_password.email_label', 'Email')}</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t('forgot_password.email_placeholder', 'Введите ваш email')}
                // Подсвечиваем поле при ЛЮБОЙ ошибке мутации (включая ошибку поля email)
                className={clsx(styles.input, mutation.isError && styles.inputError)}
                aria-invalid={mutation.isError}
                disabled={mutation.isLoading} // Блокируем поле во время запроса
              />
              {/* Ошибка конкретно для поля email */}
              {renderFieldError('email')}
            </div>
            <button type="submit" disabled={mutation.isLoading} className={styles.button}>
              {mutation.isLoading ? (
                  <>
                      <LoadingSpinner size="1em" color="#fff" text="" display="inline" />
                      <span style={{marginLeft: '8px'}}>{t('forgot_password.loading_button', 'Отправка...')}</span>
                  </>
               ) : (
                   t('forgot_password.submit_button', 'Отправить ссылку для сброса')
               )}
            </button>
          </form>
      )}

      <div className={styles.linksContainer}>
        {/* Ссылка на логин с учетом языка */}
        <Link to={`/${currentLang}/login`} className={styles.link}>
            {t('forgot_password.back_to_login_link', 'Вернуться ко входу')}
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
// --- END OF FULL FILE ---