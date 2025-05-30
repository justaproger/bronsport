// --- START OF FULL FILE frontend/src/components/Auth/Register.jsx ---
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { register, resetRegistrationStatus, clearAuthError } from '../../store/authSlice';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next'; // <-- Импорт
import styles from './AuthStyles.module.css';

const Register = () => {
  const { t, i18n } = useTranslation(); // <-- Получаем t и i18n
  const currentLang = i18n.language; // <-- Текущий язык для ссылок

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone_number: '', password: '', password2: '',
  });
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error, registrationSuccess } = useSelector((state) => state.auth);
  const [formErrors, setFormErrors] = useState({}); // Локальные ошибки валидации

  // Очистка ошибок API при монтировании/размонтировании
  useEffect(() => {
      dispatch(clearAuthError());
      return () => { dispatch(clearAuthError()); };
  }, [dispatch]);

  // Редирект после успешной регистрации
  useEffect(() => {
      if (registrationSuccess) {
          // Используем перевод для alert
          alert(t('register.success_alert', 'Регистрация прошла успешно! Пожалуйста, войдите.'));
          dispatch(resetRegistrationStatus());
          navigate(`/${currentLang}/login`); // Редирект на логин с текущим языком
      }
  }, [registrationSuccess, dispatch, navigate, currentLang, t]); // Добавили t и currentLang

  // Обработчик изменения полей формы
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Очищаем локальную и API ошибку для этого поля при изменении
    if (formErrors[name] || (error && error[name])) {
        setFormErrors(prev => ({...prev, [name]: undefined }));
        if(error && error[name]) dispatch(clearAuthError());
    }
    // Очищаем общую ошибку несовпадения паролей
     if (name === 'password' || name === 'password2') {
         if(formErrors.non_field_errors || (error && (error.password || error.password2 || error.non_field_errors || error.detail))) {
             setFormErrors(prev => ({...prev, non_field_errors: undefined }));
             if(error) dispatch(clearAuthError());
         }
     }
  };

   // Локальная валидация формы перед отправкой
   const validateForm = () => {
        const errors = {};
        if (!formData.first_name.trim()) errors.first_name = [t('validation.required_first_name', 'Имя обязательно.')];
        if (!formData.last_name.trim()) errors.last_name = [t('validation.required_last_name', 'Фамилия обязательна.')];
        if (!formData.email.trim()) errors.email = [t('validation.required_email', 'Email обязателен.')];
        else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = [t('validation.invalid_email', 'Введите корректный email.')];
        if (!formData.password) errors.password = [t('validation.required_password', 'Пароль обязателен.')];
        else if (formData.password.length < 8) errors.password = [t('validation.password_min_length', 'Пароль должен быть не менее 8 символов.')];
        if (!formData.password2) errors.password2 = [t('validation.required_password2', 'Подтверждение пароля обязательно.')];
        else if (formData.password && formData.password !== formData.password2) errors.non_field_errors = [t('validation.passwords_mismatch', 'Пароли не совпадают.')];

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

  // Обработчик отправки формы
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoading) return;
    dispatch(clearAuthError());
    setFormErrors({});

    if (validateForm()) {
       // Отправляем только необходимые данные
       const userData = {
           email: formData.email,
           first_name: formData.first_name.trim(),
           last_name: formData.last_name.trim(),
           phone_number: formData.phone_number || null, // Отправляем null, если пусто
           password: formData.password,
           password2: formData.password2
        };
       dispatch(register(userData))
         .unwrap()
         .catch(err => { console.error("Registration rejected in component:", err) }); // Ошибка будет обработана через useSelector(state => state.auth.error)
    } else {
        console.log("Frontend validation failed:", formErrors);
    }
  };

  // Хелперы для отображения ошибок (объединяют локальные и API)
  const renderFieldError = (field) => {
        const localError = formErrors?.[field];
        const apiError = error?.[field]; // Ошибки API из Redux state
        // Собираем все сообщения
        const messages = [
            ...(localError ? (Array.isArray(localError) ? localError : [localError]) : []),
            ...(apiError ? (Array.isArray(apiError) ? apiError : [apiError]) : [])
        ];
        if (messages.length > 0) {
            // Отображаем только первое сообщение
            // Пытаемся перевести, если ключ существует, иначе показываем оригинал
            const firstMessage = messages[0];
            const translationKey = `errors.field.${field}.${firstMessage.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`; // Генерируем ключ для ошибки
            return <small className={styles.fieldError}>{t(translationKey, firstMessage)}</small>;
        }
        return null;
    }
  const renderNonFieldErrors = () => {
       const localError = formErrors?.non_field_errors; // Локальная ошибка несовпадения паролей
       const apiErrorDetail = error?.detail; // Общая ошибка API ('detail')
       const apiErrorNonField = error?.non_field_errors; // Ошибки API, не связанные с полями
       let messages = [];
       if(localError) messages = messages.concat(localError);
       if(apiErrorDetail) messages.push(apiErrorDetail);
       if(apiErrorNonField) messages = messages.concat(apiErrorNonField);

       if (messages.length > 0) {
           return messages.map((msg, index) => {
               // Пытаемся перевести
               const key = `errors.non_field.${msg.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
               return <p key={index} className={styles.errorMessage}>{t(key, msg)}</p>;
           });
       }
       // Показываем строковую ошибку, если она не обработана выше
       if (error && typeof error === 'string' && !apiErrorDetail && messages.length === 0) {
           return <p className={styles.errorMessage}>{t(`errors.${error}`, error)}</p>;
       }
       return null;
   }


  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{t('register.title', 'Создание аккаунта')}</h2>
      <p className={styles.subtitle}>{t('register.subtitle', 'Заполните форму для регистрации')}</p>
      {renderNonFieldErrors()} {/* Общие ошибки */}
      {/* Убрали отдельный рендер строковой ошибки, т.к. он теперь внутри renderNonFieldErrors */}
      {/* {error && typeof error === 'string' && <p className={styles.errorMessage}>{error}</p>} */}

      <form onSubmit={handleSubmit} noValidate> {/* Добавили noValidate */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="reg-first_name">{t('register.first_name_label', 'Имя')}*</label>
          <input type="text" id="reg-first_name" name="first_name" value={formData.first_name} onChange={handleChange} required placeholder={t('register.first_name_placeholder', 'Ваше имя')} className={clsx(styles.input, (formErrors?.first_name || error?.first_name) && styles.inputError)} aria-invalid={!!(formErrors?.first_name || error?.first_name)}/>
          {renderFieldError('first_name')}
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="reg-last_name">{t('register.last_name_label', 'Фамилия')}*</label>
          <input type="text" id="reg-last_name" name="last_name" value={formData.last_name} onChange={handleChange} required placeholder={t('register.last_name_placeholder', 'Ваша фамилия')} className={clsx(styles.input, (formErrors?.last_name || error?.last_name) && styles.inputError)} aria-invalid={!!(formErrors?.last_name || error?.last_name)}/>
           {renderFieldError('last_name')}
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="reg-email">{t('register.email_label', 'Email')}*</label>
          <input type="email" id="reg-email" name="email" value={formData.email} onChange={handleChange} required placeholder={t('register.email_placeholder', 'Ваш email')} className={clsx(styles.input, (formErrors?.email || error?.email) && styles.inputError)} aria-invalid={!!(formErrors?.email || error?.email)}/>
           {renderFieldError('email')}
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="reg-phone_number">{t('register.phone_label', 'Телефон')}</label>
          <input type="tel" id="reg-phone_number" name="phone_number" value={formData.phone_number} onChange={handleChange} placeholder={t('register.phone_placeholder', '+998 XX XXX-XX-XX')} className={clsx(styles.input, error?.phone_number && styles.inputError)} aria-invalid={!!error?.phone_number}/>
           {renderFieldError('phone_number')}
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="reg-password">{t('register.password_label', 'Пароль')}*</label>
          <input type="password" id="reg-password" name="password" value={formData.password} onChange={handleChange} required placeholder={t('register.password_placeholder', 'Создайте пароль')} className={clsx(styles.input, (formErrors?.password || error?.password) && styles.inputError)} autoComplete="new-password" aria-invalid={!!(formErrors?.password || error?.password)}/>
           <small className={styles.helperText}>{t('register.password_hint', 'Минимум 8 символов')}</small>
           {renderFieldError('password')}
        </div>
        <div className={styles.formGroup} style={{ marginBottom: '1.5rem' }}>
          <label className={styles.label} htmlFor="reg-password2">{t('register.password2_label', 'Подтвердите пароль')}*</label>
          <input type="password" id="reg-password2" name="password2" value={formData.password2} onChange={handleChange} required placeholder={t('register.password2_placeholder', 'Повторите новый пароль')} className={clsx(styles.input, (formErrors?.password2 || error?.password2 || formErrors?.non_field_errors) && styles.inputError)} autoComplete="new-password" aria-invalid={!!(formErrors?.password2 || error?.password2 || formErrors?.non_field_errors)}/>
           {renderFieldError('password2')}
        </div>
        <button type="submit" disabled={isLoading} className={styles.button}>
          {isLoading ? t('register.loading_button', 'Регистрация...') : t('register.submit_button', 'Зарегистрироваться')}
        </button>
      </form>
      <div className={styles.linksContainer}>
            {t('register.have_account_prompt', 'Уже есть аккаунт?')} {' '}
            <Link to={`/${currentLang}/login`} className={styles.link}>
                {t('register.login_link', 'Войдите здесь')}
            </Link>
        </div>
    </div>
  );
};

export default Register;
// --- END OF FULL FILE ---