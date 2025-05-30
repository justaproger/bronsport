// src/components/Dashboard/ProfileSettings.jsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useMutation, useQueryClient } from '@tanstack/react-query'; // Для обновления данных пользователя

// Импортируем API функции и actions/thunks
import { changePassword, fetchUserDetails } from '../../services/api'; // Добавили changePassword
import { loadUser } from '../../store/authSlice'; // Для обновления данных пользователя в сторе
import LoadingSpinner from '../Common/LoadingSpinner'; // Для индикатора
import apiClient from '../../services/api'; // Импортируем apiClient и changePassword

const ProfileSettings = () => {
    const dispatch = useDispatch();
    const queryClient = useQueryClient(); // Для инвалидации кэша user
    const { user, isLoading: isLoadingAuth } = useSelector((state) => state.auth); // Получаем текущего пользователя

    // --- Состояние для формы профиля ---
    const [profileData, setProfileData] = useState({
        first_name: '',
        last_name: '',
        phone_number: '',
        // Email не редактируем
    });
    const [profileErrors, setProfileErrors] = useState({});
    const [profileSuccess, setProfileSuccess] = useState('');

    // --- Состояние для формы смены пароля ---
    const [passwordData, setPasswordData] = useState({
        old_password: '',
        new_password1: '',
        new_password2: '',
    });
    const [passwordErrors, setPasswordErrors] = useState({});
    const [passwordSuccess, setPasswordSuccess] = useState('');

    // Заполняем форму профиля при загрузке данных пользователя
    useEffect(() => {
        if (user) {
            setProfileData({
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                phone_number: user.phone_number || '',
            });
        }
    }, [user]); // Зависимость от user

    // --- Обработка изменений инпутов ---
    const handleProfileChange = (e) => {
        setProfileData({ ...profileData, [e.target.name]: e.target.value });
         if (profileErrors[e.target.name]) { // Сбрасываем ошибку при изменении
             setProfileErrors(prev => ({...prev, [e.target.name]: undefined}));
         }
         setProfileSuccess(''); // Сбрасываем сообщение об успехе
    };

    const handlePasswordChange = (e) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
         if (passwordErrors[e.target.name] || passwordErrors.non_field_errors) { // Сбрасываем ошибки
             setPasswordErrors({});
         }
         setPasswordSuccess('');
    };

    // --- Мутация для обновления профиля ---
    // Используем useMutation для удобной обработки состояний загрузки/ошибки
    const updateProfileMutation = useMutation({
       mutationFn: (updatedData) => apiClient.patch('/auth/user/', updatedData), // Используем PATCH для частичного обновления
       onSuccess: (updatedUserData) => {
           console.log("Profile updated:", updatedUserData.data);
           setProfileSuccess("Профиль успешно обновлен!");
           setProfileErrors({});
           // Обновляем данные пользователя в сторе Redux ИЛИ инвалидируем кэш React Query
           // Вариант 1: Диспатчим loadUser (проще, но делает лишний запрос)
            dispatch(loadUser());
           // Вариант 2: Инвалидируем кэш React Query для ['user'] (если бы мы его использовали для user)
           // queryClient.invalidateQueries({ queryKey: ['userDetails'] }); // Пример
            // Вариант 3: Обновляем стор напрямую (требует доп. action в slice)
            // dispatch(updateUserSuccess(updatedUserData.data));
       },
       onError: (error) => {
           console.error("Profile update error:", error.response?.data);
           setProfileErrors(error.response?.data || { general: "Не удалось обновить профиль." });
           setProfileSuccess('');
       }
    });

    // --- Мутация для смены пароля ---
    const changePasswordMutation = useMutation({
        mutationFn: changePassword, // Используем импортированную функцию
        onSuccess: () => {
            console.log("Password changed successfully");
            setPasswordSuccess("Пароль успешно изменен!");
            setPasswordErrors({});
            // Очищаем поля формы пароля после успеха
            setPasswordData({ old_password: '', new_password1: '', new_password2: '' });
             // Можно разлогинить пользователя для безопасности
             // dispatch(logout());
             // navigate('/login');
        },
        onError: (error) => {
             console.error("Change password error:", error.response?.data);
             // Отображаем ошибки валидации или общую ошибку
             setPasswordErrors(error.response?.data || { non_field_errors: ["Не удалось изменить пароль."] });
             setPasswordSuccess('');
        }
    });

    // --- Обработчики отправки форм ---
    const handleProfileSubmit = (e) => {
        e.preventDefault();
        setProfileSuccess(''); // Сброс сообщения
        setProfileErrors({});
        // Формируем только измененные данные (или все, если API поддерживает)
        const dataToUpdate = {};
        if(profileData.first_name !== user?.first_name) dataToUpdate.first_name = profileData.first_name;
        if(profileData.last_name !== user?.last_name) dataToUpdate.last_name = profileData.last_name;
        if(profileData.phone_number !== user?.phone_number) dataToUpdate.phone_number = profileData.phone_number;

        if (Object.keys(dataToUpdate).length > 0) {
             console.log("Submitting profile data:", dataToUpdate);
             updateProfileMutation.mutate(dataToUpdate);
        } else {
             setProfileSuccess("Нет изменений для сохранения.");
        }
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        setPasswordSuccess(''); // Сброс сообщения
        setPasswordErrors({});
        // Простая валидация на фронте
        if (passwordData.new_password1 !== passwordData.new_password2) {
            setPasswordErrors({ new_password2: ["Новые пароли не совпадают."] });
            return;
        }
        if (passwordData.new_password1.length < 8) {
             setPasswordErrors({ new_password1: ["Пароль должен быть не менее 8 символов."] });
             return;
         }
        changePasswordMutation.mutate(passwordData);
    };


    // --- Стили ---
    const containerStyle = { padding: '1.5rem' }; // Убрали лишнюю обертку
    const sectionStyle = { marginBottom: '2rem' };
    const sectionTitleStyle = { fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e8eaed' };
    const formRowStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' };
    const formGroupStyle = { display: 'flex', flexDirection: 'column', gap: '0.5rem' };
    const labelStyle = { fontWeight: 500, fontSize: '0.875rem' };
    const inputStyle = { padding: '0.75rem', border: '1px solid #e8eaed', borderRadius: '8px', fontSize: '1rem' };
    const readOnlyInputStyle = { ...inputStyle, backgroundColor: '#f8f9fa', color: '#5f6368', cursor: 'not-allowed' };
    const actionsStyle = { display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' };
    const buttonStyle = { padding: '0.625rem 1.25rem', borderRadius: '8px', border: 'none', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' };
    const primaryButtonStyle = { ...buttonStyle, backgroundColor: '#1a73e8', color: 'white' };
    const outlineButtonStyle = { ...buttonStyle, backgroundColor: 'transparent', color: '#5f6368', border: '1px solid #e8eaed' };
    const errorTextStyle = { color: '#dc3545', fontSize: '0.8rem', marginTop: '0.25rem' };
    const successTextStyle = { color: '#28a745', fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: 500 };

     // Helper для отображения ошибок валидации
     const renderErrors = (errorsObject, field) => {
         if (errorsObject && typeof errorsObject === 'object' && errorsObject[field]) {
             const messages = Array.isArray(errorsObject[field]) ? errorsObject[field] : [errorsObject[field]];
             return messages.map((msg, index) => <small key={index} style={errorTextStyle}>{msg}</small>);
         }
         return null;
     };
     const renderNonFieldErrors = (errorsObject) => {
         const nonField = errorsObject?.non_field_errors || errorsObject?.detail || (typeof errorsObject === 'string' ? errorsObject : null);
         if (nonField) {
             const messages = Array.isArray(nonField) ? nonField : [nonField];
              return messages.map((msg, index) => <p key={index} style={{...errorTextStyle, marginBottom: '1rem'}}>{msg}</p>);
         }
         return null;
     }


    // Если данные пользователя еще грузятся
    if (isLoadingAuth && !user) {
        return <div style={containerStyle}><LoadingSpinner text="Загрузка профиля..." /></div>;
    }
    // Если пользователя нет (ошибка загрузки или не авторизован)
    if (!user) {
         return <div style={containerStyle}><p>Не удалось загрузить профиль.</p></div>;
    }

    return (
        <div style={containerStyle}>
             {/* Секция Персональной Информации */}
            <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>Персональная информация</h3>
                 {/* Сообщение об успехе для профиля */}
                {profileSuccess && <p style={successTextStyle}><i className="fas fa-check-circle"></i> {profileSuccess}</p>}
                {/* Общие ошибки для профиля */}
                {renderNonFieldErrors(profileErrors)}
                <form onSubmit={handleProfileSubmit}>
                    <div style={formRowStyle}>
                        <div style={formGroupStyle}>
                            <label htmlFor="profile-first_name" style={labelStyle}>Имя*</label>
                            <input type="text" id="profile-first_name" name="first_name" value={profileData.first_name} onChange={handleProfileChange} required style={inputStyle} />
                            {renderErrors(profileErrors, 'first_name')}
                        </div>
                        <div style={formGroupStyle}>
                            <label htmlFor="profile-last_name" style={labelStyle}>Фамилия*</label>
                            <input type="text" id="profile-last_name" name="last_name" value={profileData.last_name} onChange={handleProfileChange} required style={inputStyle} />
                             {renderErrors(profileErrors, 'last_name')}
                        </div>
                    </div>
                    <div style={formRowStyle}>
                        <div style={formGroupStyle}>
                            <label htmlFor="profile-email" style={labelStyle}>Email</label>
                            <input type="email" id="profile-email" name="email" value={user.email} readOnly style={readOnlyInputStyle} />
                            <small style={{fontSize: '0.75rem', color: '#5f6368'}}>Email изменить нельзя.</small>
                        </div>
                        <div style={formGroupStyle}>
                            <label htmlFor="profile-phone_number" style={labelStyle}>Телефон</label>
                            <input type="tel" id="profile-phone_number" name="phone_number" value={profileData.phone_number} onChange={handleProfileChange} placeholder="+998 XX XXX-XX-XX" style={inputStyle} />
                             {renderErrors(profileErrors, 'phone_number')}
                        </div>
                    </div>
                    {/* Можно добавить Дату рождения, Пол */}
                     <div style={actionsStyle}>
                        {/* <button type="button" style={outlineButtonStyle}>Отмена</button> */}
                        <button type="submit" style={primaryButtonStyle} disabled={updateProfileMutation.isLoading}>
                            {updateProfileMutation.isLoading ? <><LoadingSpinner size="1em" color="#fff" text=""/><span style={{marginLeft:'5px'}}>Сохранение...</span></> : 'Сохранить профиль'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Секция Смены Пароля */}
            <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>Изменить пароль</h3>
                {/* Сообщение об успехе для пароля */}
                {passwordSuccess && <p style={successTextStyle}><i className="fas fa-check-circle"></i> {passwordSuccess}</p>}
                 {/* Общие ошибки для пароля */}
                 {renderNonFieldErrors(passwordErrors)}
                <form onSubmit={handlePasswordSubmit}>
                    <div style={formGroupStyle}>
                        <label htmlFor="profile-old_password" style={labelStyle}>Текущий пароль*</label>
                        <input type="password" id="profile-old_password" name="old_password" value={passwordData.old_password} onChange={handlePasswordChange} required style={inputStyle} />
                         {renderErrors(passwordErrors, 'old_password')}
                    </div>
                    <div style={formRowStyle}>
                        <div style={formGroupStyle}>
                            <label htmlFor="profile-new_password1" style={labelStyle}>Новый пароль*</label>
                            <input type="password" id="profile-new_password1" name="new_password1" value={passwordData.new_password1} onChange={handlePasswordChange} required style={inputStyle} />
                            <small style={{fontSize: '0.75rem', color: '#5f6368'}}>Минимум 8 символов</small>
                            {renderErrors(passwordErrors, 'new_password1')}
                        </div>
                        <div style={formGroupStyle}>
                            <label htmlFor="profile-new_password2" style={labelStyle}>Подтвердите новый пароль*</label>
                            <input type="password" id="profile-new_password2" name="new_password2" value={passwordData.new_password2} onChange={handlePasswordChange} required style={inputStyle} />
                             {renderErrors(passwordErrors, 'new_password2')}
                        </div>
                    </div>
                     <div style={actionsStyle}>
                         <button type="submit" style={primaryButtonStyle} disabled={changePasswordMutation.isLoading}>
                            {changePasswordMutation.isLoading ? <><LoadingSpinner size="1em" color="#fff" text=""/><span style={{marginLeft:'5px'}}>Изменение...</span></> : 'Изменить пароль'}
                        </button>
                    </div>
                </form>
            </div>

        </div>
    );
};

export default ProfileSettings;