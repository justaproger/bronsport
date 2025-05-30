// --- START OF FULL MODIFIED frontend/src/main.jsx ---
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useTranslation } from 'react-i18next';

import './i18n'; 
import { setGlobalQueryClient } from './i18n'; 

import { store } from './store/store';
import App from './App';
import './index.css';
import LoadingSpinner from './components/Common/LoadingSpinner';

import LanguageHandler from './components/I18n/LanguageHandler.jsx';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import DashboardLayout from './components/Dashboard/DashboardLayout.jsx';
import DashboardHome from './components/Dashboard/DashboardHome.jsx';
import MyActiveOrders from './components/Dashboard/MyActiveOrders.jsx';
import OrderHistory from './components/Dashboard/OrderHistory.jsx';
import ProfileSettings from './components/Dashboard/ProfileSettings.jsx';
import Subscriptions from './components/Dashboard/Subscriptions.jsx';
import HomePage from './pages/HomePage.jsx';
import FacilitiesPage from './pages/FacilitiesPage.jsx';
import FacilityDetailPage from './pages/FacilityDetailPage.jsx';
import UniversityDetailPage from './pages/UniversityDetailPage.jsx';
import UniversitiesPage from './pages/UniversitiesPage.jsx';
import SubscriptionSetupPage from './pages/SubscriptionSetupPage.jsx';
// import BookingConfirmation from './pages/BookingConfirmation.jsx'; // Больше не нужен для Paycom
import PaymentCancelledPage from './pages/PaymentCancelledPage.jsx'; // Может понадобиться, если Payme имеет отдельный cancel_url
import PaymentStatusPage from './pages/PaymentStatusPage.jsx'; // НОВАЯ СТРАНИЦА
import NotFound from './components/Common/NotFound.jsx';
import InfoPageLayout from './pages/Info/InfoPageLayout.jsx';
import AboutContent from './pages/Info/AboutContent.jsx';
import TermsContent from './pages/Info/TermsContent.jsx';
import PrivacyContent from './pages/Info/PrivacyContent.jsx';
import ContactContent from './pages/Info/ContactContent.jsx';
import FAQContent from './pages/Info/FAQContent.jsx';
import QRScannerPage from './pages/QRScannerPage.jsx'; // <-- НОВЫЙ ИМПОРТ


const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: 1, }, },
});
setGlobalQueryClient(queryClient);

const LoadingI18n = () => ( <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif', color: '#5f6368' }}> <LoadingSpinner size="40px" text="" /> <p style={{ marginTop: '1rem', fontSize: '1rem' }}>Loading language resources...</p> </div> );
const RootRedirector = () => { const { i18n } = useTranslation(); const defaultLang = i18n.options.fallbackLng?.[0] || i18n.options.fallbackLng || 'uz'; return <Navigate to={`/${defaultLang}/`} replace />; };

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, // App содержит Header, Footer и <Outlet />
    children: [
        { index: true, element: <RootRedirector /> }, // Редирект с / на /:lang/
        {
            path: ":lang", // Языковой префикс
            element: <LanguageHandler />, // Обработчик языка, содержит <Outlet />
            children: [
                { index: true, element: <HomePage /> },
                { path: "login", element: <Login /> },
                { path: "register", element: <Register /> },
                { path: "forgot-password", element: <ForgotPassword /> },
                { path: "reset-password/:token", element: <ResetPassword /> },
                
                { path: "facilities", element: <FacilitiesPage /> },
                { path: "facilities/:facilityId", element: <FacilityDetailPage /> },
                { path: "facilities/:facilityId/subscribe", element: <ProtectedRoute><SubscriptionSetupPage /></ProtectedRoute> },
                
                { path: "universities", element: <UniversitiesPage /> },
                { path: "universities/:universityId", element: <UniversityDetailPage /> },
                
                // Новый роут для страницы статуса платежа
                { path: "payment-status/:order_identifier", element: <ProtectedRoute><PaymentStatusPage /></ProtectedRoute> },
                
                // Старая страница подтверждения (можно удалить или оставить для других целей)
                // { path: "booking-success", element: <ProtectedRoute><BookingConfirmation /></ProtectedRoute> }, 
                { path: "payment-cancelled", element: <PaymentCancelledPage /> }, // Если Payme будет редиректить на отдельный cancel_url
                
                {
                    path: "dashboard",
                    element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
                    children: [
                        { index: true, element: <DashboardHome /> },
                        { path: "active-orders", element: <MyActiveOrders /> },
                        { path: "order-history", element: <OrderHistory /> },
                        { path: "profile", element: <ProfileSettings /> },
                        { path: "subscriptions", element: <Subscriptions /> },
                        { path: "bookings", element: <Navigate to="active-orders" replace /> }, // Алиас
                        { path: "history", element: <Navigate to="order-history" replace /> },   // Алиас
                        { path: "*", element: <Navigate to="" replace /> } // Редирект на дашборд по умолчанию
                    ]
                },
                {
                    path: "info",
                    element: <InfoPageLayout />,
                    children: [
                        { index: true, element: <Navigate to="about" replace /> },
                        { path: "about", element: <AboutContent /> },
                        { path: "terms", element: <TermsContent /> },
                        { path: "privacy", element: <PrivacyContent /> },
                        { path: "contact", element: <ContactContent /> },
                        { path: "faq", element: <FAQContent /> },
                        { path: "*", element: <Navigate to="about" replace /> }
                    ]
                },
                { path: "*", element: <NotFound /> }, // 404 для текущего языка
                { 
                  path: "qr-scanner", 
                  element: (
                      <ProtectedRoute requiredRole="staff"> {/* Используем ProtectedRoute */}
                          <QRScannerPage />
                      </ProtectedRoute>
                  )
              },
            ]
        },
        { path: "*", element: <NotFound /> }, // Глобальный 404, если нет языкового префикса
        
    ]
  }
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={<LoadingI18n />}>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </Provider>
    </React.Suspense>
  </React.StrictMode>
);   
// --- END OF FULL MODIFIED frontend/src/main.jsx ---