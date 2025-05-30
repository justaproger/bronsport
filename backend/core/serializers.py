# core/serializers.py
from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core import exceptions as django_exceptions
from django.utils.translation import gettext_lazy as _

User = get_user_model()

class UserRegistrationSerializer(serializers.ModelSerializer):
    """ Сериализатор для регистрации нового пользователя. """
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password], style={'input_type': 'password'}
    )
    password2 = serializers.CharField(
        write_only=True, required=True, label=_("Confirm Password"), style={'input_type': 'password'}
    )

    class Meta:
        model = User
        # Указываем поля, которые принимаем от фронтенда
        fields = ('email', 'first_name', 'last_name', 'phone_number', 'password', 'password2')
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
            # 'username' не принимаем от пользователя, генерируем на бэке
        }

    def validate(self, attrs):
        """ Проверка совпадения паролей. """
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": _("Password fields didn't match.")})
        # Убираем password2 из данных для сохранения
        attrs.pop('password2')
        return attrs

    def create(self, validated_data):
        """ Создание пользователя с хешированным паролем и генерацией username. """
         # Генерируем username (простой вариант, улучшить для production)
        email_prefix = validated_data['email'].split('@')[0]
        username = f"{email_prefix}_{User.objects.count() + 1}"
        while User.objects.filter(username=username).exists():
            username = f"{email_prefix}_{User.objects.count() + 1}_{uuid.uuid4().hex[:4]}" # Добавляем случайность

        user = User.objects.create_user(
            username=username, # Используем сгенерированный
            email=validated_data['email'],
            password=validated_data['password'], # create_user хеширует пароль
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', '')
        )
        # Пользователь активен по умолчанию
        return user

class UserDetailSerializer(serializers.ModelSerializer):
    """ Сериализатор для получения и частичного обновления данных пользователя. """
    class Meta:
        model = User
        # Поля, которые можно читать и ОБНОВЛЯТЬ через PATCH/PUT /api/auth/user/
        fields = ('id', 'email', 'username', 'first_name', 'last_name', 'phone_number', 'is_staff', 'is_superuser', 'date_joined', 'last_login')
        # Поля только для чтения (нельзя изменить через этот эндпоинт)
        read_only_fields = ('id', 'email', 'username', 'is_staff', 'is_superuser', 'date_joined', 'last_login')

class ChangePasswordSerializer(serializers.Serializer):
    """ Сериализатор для смены пароля аутентифицированным пользователем. """
    old_password = serializers.CharField(required=True, write_only=True, label=_("Старый пароль"), style={'input_type': 'password'})
    new_password1 = serializers.CharField(required=True, write_only=True, validators=[validate_password], label=_("Новый пароль"), style={'input_type': 'password'})
    new_password2 = serializers.CharField(required=True, write_only=True, label=_("Подтверждение нового пароля"), style={'input_type': 'password'})

    def validate_old_password(self, value):
        """ Проверка старого пароля. """
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError(_("Ваш старый пароль введен неверно."))
        return value

    def validate(self, data):
        """ Проверка совпадения новых паролей и несовпадения со старым. """
        if data['new_password1'] != data['new_password2']:
            raise serializers.ValidationError({'new_password2': _("Новые пароли не совпадают.")})
        if data['old_password'] == data['new_password1']:
             raise serializers.ValidationError({'new_password1': _("Новый пароль не должен совпадать со старым.")})
        return data

    def save(self, **kwargs):
        """ Установка нового пароля. """
        password = self.validated_data['new_password1']
        user = self.context['request'].user
        user.set_password(password)
        user.save()
        return user