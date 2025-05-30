// src/store/store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice'; // Убедитесь, что путь верный

export const store = configureStore({
  reducer: {
    // Ключ 'auth' будет соответствовать состоянию state.auth в useSelector
    auth: authReducer,
    // Сюда позже можно будет добавить другие срезы состояния:
    // facilities: facilitiesReducer,
    // bookings: bookingsReducer,
    // universities: universitiesReducer,
  },
  // Добавляем middleware для разработки (например, logger), опционально
  // middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(logger),
  devTools: process.env.NODE_ENV !== 'production', // Включаем Redux DevTools только в разработке
});