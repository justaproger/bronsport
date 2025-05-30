import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/uz-latn';

let globalQueryClient = null;

export const setGlobalQueryClient = (client) => {
  globalQueryClient = client;
  console.log('[i18n] globalQueryClient has been set.');
};

const supportedLngs = ['uz', 'ru']; 
const fallbackLng = 'uz'; 

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: supportedLngs,
    fallbackLng: fallbackLng,
    debug: import.meta.env.DEV, 
    detection: {
      order: ['path', 'localStorage', 'navigator'], 
      caches: ['localStorage'], 
      lookupFromPathIndex: 0,   
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json', 
    },
    react: {
      useSuspense: true, 
    },
    interpolation: {
      escapeValue: false, 
    },
  });

const changeDayjsLocale = (lngInput) => {
    let localeForDayjs = lngInput;
    if (lngInput === 'uz') {
        localeForDayjs = 'uz-latn'; 
    }
    try {
        dayjs.locale(localeForDayjs);
        console.log(`[i18n] Day.js locale changed to: ${localeForDayjs}`);
    } catch (e) {
        console.warn(`[i18n] Failed to set Day.js locale to: ${localeForDayjs}. Error: ${e}`);
    }
};

i18n.on('initialized', (options) => {
    if (i18n.language) {
        changeDayjsLocale(i18n.language);
    } else {
        console.warn('[i18n] Language not defined after initialization, using fallback for Day.js.');
        changeDayjsLocale(fallbackLng);
    }
});

i18n.on('languageChanged', (lng) => {
    changeDayjsLocale(lng);
    
    if (globalQueryClient) {
        console.log('[i18n] Invalidating React Query cache due to language change...');
        globalQueryClient.invalidateQueries({ queryKey: ['facilities'] }); 
        globalQueryClient.invalidateQueries({ queryKey: ['facilityDetail'] }); 
        globalQueryClient.invalidateQueries({ queryKey: ['universitiesList'] }); 
        globalQueryClient.invalidateQueries({ queryKey: ['universityDetail'] }); 
        globalQueryClient.invalidateQueries({ queryKey: ['allUniversitiesForCities'] });
        
        // Ключи для заказов и статистики
        globalQueryClient.invalidateQueries({ queryKey: ['myUnifiedOrders'] }); // Общий ключ для всех списков заказов
        globalQueryClient.invalidateQueries({ queryKey: ['mySubscriptions'] }); // Если этот ключ все еще используется отдельно
        globalQueryClient.invalidateQueries({ queryKey: ['userDashboardStats'] });
        
        globalQueryClient.invalidateQueries({ queryKey: ['facilityAvailability'] });
        globalQueryClient.invalidateQueries({ queryKey: ['comprehensiveSubscriptionAvailability'] });
        
        globalQueryClient.invalidateQueries({ queryKey: ['amenitiesList'] });
        globalQueryClient.invalidateQueries({ queryKey: ['universityStaff'] });
        globalQueryClient.invalidateQueries({ queryKey: ['universityClubs'] });

        console.log('[i18n] React Query cache invalidation process initiated.');
    } else {
        console.warn('[i18n] globalQueryClient is not set. Cannot invalidate cache.');
    }
});

export default i18n;