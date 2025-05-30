// --- START OF FULL MODIFIED frontend/src/services/api.js ---
import axios from 'axios';
import { store } from '../store/store'; // Для logout при ошибке токена
import { logout } from '../store/authSlice'; // Action для logout
import i18n from '../i18n'; // Для получения текущего языка

const API_DOMAIN_URL = import.meta.env.VITE_API_BASE_URL || 'http://172.16.0.100:8000'; // Используйте 127.0.0.1 или ваш IP
const API_PREFIX = '/api';

const apiClient = axios.create({
  baseURL: API_DOMAIN_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для добавления токена и языка в заголовки
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    const currentLanguage = i18n.language; // Получаем актуальный язык из i18n
    if (currentLanguage) {
        config.headers['Accept-Language'] = currentLanguage;
    }

    // Логика формирования URL с языковым префиксом (остается прежней)
    if (config.url && !config.url.startsWith('http')) {
        const apiOnlyUrls = [
            '/auth/token/', '/auth/token/refresh/', '/auth/token/verify/',
            '/auth/password_reset/', '/auth/password_reset/confirm/', '/auth/password_reset/validate_token/',
            '/auth/google/', // Google Auth
            // URL для вебхуков Paycom (если бы они вызывались отсюда, но они входящие на бэк)
            // Например, если бы мы делали запрос к самому Paycom, а не к нашему бэку
        ];
        // URL для вебхуков Paycom, которые мы определили БЕЗ /api/ и БЕЗ языкового префикса
        const noApiNoLangUrls = [
            '/paycom-callbacks/webhook/' // Начало пути для вебхуков Paycom
        ];

        let originalRelativeUrl = config.url;
        if (!originalRelativeUrl.startsWith('/')) {
            originalRelativeUrl = '/' + originalRelativeUrl;
        }
        
        const isApiOnly = apiOnlyUrls.some(apiPath => originalRelativeUrl.startsWith(apiPath));
        const isNoApiNoLang = noApiNoLangUrls.some(rawPath => originalRelativeUrl.startsWith(rawPath));
        
        let finalUrl = '';
        if (isNoApiNoLang) { // Для вебхуков Paycom - без /api/ и без языка
            finalUrl = originalRelativeUrl;
        } else if (isApiOnly) {
            finalUrl = `${API_PREFIX}${originalRelativeUrl}`;
        } else {
            const langPrefix = currentLanguage ? `/${currentLanguage.split('-')[0]}` : `/${(i18n.options.fallbackLng?.[0] || i18n.options.fallbackLng || 'uz').split('-')[0]}`;
            finalUrl = `${langPrefix}${API_PREFIX}${originalRelativeUrl}`;
        }

        if (config.url !== finalUrl) {
            // console.log(`[API Interceptor] Rewriting URL from ${config.url} to ${finalUrl}`);
            config.url = finalUrl;
        }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерцептор для обновления токена (остается прежним)
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) { prom.reject(error); }
    else { prom.resolve(token); }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refreshTokenUrlSegment = '/auth/token/refresh/'; 
    const isRefreshRequest = originalRequest.url?.includes(refreshTokenUrlSegment);

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(newToken => {
          originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
          return apiClient(originalRequest);
        }).catch(err => Promise.reject(err));
      }
      originalRequest._retry = true;
      isRefreshing = true;
      const refreshTokenValue = localStorage.getItem('refreshToken');
      if (!refreshTokenValue) {
        isRefreshing = false;
        store.dispatch(logout());
        processQueue(new Error("No refresh token available."), null);
        return Promise.reject(error);
      }
      try {
        const fullRefreshUrl = `${API_DOMAIN_URL}${API_PREFIX}${refreshTokenUrlSegment}`;
        const refreshResponse = await axios.post(fullRefreshUrl, { refresh: refreshTokenValue });
        const newAccessToken = refreshResponse.data.access;
        localStorage.setItem('accessToken', newAccessToken);
        apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;
        originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;
        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        store.dispatch(logout());
        processQueue(refreshError, null);
        return Promise.reject(refreshError.response?.data || refreshError || error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth (без изменений) ---
export const loginUser = (credentials) => apiClient.post('/auth/token/', credentials);
export const refreshToken = (refreshData) => apiClient.post('/auth/token/refresh/', refreshData);
export const verifyToken = (tokenData) => apiClient.post('/auth/token/verify/', tokenData);
export const requestPasswordReset = (emailData) => apiClient.post('/auth/password_reset/', emailData);
export const confirmPasswordReset = (resetData) => apiClient.post('/auth/password_reset/confirm/', resetData);
export const validateResetToken = (tokenData) => apiClient.post('/auth/password_reset/validate_token/', tokenData);
export const registerUser = (userData) => apiClient.post('/auth/register/', userData);
export const fetchUserDetails = () => apiClient.get('/auth/user/');
export const changePassword = (passwordData) => apiClient.put('/auth/password/change/', passwordData);
export const updateUserProfile = (profileData) => apiClient.patch('/auth/user/', profileData);

// --- Facilities (без изменений) ---
export const fetchFacilities = async ({ queryKey }) => { const [, params] = queryKey; const response = await apiClient.get('/catalog/facilities/', { params }); return response.data; };
export const fetchFacilityDetail = async ({ queryKey }) => { const [, facilityId] = queryKey; if (!facilityId) throw new Error("Facility ID required"); const response = await apiClient.get(`/catalog/facilities/${facilityId}/`); return response.data; };
export const fetchAmenities = async () => { const response = await apiClient.get('/catalog/amenities/'); return response.data; };
export const fetchFacilityAvailability = async ({ queryKey }) => { const [, facilityId, dateStr] = queryKey; if (!facilityId || !dateStr) return { facility_booking_type: null, slots: [], message: "Missing facility ID or date." }; try { const response = await apiClient.get(`/catalog/facilities/${facilityId}/availability/`, { params: { date: dateStr } }); return response.data; } catch (error) { console.error("Error fetching facility availability:", error.response?.data || error.message); throw error; }};
export const fetchComprehensiveSubscriptionAvailability = async ({ queryKey }) => { const [, facilityId] = queryKey; if (!facilityId) { return { facility_booking_type: null, availability_matrix: {}, message: "Facility ID is required." }; } try { const response = await apiClient.get(`/catalog/facilities/${facilityId}/comprehensive-subscription-availability/`); return response.data; } catch (error) { console.error("Error fetching comprehensive subscription availability:", error.response?.data || error.message); throw error; }};

// --- Universities (без изменений) ---
export const fetchUniversities = async ({ queryKey }) => { const [, params] = queryKey; const response = await apiClient.get('/universities/', { params }); return response.data; };
export const fetchUniversityDetail = async ({ queryKey }) => { const [, universityId] = queryKey; if (!universityId) throw new Error("University ID required"); const response = await apiClient.get(`/universities/${universityId}/`); return response.data; };
export const fetchUniversityStaff = async ({ queryKey }) => { const [, uniId, params] = queryKey; if (!uniId) return { results: [], count: 0 }; const response = await apiClient.get(`/universities/${uniId}/staff/`, { params }); return response.data; };
export const fetchUniversityClubs = async ({ queryKey }) => { const [, uniId, params] = queryKey; if (!uniId) return { results: [], count: 0 }; const response = await apiClient.get(`/universities/${uniId}/clubs/`, { params }); return response.data; };

// --- Bookings / Orders (адаптировано для Paycom) ---
export const fetchMyUnifiedOrders = async ({ queryKey }) => {
    const [, params] = queryKey;
    try {
        const response = await apiClient.get('/bookings/my-orders/', { params });
        return response.data; 
    } catch (error) {
        console.error("Error fetching unified orders:", error.response?.data || error.message);
        throw error;
    }
};

export const fetchMySubscriptions = async ({ queryKey }) => {
    const [, originalParams] = queryKey;
    const paramsWithOrderType = { ...originalParams, order_type: 'subscription' };
    return fetchMyUnifiedOrders({ queryKey: ['myUnifiedOrders', paramsWithOrderType] }); 
};

// НОВЫЕ ФУНКЦИИ для Paycom
export const preparePaycomPayment = (orderData) => {
    // orderData: { item_type, facility_id, date, slots, start_date, months, days_of_week, start_times }
    return apiClient.post('/bookings/prepare-paycom-payment/', orderData);
};

export const getPaycomCheckoutUrl = ({ queryKey }) => {
    const [, orderIdentifier] = queryKey; // orderIdentifier может быть ID или order_code
    if (!orderIdentifier) throw new Error("Order identifier required to get Paycom checkout URL");
    return apiClient.post(`/bookings/orders/${orderIdentifier}/get-paycom-checkout-url/`);
};

export const fetchOrderPaymentStatus = async ({ queryKey }) => {
    const [, orderIdentifier] = queryKey;
    if (!orderIdentifier) throw new Error("Order identifier required to fetch payment status");
    try {
        const response = await apiClient.get(`/bookings/orders/${orderIdentifier}/payment-status/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching payment status for order ${orderIdentifier}:`, error.response?.data || error.message);
        throw error; // Перебрасываем для обработки в useQuery
    }
};

// УДАЛЕННЫЕ/ЗАКОММЕНТИРОВАННЫЕ ФУНКЦИИ STRIPE
// export const createCheckoutSession = (orderData) => apiClient.post('/bookings/create-checkout-session/', orderData);
// export const fetchBookingDetailsBySession = async ({ queryKey }) => { const [, sessionId] = queryKey; if (!sessionId) throw new Error("Session ID required"); const response = await apiClient.get(`/bookings/details-by-session/${sessionId}/`); return response.data; };

// --- Dashboard (без изменений) ---
export const fetchUserDashboardStats = async () => {
    try {
        const response = await apiClient.get('/dashboard/user-stats/');
        return response.data; 
    } catch (error) {
        console.error("Error fetching user dashboard stats:", error.response?.data || error.message);
        throw error;
    }
};

// --- Checkin / QR Scanner API ---
export const fetchOrderDetailsByQRCode = async ({ queryKey }) => {
    const [, orderCode] = queryKey;
    if (!orderCode) throw new Error("Order code is required for QR details");
    // Предполагаем, что URL для этого API не имеет языкового префикса,
    // так как он может вызываться с отдельного субдомена qr.bronsport.uz
    // Если он все же с языковым префиксом, apiClient сам его добавит.
    // Если он БЕЗ /api/ префикса, то нужно будет формировать URL иначе.
    // Пока что оставляем стандартный вызов через apiClient.
    const response = await apiClient.get(`/checkin/order-details/${orderCode}/`);
    return response.data;
};

export const completeOrderFromQR = async (orderCode) => {
    if (!orderCode) throw new Error("Order code is required to complete order");
    const response = await apiClient.post(`/checkin/complete-order/${orderCode}/`);
    return response.data; // Ожидаем, что вернется обновленный заказ
};

export default apiClient;