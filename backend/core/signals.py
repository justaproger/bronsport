# core/signals.py
from django.dispatch import receiver
from django_rest_passwordreset.signals import reset_password_token_created
from django.conf import settings
from django.core.mail import send_mail # Используем send_mail для простоты
import traceback # Для детального вывода ошибки

@receiver(reset_password_token_created)
def password_reset_token_created(sender, instance, reset_password_token, *args, **kwargs):
    """
    Обработчик сигнала для отправки email (Упрощенная версия для отладки).
    """
    print(f"--- SIGNAL RECEIVED: password_reset_token_created for user {reset_password_token.user.email} ---")
    print(f"--- Token: {reset_password_token.key} ---")

    # Формируем URL вручную для включения в тело письма
    reset_url = f"{settings.FRONTEND_URL}/reset-password/{reset_password_token.key}/"
    email_subject = f"Сброс пароля для {reset_password_token.user.get_username()}" # Используем get_username() для совместимости
    email_body = (
        f"Вы получили это письмо, потому что запросили сброс пароля для вашей учетной записи на сайте UniSport.\n\n"
        f"Пожалуйста, перейдите по следующей ссылке, чтобы установить новый пароль:\n{reset_url}\n\n"
        f"Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.\n\n"
        f"Спасибо!\nКоманда UniSport"
    )

    try:
        print(f"--- Attempting simple send_mail to {reset_password_token.user.email} ---")
        send_mail(
            email_subject,
            email_body,
            settings.DEFAULT_FROM_EMAIL,
            [reset_password_token.user.email],
            fail_silently=False, # Обязательно False, чтобы видеть ошибки
        )
        print(f"--- Simple send_mail finished for {reset_password_token.user.email} ---")
    except Exception as e:
        print(f"--- ERROR during simple send_mail: {e} ---")
        traceback.print_exc() # Печатаем полный traceback ошибки