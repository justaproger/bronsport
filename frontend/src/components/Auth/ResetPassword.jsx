// --- START OF FULL FILE frontend/src/components/Auth/ResetPassword.jsx ---
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query'; // Импортируем useQuery для валидации
import { useTranslation } from 'react-i18next'; // <-- Импорт для переводов
import clsx from 'clsx';

import { confirmPasswordReset, validateResetToken } from '../../services/api'; // API функции
import LoadingSpinner from '../Common/LoadingSpinner';
import styles from './AuthStyles.module.css'; // Общие стили

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation(); // <-- Получаем t и i18n
    const currentLang = i18n.language; // Текущий язык для ссылок

    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [formErrors, setFormErrors] = useState({}); // Локальные ошибки валидации формы

    // --- Валидация токена через useQuery ---
    const {
        data: tokenValidationData, // Не используем данные, только статус
        isLoading: isCheckingToken,
        isError: isTokenInvalid, // Используем isError как флаг невалидности
        error: tokenValidationError, // Ошибка валидации
    } = useQuery({
        queryKey: ['validateResetToken', token], // Ключ зависит от токена
        queryFn: () => validateResetToken({ token }), // Выполняем запрос
        enabled: !!token, // Запрос активен только если токен есть в URL
        retry: false, // Не повторять запрос при ошибке (токен скорее всего невалиден)
        staleTime: Infinity, // Результат валидации не устаревает
        gcTime: Infinity, // Не удалять из кэша
        refetchOnWindowFocus: false, // Не проверять заново при фокусе
    });

    // --- Мутация для подтверждения сброса пароля ---
    const mutation = useMutation({
        mutationFn: confirmPasswordReset,
        onSuccess: () => {
            // Сообщение об успехе будет показано в JSX
            console.log("Password reset confirmation success");
            // Редирект на логин через 3 секунды
            setTimeout(() => navigate(`/${currentLang}/login`), 3000);
        },
        onError: (error) => {
            // Ошибки будут обработаны в JSX
            console.error("Password reset confirmation error:", error.response?.data || error.message);
        }
    });

    // Обработчик изменения полей пароля
    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        if (name === 'password') setPassword(value);
        if (name === 'passwordConfirm') setPasswordConfirm(value);
        // Сбрасываем ошибки при вводе
        if (formErrors.password || formErrors.passwordConfirm || formErrors.non_field_errors) {
             setFormErrors({});
        }
        if (mutation.isError) { // Сбрасываем и ошибку мутации
            mutation.reset();
        }
    };

    // Локальная валидация паролей
    const validatePasswords = () => {
        const errors = {};
        if (!password) errors.password = [t('validation.required_password', 'Пароль обязателен.')];
        else if (password.length < 8) errors.password = [t('validation.password_min_length', 'Пароль должен быть не менее 8 символов.')];
        if (!passwordConfirm) errors.passwordConfirm = [t('validation.required_password2', 'Подтверждение пароля обязательно.')];
        else if (password && password !== passwordConfirm) errors.non_field_errors = [t('validation.passwords_mismatch', 'Пароли не совпадают.')];

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    // Обработчик отправки формы
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (mutation.isLoading) return;
        setFormErrors({}); // Сброс локальных ошибок
        mutation.reset(); // Сброс состояния мутации (ошибок/успеха)

        if (validatePasswords()) {
            mutation.mutate({ token, password: password }); // Выполняем мутацию
        }
    };

     // Хелперы для отображения ошибок
     const renderFieldError = (field) => {
         // Объединяем локальные ошибки и ошибки API для поля
         const localMessages = formErrors?.[field] || [];
         const apiMessages = mutation.error?.response?.data?.[field] || [];
         const messages = [...localMessages, ...apiMessages];

         if (messages.length > 0) {
             // Отображаем только первое сообщение
             const firstMessage = messages[0];
             const key = `errors.field.${field}.${firstMessage.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
             return <small className={styles.fieldError}>{t(key, firstMessage)}</small>;
         }
         return null;
     }
     const renderNonFieldErrors = () => {
        // Объединяем локальные и API ошибки, не связанные с полями
        const localMessages = formErrors?.non_field_errors || [];
        const apiData = mutation.error?.response?.data;
        const apiNonField = apiData?.non_field_errors || [];
        const apiDetail = apiData?.detail ? [apiData.detail] : [];
        // Ошибка токена от API подтверждения (если не была поймана валидацией)
        const apiTokenError = apiData?.token ? apiData.token : [];

        const messages = [...localMessages, ...apiNonField, ...apiDetail, ...apiTokenError];

        if (messages.length > 0) {
             return messages.map((msg, index) => {
                const key = `errors.reset_password.${msg.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
                return <p key={index} className={styles.errorMessage}>{t(key, msg)}</p>
             });
         }
         // Если есть общая ошибка сети/axios
          if (mutation.isError && !mutation.error.response?.data && messages.length === 0) {
              return <p className={styles.errorMessage}>{t('errors.network_error', 'Ошибка сети. Попробуйте еще раз.')}</p>;
          }
         return null;
     }

    // --- Логика отображения ---

    // 1. Загрузка проверки токена
    if (isCheckingToken) {
        return <div className={styles.container}><LoadingSpinner text={t('reset_password.checking_token', "Проверка токена...")} /></div>;
    }

    // 2. Токен невалиден
    if (isTokenInvalid) {
        // Формируем сообщение об ошибке валидации
        const validationErrorMsg = tokenValidationError?.response?.data?.detail
            || tokenValidationError?.message
            || t('reset_password.invalid_token_default', 'Недействительный или просроченный токен.');
        const translatedError = t(`errors.token.${validationErrorMsg.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`, validationErrorMsg);

        return (
            <div className={styles.container}>
                <h2 className={styles.title}>{t('common.error', 'Ошибка')}</h2>
                <p className={styles.errorMessage}>{translatedError}</p>
                 <div className={styles.linksContainer}>
                    <Link to={`/${currentLang}/forgot-password`} className={styles.link}>{t('reset_password.request_again_link', 'Запросить сброс снова')}</Link> | <Link to={`/${currentLang}/login`} className={styles.link}>{t('forgot_password.back_to_login_link', 'Войти')}</Link>
                 </div>
            </div>
        );
    }

    // 3. Успешный сброс пароля
    if (mutation.isSuccess) {
         return (
            <div className={styles.container}>
                 <h2 className={styles.title}>{t('reset_password.success_title', 'Пароль изменен!')}</h2>
                 <p className={styles.successMessage}>{t('reset_password.success_message', 'Пароль успешно изменен! Теперь вы можете войти с новым паролем.')}</p>
                 <div className={styles.linksContainer}>
                     <Link to={`/${currentLang}/login`} className={styles.link}>{t('reset_password.go_to_login_link', 'Перейти ко входу')}</Link>
                 </div>
            </div>
        );
    }

    // 4. Отображение формы (токен валиден, сброс еще не выполнен или была ошибка)
    return (
        <div className={styles.container}>
            <h2 className={styles.title}>{t('reset_password.form_title', 'Установите новый пароль')}</h2>
            {renderNonFieldErrors()} {/* Общие ошибки формы/API */}
            <form onSubmit={handleSubmit} noValidate>
                <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="reset-password">{t('reset_password.new_password_label', 'Новый пароль')}*</label>
                    <input type="password" id="reset-password" name="password" value={password}
                        onChange={handlePasswordChange} required
                        placeholder={t('reset_password.new_password_placeholder', 'Введите новый пароль (мин. 8 симв.)')}
                        className={clsx(styles.input, (formErrors?.password || mutation.error?.response?.data?.password) && styles.inputError)}
                        autoComplete="new-password"
                        aria-invalid={!!(formErrors?.password || mutation.error?.response?.data?.password)}
                        disabled={mutation.isLoading}
                     />
                     <small className={styles.helperText}>{t('register.password_hint', 'Минимум 8 символов')}</small>
                    {renderFieldError('password')}
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="reset-password-confirm">{t('reset_password.confirm_password_label', 'Подтвердите пароль')}*</label>
                    <input type="password" id="reset-password-confirm" name="passwordConfirm" value={passwordConfirm}
                        onChange={handlePasswordChange} required
                        placeholder={t('reset_password.confirm_password_placeholder', 'Повторите новый пароль')}
                        className={clsx(styles.input, (formErrors?.passwordConfirm || mutation.error?.response?.data?.passwordConfirm || formErrors?.non_field_errors) && styles.inputError)}
                        autoComplete="new-password"
                        aria-invalid={!!(formErrors?.passwordConfirm || mutation.error?.response?.data?.passwordConfirm || formErrors?.non_field_errors)}
                        disabled={mutation.isLoading}
                    />
                    {renderFieldError('passwordConfirm')}
                </div>
                <button type="submit" disabled={mutation.isLoading} className={styles.button}>
                    {mutation.isLoading ? (
                        <>
                           <LoadingSpinner size="1em" color="#fff" text="" display="inline" />
                            <span style={{marginLeft: '8px'}}>{t('reset_password.loading_button', 'Сохранение...')}</span>
                        </>
                    ) : (
                        t('reset_password.submit_button', 'Установить новый пароль')
                    )}
                </button>
            </form>
        </div>
    );
};

export default ResetPassword;
// --- END OF FULL FILE ---