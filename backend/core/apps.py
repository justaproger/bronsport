# core/apps.py
from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # Импортируем сигналы здесь, чтобы они были зарегистрированы при запуске Django
        try:
            import core.signals
            print("--- Core signals imported successfully ---")
        except ImportError:
             print("--- Warning: core.signals module not found or could not be imported ---")
        except Exception as e:
             print(f"--- Error importing core.signals: {e} ---")