// --- START OF FULL MODIFIED frontend/src/components/Auth/ProtectedRoute.jsx ---
import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // Для toast сообщений
import { toast } from 'react-hot-toast'; // Для toast сообщений
import LoadingSpinner from '../Common/LoadingSpinner';

const ProtectedRoute = ({ children, requiredRole = null }) => {
    const { isAuthenticated, user, isLoading: isLoadingAuth } = useSelector((state) => state.auth);
    const location = useLocation();
    const { lang } = useParams(); // Получаем текущий язык из URL
    const { t } = useTranslation();

    // Определяем язык для редиректа
    const currentLangForRedirect = lang || i18n.language || i18n.options.fallbackLng?.[0] || 'uz';
    const langPath = (path) => `/${currentLangForRedirect}${path.startsWith('/') ? '' : '/'}${path}`;

    // 1. Показываем лоадер, пока идет проверка аутентификации/загрузка пользователя
    if (isLoadingAuth || (isAuthenticated && !user && requiredRole)) { 
        // Если аутентифицирован, но user еще не загружен, а роль нужна - ждем user
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 140px)', padding: '2rem' }}>
                <LoadingSpinner text={t('common.checking_access', 'Проверка доступа...')} />
            </div>
        );
    }

    // 2. Если пользователь не аутентифицирован
    if (!isAuthenticated) {
        // console.log(`[ProtectedRoute] User not authenticated. Redirecting to login from: ${location.pathname}`);
        toast.error(t('errors.auth_required_page_access', 'Для доступа к этой странице необходимо войти.'));
        return <Navigate to={langPath('/login')} state={{ from: location }} replace />;
    }

    // 3. Если требуется определенная роль (например, "staff")
    if (requiredRole) {
        if (requiredRole === "staff" && !user?.is_staff) {
            // console.log(`[ProtectedRoute] User ${user?.email} is not staff. Redirecting from: ${location.pathname}`);
            toast.error(t('errors.auth_staff_required_page_access', 'Доступ к этой странице разрешен только персоналу.'));
            return <Navigate to={langPath('/dashboard')} replace />; // Редирект на дашборд или главную
        }
        // Можно добавить другие проверки ролей (например, "superuser")
        // if (requiredRole === "superuser" && !user?.is_superuser) { ... }
    }

    // 4. Если все проверки пройдены
    return children;
};

// Импортируем i18n для доступа к инстансу вне хука useTranslation, если нужно
import i18n from '../../i18n'; 

export default ProtectedRoute;
// --- END OF FULL MODIFIED frontend/src/components/Auth/ProtectedRoute.jsx ---