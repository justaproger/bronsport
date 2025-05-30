# --- START OF FULL FILE backend/unisport_backend/settings.py ---
import os
from pathlib import Path
from datetime import timedelta
from django.utils.translation import gettext_lazy as _
# Раскомментируйте, если используете python-dotenv и .env файл для переменных окружения
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Загрузка .env файла (если используется)
# DOTENV_PATH = BASE_DIR / '.env'
# if os.path.exists(DOTENV_PATH):
#     load_dotenv(DOTENV_PATH)

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-fallback-key-for-dev-only-change-in-prod!')
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() == 'true'

# IP для разработки, если фронтенд запускается локально и нужен доступ к API
YOUR_LOCAL_IP_FOR_DEV = os.environ.get('YOUR_LOCAL_IP_FOR_DEV', '127.0.0.1') 

ALLOWED_HOSTS_STRING = os.environ.get('DJANGO_ALLOWED_HOSTS', f'localhost,127.0.0.1,{YOUR_LOCAL_IP_FOR_DEV}')
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS_STRING.split(',') if host.strip()]
# Для продакшена переменная окружения DJANGO_ALLOWED_HOSTS должна содержать:
# "bronsport.uz,www.bronsport.uz,api.bronsport.uz"
# Если QR-сканер будет на отдельном субдомене, его тоже нужно добавить.

INSTALLED_APPS = [
    'modeltranslation', # Должен быть выше 'django.contrib.admin'
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize', # Для форматирования чисел и дат в шаблонах
    
    'payme', # Библиотека Payme
    
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_rest_passwordreset',
    'django_filters',
    # 'sslserver', # Только для локальной разработки HTTPS, если необходимо

    # Наши приложения
    'core.apps.CoreConfig',
    'universities.apps.UniversitiesConfig',
    'facilities.apps.FacilitiesConfig',
    'bookings.apps.BookingsConfig',
    'dashboard.apps.DashboardConfig',
    'checkin.apps.CheckinConfig', 
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # Должен быть как можно выше, особенно перед CommonMiddleware
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware', # Для статики в проде, после SecurityMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware', 
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'unisport_backend.urls' # Изменено на unisport_backend

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'django.template.context_processors.i18n',
            ],
        },
    },
]

WSGI_APPLICATION = 'unisport_backend.wsgi.application' # Изменено на unisport_backend
ASGI_APPLICATION = 'unisport_backend.asgi.application' # Для ASGI серверов, если планируется

# --- Database Configuration ---
DB_ENGINE = os.environ.get('DB_ENGINE', 'django.db.backends.sqlite3')
DB_NAME_SQLITE = BASE_DIR / 'db.sqlite3' # Имя файла для SQLite по умолчанию
DB_NAME_POSTGRES = os.environ.get('DB_NAME') # Имя БД PostgreSQL из env
DB_USER = os.environ.get('DB_USER')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
DB_HOST = os.environ.get('DB_HOST', 'localhost') 
DB_PORT = os.environ.get('DB_PORT', '5432')

if DB_ENGINE == 'django.db.backends.postgresql' and DB_NAME_POSTGRES and DB_USER and DB_PASSWORD:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': DB_NAME_POSTGRES,
            'USER': DB_USER,
            'PASSWORD': DB_PASSWORD,
            'HOST': DB_HOST,
            'PORT': DB_PORT,
        }
    }
else: 
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': DB_NAME_SQLITE,
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},
]

# Internationalization
LANGUAGE_CODE = 'uz' 
LANGUAGES = [ ('uz', _('Uzbek')), ('ru', _('Russian')), ] # _() для возможности перевода названий языков в админке
LOCALE_PATHS = [ os.path.join(BASE_DIR, 'locale'), ] # Путь к файлам переводов .po/.mo
MODELTRANSLATION_DEFAULT_LANGUAGE = LANGUAGE_CODE
MODELTRANSLATION_LANGUAGES = ('uz', 'ru') # Языки, для которых создаются поля в БД
MODELTRANSLATION_FALLBACK_LANGUAGES = {'default': (LANGUAGE_CODE, 'ru')} # Порядок фоллбэка

TIME_ZONE = 'Asia/Tashkent'
USE_I18N = True
USE_L10N = True # Для локализованного форматирования дат, чисел
USE_TZ = True # Рекомендуется для работы с часовыми поясами

# Static files
STATIC_URL = '/static/'
# STATICFILES_DIRS для дополнительных директорий со статикой во время разработки
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'static_collected')] # Если есть общая папка для статики
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles_production') # Куда collectstatic будет собирать все файлы
# Для WhiteNoise (оптимизация раздачи статики)
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'


# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media_production' if not DEBUG else 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'core.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication', 
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
     'DEFAULT_FILTER_BACKENDS': [
         'django_filters.rest_framework.DjangoFilterBackend',
         'rest_framework.filters.SearchFilter',
         'rest_framework.filters.OrderingFilter',
     ],
     'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
     'PAGE_SIZE': 12 
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60) if not DEBUG else timedelta(days=1), # Короткое время для прода
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False, 
    "BLACKLIST_AFTER_ROTATION": False, 
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256", "SIGNING_KEY": SECRET_KEY,
    "VERIFYING_KEY": None, "AUDIENCE": None, "ISSUER": None, "JWK_URL": None, "LEEWAY": 0,
    "AUTH_HEADER_TYPES": ("Bearer",), "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id", "USER_ID_CLAIM": "user_id",
    "USER_AUTHENTICATION_RULE": "rest_framework_simplejwt.authentication.default_user_authentication_rule",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type", "JTI_CLAIM": "jti",
}

# CORS Settings
FRONTEND_BASE_URL_ENV = os.environ.get('FRONTEND_URL', f'http://{YOUR_LOCAL_IP_FOR_DEV}:5173')
# QR_SCANNER_FRONTEND_URL_ENV = os.environ.get('QR_SCANNER_FRONTEND_URL', f'http://qr.bronsport.uz') # Если будет отдельный

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True # Для локальной разработки
else:
    CORS_ALLOW_ALL_ORIGINS = False
    # Для продакшена указываем конкретные домены
    CORS_ALLOWED_ORIGINS = [
        f"https://{os.environ.get('FRONTEND_DOMAIN', 'bronsport.uz')}",
        f"https://www.{os.environ.get('FRONTEND_DOMAIN', 'bronsport.uz')}",
        # f"https://{os.environ.get('QR_SCANNER_DOMAIN', 'qr.bronsport.uz')}", # Если будет
    ]
CORS_ALLOW_CREDENTIALS = True # Если фронтенд шлет куки или заголовки авторизации

# Email Settings (Gmail SMTP)
EMAIL_BACKEND = os.environ.get('DJANGO_EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend' if not DEBUG else 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False').lower() == 'true'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER') 
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD') 
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', f"Bronsport <{EMAIL_HOST_USER or 'noreply@bronsport.uz'}>")
SERVER_EMAIL = DEFAULT_FROM_EMAIL # Для системных уведомлений Django админам
ADMIN_EMAIL_RECEIVER = os.environ.get('ADMIN_EMAIL_RECEIVER') # Email для получения ошибок Django
ADMINS = [(name_email_pair.split(':')[0].strip(), name_email_pair.split(':')[1].strip()) for name_email_pair in os.environ.get('DJANGO_ADMINS', '').split(',') if ':' in name_email_pair and name_email_pair.strip()] if os.environ.get('DJANGO_ADMINS') else []
if not ADMINS and ADMIN_EMAIL_RECEIVER and '@' in ADMIN_EMAIL_RECEIVER:
    ADMINS = [('Bronsport Admin', ADMIN_EMAIL_RECEIVER)]
MANAGERS = ADMINS

DJANGO_REST_PASSWORDRESET_EMAIL_TEMPLATE_NAME = 'registration/password_reset_email.html'

# Paycom (payme-pkg) Settings
PAYME_ACCOUNT_MODEL = "bookings.models.Order"
PAYME_ACCOUNT_FIELD = "id" 
PAYME_AMOUNT_FIELD = "total_price" 
PAYME_ONE_TIME_PAYMENT = True
PAYME_DISABLE_ADMIN = False 

PAYME_WEBHOOK_LOGIN = os.environ.get('PAYME_WEBHOOK_LOGIN', "Paycom")
PAYME_WEBHOOK_TEST_KEY = os.environ.get("PAYME_WEBHOOK_TEST_KEY") # Ключ для Sandbox из .env
PAYME_WEBHOOK_PRODUCTION_KEY = os.environ.get("PAYME_WEBHOOK_PRODUCTION_KEY") # Ключ для боевого из .env

PAYCOM_CHECKOUT_URL = "https://checkout.paycom.uz" if not DEBUG else "https://test.paycom.uz"
PAYCOM_CALLBACK_BASE_URL = FRONTEND_BASE_URL_ENV 

# Безопасность для продакшена
if not DEBUG:
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True # Если используете сессии Django (например, для админки)
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    # SECURE_SSL_REDIRECT = True # Обычно Nginx делает редирект на HTTPS
    # SECURE_HSTS_SECONDS = 2592000 # 30 дней. Увеличить после тестов.
    # SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    # SECURE_HSTS_PRELOAD = True # Только после тщательного тестирования HSTS
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https') # Если Django за Nginx/прокси

# Логирование
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {name} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {asctime} {name} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file_django': {
            'level': 'INFO' if not DEBUG else 'DEBUG', 
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs/django.log', 
            'maxBytes': 1024 * 1024 * 10, # 10 MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'file_paycom_handler': { # Отдельный логгер для нашего обработчика Paycom
            'level': 'INFO' if not DEBUG else 'DEBUG', 
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs/paycom_callbacks.log',
            'maxBytes': 1024 * 1024 * 5,
            'backupCount': 3,
            'formatter': 'verbose',
        },
        'file_payme_lib': { # Логгер для самой библиотеки payme-pkg
            'level': 'INFO' if not DEBUG else 'DEBUG',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs/payme_library.log',
            'maxBytes': 1024 * 1024 * 5,
            'backupCount': 3,
            'formatter': 'verbose',
        },
        'mail_admins': {
            'level': 'ERROR',
            'class': 'django.utils.log.AdminEmailHandler',
            'formatter': 'verbose',
            'include_html': True, # Отправлять HTML письма
        }
    },
    'root': { # Логгер по умолчанию для всего, что не указано явно
        'handlers': ['console', 'file_django'],
        'level': 'WARNING', 
    },
    'loggers': {
        'django': { # Логи самого Django
            'handlers': ['console', 'file_django', 'mail_admins'],
            'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'), 
            'propagate': False, # Не передавать сообщения выше (в root)
        },
        'django.request': { # Ошибки обработки запросов
            'handlers': ['mail_admins', 'file_django'],
            'level': 'ERROR',
            'propagate': False,
        },
        'bookings.paycom_handler': { # Наш обработчик Paycom
            'handlers': ['console', 'file_paycom_handler', 'mail_admins'],
            'level': 'INFO' if not DEBUG else 'DEBUG',
            'propagate': False,
        },
        'payme': { # Логи библиотеки payme-pkg
            'handlers': ['console', 'file_payme_lib'],
            'level': 'INFO' if not DEBUG else 'DEBUG',
            'propagate': False,
        },
        'checkin': { # Логи для QR-сканера
            'handlers': ['console', 'file_django'],
            'level': 'INFO' if not DEBUG else 'DEBUG',
            'propagate': False,
        },
        # Можно добавить логгеры для других ваших приложений
        # 'core': { ... },
        # 'facilities': { ... },
    },
}
LOGS_DIR = BASE_DIR / 'logs'
if not LOGS_DIR.exists():
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
# --- END OF FULL FILE ---