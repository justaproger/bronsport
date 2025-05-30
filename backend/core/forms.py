# backend/core/forms.py
from django import forms
from django.contrib.auth.forms import ReadOnlyPasswordHashField, UserCreationForm as BaseUserCreationForm, UserChangeForm as BaseUserChangeForm
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError

User = get_user_model()

class UserCreationAdminForm(BaseUserCreationForm):
    """
    Кастомная форма для создания пользователя в админке.
    Использует email как username и включает обязательные поля.
    """
    email = forms.EmailField(
        label=_("Email"),
        widget=forms.EmailInput(attrs={'autofocus': True}),
        required=True
    )
    first_name = forms.CharField(label=_("First name"), required=True, max_length=150)
    last_name = forms.CharField(label=_("Last name"), required=True, max_length=150)
    phone_number = forms.CharField(label=_("Phone number"), required=False, max_length=20)

    class Meta(BaseUserCreationForm.Meta):
        model = User
        fields = ("email", "first_name", "last_name", "phone_number")
        # Поле username не включаем, оно будет сгенерировано в User.save()

    def clean_email(self):
        email = self.cleaned_data.get("email")
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError(_("User with this email address already exists."))
        return email

    def save(self, commit=True):
        user = super().save(commit=False) # Не сохраняем сразу, чтобы email установился
        user.email = self.cleaned_data["email"]
        # first_name, last_name, phone_number уже должны быть установлены из полей формы
        # username будет сгенерирован в User.save(), который вызовется ниже
        if commit:
            user.save()
        return user


class UserChangeAdminForm(BaseUserChangeForm):
    """
    Кастомная форма для изменения пользователя в админке.
    """
    email = forms.EmailField(
        label=_("Email"),
        widget=forms.EmailInput(),
        required=True
    )
    # Пароль здесь только для чтения (хеш)
    password = ReadOnlyPasswordHashField(
        label=_("Password"),
        help_text=_(
            "Raw passwords are not stored, so there is no way to see this "
            "user’s password, but you can change the password "
            'using <a href="{}">this form</a>.'
        ),
    )

    class Meta(BaseUserChangeForm.Meta):
        model = User
        fields = (
            "email",
            "password", # Отображает хеш и ссылку на смену пароля
            "first_name",
            "last_name",
            "phone_number",
            "is_active",
            "is_staff",
            "is_superuser",
            "groups",
            "user_permissions",
        )

    def clean_email(self):
        email = self.cleaned_data.get("email")
        # Проверяем уникальность email, исключая текущего пользователя
        if User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk).exists():
            raise ValidationError(_("User with this email address already exists."))
        return email

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        password_help_text = self.fields["password"].help_text
        if self.instance and self.instance.pk:
            # Форматируем help_text для ссылки на смену пароля
            # Нужен reverse, но в формах это делать сложнее.
            # Стандартный UserChangeForm делает это через self.instance.get_absolute_url() + "password/"
            # Мы можем пока оставить общий текст или сделать его более простым.
            # Либо, если мы используем стандартный шаблон админки, он сам подставит ссылку.
            # Для простоты, оставим как есть, админка должна справиться.
            pass