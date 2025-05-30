# dashboard/admin.py
from django.contrib import admin
from django.urls import path, reverse # Нужны для добавления URL и редиректа
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from django.http import HttpResponseRedirect # Для редиректа со страницы списка

# Импортируем прокси-модель из текущего приложения
from .models import StatisticsDashboard
# Импортируем view статистики из текущего приложения
try:
    from .views import statistics_dashboard_view
    STATS_VIEW_AVAILABLE = True
except ImportError:
    statistics_dashboard_view = None # Заглушка на случай ошибки импорта
    STATS_VIEW_AVAILABLE = False
    print("Warning [dashboard.admin]: statistics_dashboard_view not found in dashboard.views. Statistics page in admin might not work.")


@admin.register(StatisticsDashboard)
class StatisticsDashboardAdmin(admin.ModelAdmin):
    """
    Админ-класс для прокси-модели StatisticsDashboard.
    Основная задача - создать пункт в меню админки и перенаправить
    со стандартной страницы списка ('changelist') на кастомную страницу статистики.
    Также регистрирует URL для кастомной страницы статистики.
    """

    # --- Убираем стандартные кнопки/действия для этой псевдо-модели ---

    def has_add_permission(self, request):
        # Запрещаем создавать экземпляры этой "модели" через интерфейс админки
        return False

    def has_change_permission(self, request, obj=None):
        # Запрещаем доступ к стандартной форме изменения
        return False

    def has_delete_permission(self, request, obj=None):
        # Запрещаем удаление
        return False

    def has_view_permission(self, request, obj=None):
        # Разрешаем "просмотр" (т.е. видимость пункта меню) всем сотрудникам (is_staff=True).
        # Реальный доступ к странице статистики контролируется декоратором @staff_member_required
        # на самом представлении `statistics_dashboard_view`.
        return request.user.is_staff

    # --- Перенаправляем со страницы списка ---

    def changelist_view(self, request, extra_context=None):
        """
        Переопределяем стандартный вид списка моделей ('changelist').
        Вместо отображения таблицы (которой нет), делаем редирект
        на нашу кастомную страницу статистики.
        """
        # Генерируем URL к нашему кастомному view, используя имя URL,
        # которое мы зададим ниже в методе get_urls().
        try:
             # Имя URL состоит из:
             # 'admin': стандартный неймспейс админки
             # 'dashboard_statistics': имя, которое мы задаем в path() в get_urls()
             dashboard_url = reverse('admin:dashboard_statistics')
             # Выполняем редирект
             return HttpResponseRedirect(dashboard_url)
        except Exception as e:
             # Если не удалось сгенерировать URL (например, ошибка в get_urls или регистрации)
             print(f"Error reversing 'admin:dashboard_statistics' in changelist_view: {e}")
             # Показываем сообщение об ошибке и перенаправляем на главную админки
             from django.contrib import messages
             messages.error(request, _("Не удалось открыть страницу статистики. Проверьте конфигурацию URL."))
             return HttpResponseRedirect(reverse('admin:index'))


    # --- Добавляем URL для кастомного view в админку ---

    def get_urls(self):
        """
        Добавляет URL для кастомного представления статистики
        в URL-адреса, управляемые этим ModelAdmin (и всем admin.site).
        """
        # Получаем стандартные URL для этой модели (changelist, history и т.д., хотя они нам не нужны)
        urls = super().get_urls()

        custom_urls = []
        # Добавляем URL только если view статистики был успешно импортирован
        if STATS_VIEW_AVAILABLE and statistics_dashboard_view:
             custom_urls = [
                 path(
                     # Путь относительно URLа админки для этой модели:
                     # /admin/dashboard/statisticsdashboard/statistics/
                     'statistics/',
                     # Оборачиваем наше view в self.admin_site.admin_view
                     # для автоматической проверки прав доступа к админке (is_staff)
                     # и добавления стандартного контекста админки (например, для base_site.html)
                     self.admin_site.admin_view(statistics_dashboard_view),
                     # Задаем уникальное имя URL для использования в reverse() и шаблонах
                     name='dashboard_statistics'
                 )
             ]

        # Возвращаем кастомные URL + стандартные URL.
        # Порядок важен, если бы мы переопределяли стандартные URL.
        # Для добавления нового URL порядок обычно не критичен.
        return custom_urls + urls

    # Так как это прокси-модель без реальных данных для отображения в списке,
    # переопределение list_display, list_filter и т.д. не имеет смысла.