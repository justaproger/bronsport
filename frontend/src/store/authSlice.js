// src/store/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
// Убедитесь, что путь к вашему api сервису правильный
import { loginUser, registerUser, fetchUserDetails } from '../services/api';

// --- Асинхронные Thunks ---

// Вход пользователя
export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue, dispatch }) => { // Добавляем dispatch
    try {
      const response = await loginUser(credentials); // credentials = { email, password }
      // Сохраняем токены в localStorage
      localStorage.setItem('accessToken', response.data.access);
      localStorage.setItem('refreshToken', response.data.refresh);
      // После успешного логина и сохранения токенов, загружаем детали пользователя
      // Это гарантирует, что user state будет актуальным сразу после логина
      const userDetailsResponse = await fetchUserDetails(); // Использует токен из localStorage
      return { user: userDetailsResponse.data, tokens: response.data };
    } catch (error) {
      // Обрабатываем ошибки API
      console.error("Login Thunk Error:", error.response?.data || error.message);
      // Очищаем токены при ошибке логина
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return rejectWithValue(error.response?.data || 'Неверный email или пароль.'); // Возвращаем ошибку для Redux state
    }
  }
);

// Регистрация пользователя
export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => { // userData = { email, password, password2, first_name, ... }
    try {
      const response = await registerUser(userData);
      // При успешной регистрации просто возвращаем данные созданного пользователя
      // Не логиним автоматически, чтобы пользователь подтвердил email, если это будет добавлено
      return response.data;
    } catch (error) {
      console.error("Register Thunk Error:", error.response?.data || error.message);
      // Возвращаем ошибки валидации или общую ошибку
      return rejectWithValue(error.response?.data || 'Ошибка регистрации.');
    }
  }
);

// Загрузка данных пользователя при наличии токена
 export const loadUser = createAsyncThunk(
    'auth/loadUser',
    async (_, { rejectWithValue, dispatch }) => { // Используем _ т.к. аргументы не нужны
      const token = localStorage.getItem('accessToken');
      if (!token) {
        // Нет токена - не пытаемся загрузить, это не ошибка, просто пользователь не вошел
        return rejectWithValue('No token found');
      }
      try {
        // Запрашиваем данные пользователя с текущим токеном
        const response = await fetchUserDetails();
        return response.data; // Возвращаем данные пользователя
      } catch (error) {
        console.error("Load User Thunk Error:", error.response?.data || error.message);
        // Если токен невалиден (например, истек), сервер вернет ошибку (обычно 401)
        // В этом случае разлогиниваем пользователя
        dispatch(logout()); // Используем dispatch для вызова другого action/reducer
        // Возвращаем ошибку, чтобы обработать в extraReducers
        return rejectWithValue(error.response?.data || 'Не удалось загрузить пользователя. Токен недействителен.');
      }
    }
  );

// --- Начальное состояние ---
const initialState = {
  user: null, // Информация о пользователе { id, email, first_name, ... }
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  isAuthenticated: !!localStorage.getItem('accessToken'), // Начальная проверка по наличию токена
  isLoading: false, // Индикатор загрузки для login/register/loadUser
  error: null, // Хранение сообщений об ошибках
  registrationSuccess: false, // Флаг успешной регистрации
};

// --- Срез (Slice) ---
const authSlice = createSlice({
  name: 'auth',
  initialState,
  // Редьюсеры для синхронных действий
  reducers: {
    logout: (state) => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      state.isLoading = false; // Сбросить isLoading при выходе
    },
    // Сброс флага успеха регистрации (например, после показа сообщения пользователю)
    resetRegistrationStatus: (state) => {
        state.registrationSuccess = false;
        state.error = null; // Также очищаем ошибки
    },
    // Очистка ошибок вручную (если нужно)
    clearAuthError: (state) => {
        state.error = null;
    }
  },
  // Обработка состояний асинхронных thunks
  extraReducers: (builder) => {
    builder
      // --- Login ---
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null; // Очищаем предыдущие ошибки
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user; // Сохраняем данные пользователя
        state.accessToken = action.payload.tokens.access;
        state.refreshToken = action.payload.tokens.refresh;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.error = action.payload; // Сохраняем ошибку, полученную от rejectWithValue
      })
      // --- Register ---
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.registrationSuccess = false;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.registrationSuccess = true; // Устанавливаем флаг успеха
        state.error = null;
        // Не сохраняем пользователя или токены здесь, т.к. требуется логин
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.registrationSuccess = false;
        state.error = action.payload; // Сохраняем ошибку валидации или общую
      })
      // --- Load User ---
       .addCase(loadUser.pending, (state) => {
        // Можно установить isLoading = true, если хотите показывать индикатор при проверке токена
        // state.isLoading = true;
        state.error = null; // Очищаем ошибки перед загрузкой
      })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.isLoading = false; // Завершили загрузку
        state.isAuthenticated = true; // Пользователь аутентифицирован
        state.user = action.payload;   // Сохраняем данные пользователя
        state.error = null;
      })
      .addCase(loadUser.rejected, (state, action) => {
        state.isLoading = false; // Завершили попытку загрузки
        // Состояние уже очищено в самом thunk через dispatch(logout())
        // Можно сохранить причину ошибки, если нужно
        // state.error = action.payload;
        console.log('loadUser rejected, state cleaned up by logout dispatch');
      });
  },
});

// Экспорт синхронных actions
export const { logout, resetRegistrationStatus, clearAuthError } = authSlice.actions;

// Экспорт редьюсера
export default authSlice.reducer;