// src/components/Admin/AdminSidebar.jsx
import React from 'react';
// Добавляем Link и NavLink
import { Navigate} from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/authSlice'; // Путь к authSlice
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../Common/LoadingSpinner'; // Импортируем спиннер загрузки
const RootRedirect = () => {
    // Получаем статус аутентификации, данные пользователя и статус загрузки
    const { isAuthenticated, user, isLoading } = useSelector((state) => state.auth);

    // Логирование для отладки
    console.log("RootRedirect State:", { isAuthenticated, isLoading, user });

    // Показываем спиннер, пока идет первоначальная проверка/загрузка пользователя
    // Добавлена проверка на наличие токена, чтобы не показывать спиннер после logout
    if (isLoading && !user && localStorage.getItem('accessToken')) {
        return <div style={{ padding: '5rem', textAlign: 'center' }}><LoadingSpinner text="Проверка входа..." /></div>;
    }

    // Если пользователь не аутентифицирован (проверка завершена)
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Если пользователь аутентифицирован, но данные еще не загрузились
    // (Может случиться, если loadUser еще выполняется)
    if (!user) {
         console.warn("RootRedirect: Authenticated but user data is still null/undefined. Waiting...");
         // Показываем заглушку, пока данные пользователя не появятся
         return <div style={{ padding: '5rem', textAlign: 'center' }}><LoadingSpinner text="Загрузка данных профиля..." /></div>;
    }

    // --- Проверка Роли ---
    // Проверяем, является ли пользователь Супер-Администратором
    const isSuperAdmin = user?.is_superuser === true; // Явная проверка на true

    // Проверяем, является ли пользователь Администратором Университета
    // Используем поле 'administered_university_id', которое добавили в сериализатор
    // Проверяем, что is_staff=true И administered_university_id не null и не undefined
    const isUniversityAdmin = user?.is_staff === true && user?.administered_university_id != null;

    // Логирование проверки ролей
    console.log("RootRedirect Role Check:", { isSuperAdmin, isUniversityAdmin });

    // Определяем целевой путь
    let targetPath = '/dashboard'; // Путь для обычного пользователя по умолчанию

    if (isSuperAdmin) {
        // TODO: Определить путь для супер-админа
        targetPath = '/super-admin'; // Пример
        console.log("Redirecting Super Admin to:", targetPath);
    } else if (isUniversityAdmin) {
        targetPath = '/uni-admin'; // Путь для админа университета
        console.log("Redirecting University Admin to:", targetPath);
    } else {
        console.log("Redirecting Regular User to:", targetPath);
    }

    // Выполняем редирект
    return <Navigate to={targetPath} replace />;
};

export default RootRedirect;