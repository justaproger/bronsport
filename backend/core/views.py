# core/views.py
from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .serializers import (
    UserRegistrationSerializer,
    UserDetailSerializer,
    ChangePasswordSerializer
)
# Для обновления сессии после смены пароля, если используется SessionAuthentication
# from django.contrib.auth import update_session_auth_hash

User = get_user_model()

class UserRegistrationView(generics.CreateAPIView):
    """ API view для регистрации пользователя. Доступно всем. """
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserRegistrationSerializer

    # Переопределяем create для возможной кастомизации ответа
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = self.perform_create(serializer)
        # Возвращаем только что созданные данные пользователя (без пароля)
        user_data = UserDetailSerializer(user, context=self.get_serializer_context()).data
        headers = self.get_success_headers(serializer.data)
        return Response(user_data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        # save() сериализатора создает пользователя
        return serializer.save()


class UserDetailView(generics.RetrieveUpdateAPIView):
    """
    API view для получения (GET) и обновления (PUT/PATCH)
    профиля ТЕКУЩЕГО аутентифицированного пользователя.
    """
    serializer_class = UserDetailSerializer
    permission_classes = (permissions.IsAuthenticated,) # Только для вошедших

    def get_object(self):
        # Объект для Retrieve/Update - это сам пользователь запроса
        return self.request.user

    # Метод perform_update вызывается при PUT/PATCH после валидации
    # Здесь можно добавить дополнительную логику, если нужно
    # def perform_update(self, serializer):
    #     serializer.save()


class ChangePasswordView(generics.UpdateAPIView):
    """ Эндпоинт для смены пароля текущим аутентифицированным пользователем (PUT/PATCH). """
    serializer_class = ChangePasswordSerializer
    model = User
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self, queryset=None):
        # Объект для обновления - текущий пользователь
        return self.request.user

    def update(self, request, *args, **kwargs):
        self.object = self.get_object()
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            # Вызываем save() сериализатора, который меняет пароль
            serializer.save()
            # Если бы использовалась аутентификация по сессиям, нужно было бы обновить хеш сессии:
            # update_session_auth_hash(request, self.object)
            return Response({"detail": _("Пароль успешно изменен.")}, status=status.HTTP_200_OK)

        # Если сериализатор невалиден, возвращаем ошибки
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)