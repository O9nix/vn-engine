# VN Auth Service

Небольшой Node.js identity-сервис для локальной тестовой среды VN Engine, пока Keycloak недоступен.

## Возможности

- регистрация пользователя;
- login;
- access JWT;
- refresh token;
- logout;
- `/api/auth/me`;
- единый `userId` в поле JWT `sub`;
- хранение пользователей и refresh-сессий в JSON;
- CORS для локальной сети;
- только Node.js built-ins, без npm-зависимостей.

> Это development identity service, а не замена полноценному production Identity Provider. Перед реальным использованием нужны HTTPS, безопасное хранение секретов, rate limiting, email verification, password reset, 2FA и более строгая политика CORS.

## Запуск

```powershell
npm start
```

По умолчанию сервис слушает `0.0.0.0:8090`.

Для другой машины в LAN можно указать:

```powershell
$env:AUTH_PORT="8090"
$env:AUTH_JWT_SECRET="длинный-случайный-секрет"
$env:AUTH_ISSUER="http://192.168.1.50:8090"
$env:AUTH_CORS_ORIGIN="http://192.168.1.60:8080"
npm start
```

## API

### Регистрация

`POST /api/auth/register`

```json
{
  "username": "demo",
  "password": "demo123",
  "displayName": "Demo"
}
```

### Login

`POST /api/auth/login`

```json
{
  "username": "demo",
  "password": "demo123"
}
```

Ответ содержит `accessToken`, `refreshToken` и пользователя.

### Current user

`GET /api/auth/me`

```http
Authorization: Bearer <accessToken>
```

### Refresh

`POST /api/auth/refresh`

```json
{
  "refreshToken": "..."
}
```

Refresh-токен одноразовый: старый удаляется и выдаётся новый.

### Logout

`POST /api/auth/logout`

```json
{
  "refreshToken": "..."
}
```

## Архитектура

Позже этот сервис можно заменить Keycloak без изменения модели пользователя в остальных сервисах: главным идентификатором остаётся `JWT.sub`.
