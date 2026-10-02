# VN Identity

Локальный Identity Provider на Keycloak 26.7.5.

## Запуск

Требуется Docker Desktop:

```powershell
cd identity
docker compose up -d
```

Keycloak: http://127.0.0.1:8090
Админ-консоль: http://127.0.0.1:8090/admin

Dev admin: `admin` / `admin`
Realm: `vn`
Web client: `vn-web` (public OIDC client, Authorization Code flow).

Demo user: `demo` / `demo`

> Эти пароли предназначены только для локальной разработки. Перед публикацией их нужно заменить.

## Единый userId

Во всех сервисах первичным идентификатором пользователя является стандартный OIDC claim `sub` — стабильный UUID пользователя Keycloak. Username используется только для отображения.

```text
Keycloak sub → userId → projects / plugins / comments / games
```
