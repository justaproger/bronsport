from django.contrib.auth import get_user_model
# Импортируем University и Group для проверки типов и запросов,
# но так, чтобы не было ошибки, если эти приложения еще не загружены полностью
# или если utils.py импортируется раньше, чем модели этих приложений.
# Можно использовать apps.get_model, но для простоты пока оставим прямые импорты
# с обработкой ImportError, если это необходимо (хотя для get_admin_university это не критично).

# from django.contrib.auth.models import Group # Если будем проверять по имени группы явно
# from universities.models import University # Если будем возвращать объект University

# Вспомогательная функция для определения прав администратора университета
def get_admin_university_details(user):
    """
    Определяет, к какому университету привязан администратор.
    Возвращает объект University, если пользователь является админом конкретного ВУЗа.
    Возвращает None, если пользователь суперюзер (имеет доступ ко всем ВУЗам).
    Возвращает специальное значение (например, -1 или кастомный объект/исключение), 
    если пользователь не суперюзер и не админ ВУЗа, чтобы вызывающий код мог это обработать.

    Текущая реализация возвращает:
    - Объект University: для админа конкретного ВУЗа.
    - None: для суперюзера.
    - -1: для всех остальных аутентифицированных пользователей, не являющихся админами.
    - -1: для неаутентифицированных пользователей (хотя обычно вызывается для аутентифицированных).
    """
    User = get_user_model() # Получаем актуальную модель пользователя

    if not user or not hasattr(user, 'is_authenticated') or not user.is_authenticated:
        return -1  # Не аутентифицирован или некорректный объект пользователя
    
    if user.is_superuser:
        return None  # Суперюзер имеет доступ ко всему

    # Проверяем, является ли пользователь администратором университета
    # Предполагается, что у модели User есть поле administered_university (OneToOneField к University)
    # и что администраторы ВУЗов состоят в группе 'University Admins'.
    # Наличие administered_university уже достаточно сильный признак.
    # Группа 'University Admins' может использоваться для более гранулярного назначения прав в админке.
    
    is_in_uni_admin_group = user.groups.filter(name='University Admins').exists()
    has_administered_uni = hasattr(user, 'administered_university') and user.administered_university is not None

    if is_in_uni_admin_group and has_administered_uni:
        return user.administered_university # Возвращаем объект University
    
    # Если пользователь в группе, но университет не назначен, или наоборот - это может быть ошибка конфигурации.
    # Для простоты, если оба условия не выполнены, считаем его не админом конкретного ВУЗа.
    return -1 # Не является админом конкретного университета