# VN Engine + development Auth Server

В этой сборке добавлена рабочая связка с отдельным `vn-auth-service`.

## Запуск

1. Запустить auth-server:

```powershell
cd D:\Game\VNEngine\auth-server
npm start
```

По умолчанию: `http://127.0.0.1:8090`

2. Запустить VN Server:

```powershell
cd D:\Game\VNEngine\vn-server
node server.js 3001
```

Открыть `http://127.0.0.1:3001/`.

## Что добавлено

- `/login` — страница входа;
- `/register` — регистрация;
- `js/auth-client.js` — клиент auth-server;
- access JWT + refresh token в localStorage;
- автоматический refresh access token;
- кнопки Войти / Регистрация / Выйти в верхней панели;
- восстановление текущего пользователя через `/api/auth/me`.

Auth API находится на `http://127.0.0.1:8090`.

Если auth-server работает на другом адресе, перед загрузкой `auth-client.js` можно задать:

```html
<script>window.VN_AUTH_URL = 'http://192.168.1.50:8090';</script>
```

Это development-связка. Для production позже заменим её на полноценный Identity Provider.
