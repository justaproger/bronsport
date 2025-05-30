// --- START OF FULL FILE frontend/src/App.jsx ---
import React, { useEffect } from 'react';
// --- ИЗМЕНЕНИЕ: Убираем Routes, Route, Navigate, используем Outlet ---
import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom';
// -----------------------------------------------------------------
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

// Компоненты и Страницы (остаются импорты, если они нужны в дочерних роутах,
// но здесь они больше не используются для определения Route)
// import Login from './components/Auth/Login'; // Убрано, т.к. роуты теперь в main.jsx
// ... и так далее для всех импортов компонентов страниц ...

// I18n
import LanguageHandler from './components/I18n/LanguageHandler.jsx'; // Этот компонент теперь будет частью структуры роутов

// Общие Компоненты
import LoadingSpinner from './components/Common/LoadingSpinner';
import Header from './components/Layout/Header.jsx';
import Footer from './components/Layout/Footer.jsx';
import TestModeBanner from './components/Common/TestModeBanner.jsx'; // <--- НОВЫЙ ИМПОРТ

// Redux Actions
import { loadUser } from './store/authSlice';

// --- Компонент RootRedirector и LanguageHandler переносятся в конфигурацию роутера ---

function App() {
  const dispatch = useDispatch();
  const { isLoading: isLoadingAuth, user } = useSelector((state) => state.auth);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  // Эффект для загрузки пользователя (остается здесь, т.к. App рендерится всегда)
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token && !user) {
      dispatch(loadUser());
    }
  }, [dispatch, user]);

  // Логика глобального спиннера при проверке токена (остается здесь)
  const isInitialAuthCheckLoading = isLoadingAuth && !user && localStorage.getItem('accessToken');
  if (isInitialAuthCheckLoading) {
     return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
             <header style={{height: '70px', background: '#fff', borderBottom: '1px solid #eee'}}></header>
             <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                 <LoadingSpinner text={i18n.isInitialized ? t('common.loading', 'Загрузка...') : 'Loading...'} />
             </main>
             <footer style={{height: '70px', background: '#202124'}}></footer>
        </div>
     );
  }

  // --- Основной Рендеринг Макета Приложения ---
  // Теперь App рендерит только общий макет и Outlet, куда будут вставляться дочерние роуты
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Компонент для восстановления скролла */}
      <ScrollRestoration />

      <Header currentLang={currentLang} />
      <TestModeBanner /> {/* <--- ДОБАВЛЕН БАННЕР */}

      {/* Основной контент - теперь это Outlet */}
      <main className="main-content-wrapper" style={{ flex: 1 }}>
        <Outlet /> {/* Сюда будут рендериться дочерние роуты */}
      </main>

      <Footer currentLang={currentLang} />
    </div>
  );
}

export default App;
// --- END OF FULL FILE ---