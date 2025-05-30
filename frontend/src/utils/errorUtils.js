import i18n from '../i18n'; // Импортируем инстанс i18next напрямую

/**
 * Разбирает объект ошибки Axios/API и возвращает удобное для пользователя сообщение.
 * Пытается перевести стандартные ошибки или ключи.
 *
 * @param {Error|Object} error - Объект ошибки (может быть AxiosError или стандартный Error).
 * @param {string} [fallbackMessageKey='errors.generic'] - Ключ для дефолтного сообщения в i18n.
 * @param {string} [fallbackDefaultText='Произошла неизвестная ошибка.'] - Дефолтный текст, если ключ не найден.
 * @returns {string} - Человекочитаемое сообщение об ошибке.
 */
export const parseApiError = (
    error,
    fallbackMessageKey = 'errors.generic',
    fallbackDefaultText = 'Произошла неизвестная ошибка.' // Убедись, что этот ключ есть в переводах
) => {
  const { t } = i18n; // Получаем функцию t из инстанса

  // 1. Проверяем ответ сервера (ошибки 4xx, 5xx от Axios)
  if (error?.response?.data) {
    const data = error.response.data;

    // a) Ошибка 'detail' (часто для 401, 403, 404, 500)
    if (typeof data.detail === 'string') {
      const key = `errors.api.${data.detail.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
      return t(key, data.detail);
    }

    // b) Ошибка 'error' (если бэкенд возвращает кастомный ключ 'error')
    if (typeof data.error === 'string') {
       const key = `errors.api.${data.error.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
       return t(key, data.error);
    }
    
    // c) Ошибки валидации полей DRF (объект с массивами строк или строками)
    // Также обрабатываем случай, когда data сама является строкой (некоторые API так возвращают)
    if (typeof data === 'object' && data !== null) {
      const fieldErrors = [];
      for (const field in data) {
        if (field === 'non_field_errors' && Array.isArray(data[field])) {
          fieldErrors.push(...data[field]);
        } else if (Array.isArray(data[field])) {
          // Берем первое сообщение для краткости
          // const fieldName = t(`fields.${field}`, field); // Опционально: переводим название поля
          // fieldErrors.push(`${fieldName}: ${data[field][0]}`);
          fieldErrors.push(data[field][0]);
        } else if (typeof data[field] === 'string' && field !== 'detail' && field !== 'error') {
          // Если ошибка поля - это просто строка
          // const fieldName = t(`fields.${field}`, field);
          // fieldErrors.push(`${fieldName}: ${data[field]}`);
           fieldErrors.push(data[field]);
        }
      }
      if (fieldErrors.length > 0) {
         const firstError = fieldErrors[0];
         const key = `errors.validation.${firstError.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
         return t(key, firstError);
      }
    } else if (typeof data === 'string') { // Если data - это просто строка ошибки
        const key = `errors.api.${data.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
        return t(key, data);
    }
  }

  // 2. Ошибка сети или другая ошибка Axios (error.message)
  if (error?.message) {
    if (error.message.toLowerCase().includes('network error')) {
      return t('errors.network_error', 'Ошибка сети. Проверьте подключение и попробуйте еще раз.');
    }
    if (error.message.toLowerCase().includes('timeout')) {
        return t('errors.timeout_error', 'Превышено время ожидания ответа от сервера.');
    }
    // Для других сообщений Axios, пытаемся их перевести или возвращаем как есть
    const key = `errors.axios.${error.message.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    return t(key, error.message);
  }

  // 3. Если это не объект ошибки Axios, а просто строка
  if (typeof error === 'string') {
    const key = `errors.generic_string.${error.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    return t(key, error);
  }

  // 4. Во всех остальных случаях возвращаем дефолтное сообщение
  console.error("Unknown error structure passed to parseApiError:", error);
  return t(fallbackMessageKey, fallbackDefaultText);
};