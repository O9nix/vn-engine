# VN Engine Platform Foundation

VN Engine с отдельным Plug Server и первым слоем будущей платформы — единым Identity Provider.

## Структура

```text
vn-project/
├── identity/
│   ├── docker-compose.yml
│   ├── realm-vn.json
│   └── README.md
│
├── shared/
│   └── auth.js
│
├── vn-server/
│   ├── css/
│   ├── js/
│   │   ├── core.js
│   │   ├── engine.js
│   │   ├── extensions-host.js
│   │   ├── parser.js
│   │   ├── plugin-sdk.js
│   │   ├── plugin-manager.js
│   │   └── ui.js
│   ├── editor.html
│   ├── index.html
│   ├── player.html
│   ├── preview.html
│   └── server.js
│
└── plug-server/
    ├── data/
    │   ├── docs/
    │   └── plugins/
    │       ├── camera-shake/1.0.0/
    │       ├── debug-panel/1.0.0/
    │       ├── editor-sync/1.0.0/
    │       ├── example-plugin/1.0.0/
    │       ├── inventory/1.0.0/
    │       ├── multi-window/1.0.0/
    │       ├── variables/1.0.0/
    │       └── wait/1.0.0/
    ├── public/
    ├── package.json
    └── server.js
```

## Официальные предустановленные плагины

Бывшие встроенные расширения теперь являются обычными плагинами из каталога Plug Server:

- `camera-shake` — тряска камеры;
- `wait` — пауза сценария;
- `variables` — работа с runtime-переменными;
- `debug-panel` — инспектор состояния игры;
- `example-plugin` — пример для разработчиков Plugin SDK.

Их manifest содержит `preinstalled: true`. При первом запуске VN Engine SDK получает каталог Plug Server и автоматически устанавливает эти плагины в список проекта. После этого они загружаются как обычные плагины.

Пользовательские плагины (`editor-sync`, `inventory`, `multi-window`) остаются отдельными каталоговыми расширениями и устанавливаются вручную из окна `⚙ Плагины`.

Состояние переменных по-прежнему хранится в низкоуровневом `VNCore` как базовый runtime-механизм. Плагин `variables` предоставляет сценарную команду и пользовательский runtime-интерфейс поверх этого механизма.

## Запуск

Сначала запустите каталог:

```bash
cd plug-server
npm start
```

По умолчанию: `http://127.0.0.1:8787`.

Затем в другом терминале запустите движок:

```bash
cd vn-server
node server.js
```

По умолчанию: `http://localhost:8080`.

## Каталог плагинов

Кнопка `⚙ Плагины` открывает три режима:

- **Каталог** — плагины из Plug Server, поиск, детали, установка и обновление;
- **Установленные** — включение, выключение, удаление и детали;
- **Локальная установка** — `.js` файл или произвольный URL для разработки.

Адрес каталога по умолчанию — `http://127.0.0.1:8787`. Его можно изменить прямо в окне менеджера.

## API Plug Server

- `GET /api/health`
- `GET /api/plugins`
- `GET /api/plugins/:id`
- `GET /api/plugins/:id/:version`
- `POST /api/plugins`
- `GET /api/docs/sdk/:version`
- `GET /api/docs/engine/:version`
- `/plugins/:id/:version/extension.js` — код расширения.

Plug Server разрешает CORS для локального клиента VN Engine.


## Единая авторизация

Добавлен локальный Identity Provider на Keycloak. Все будущие сервисы используют один OIDC realm `vn`. Первичный идентификатор пользователя — `sub` из JWT; в коде сервисов он называется `userId`. Username не является ключом пользователя.

### Запуск Identity

Нужен Docker Desktop.

```powershell
cd identity
docker compose up -d
```

После запуска:

- Keycloak: `http://127.0.0.1:8090`
- Realm: `vn`
- Web client: `vn-web`
- Dev user: `demo` / `demo`
- Dev admin: `admin` / `admin`

Затем запускаются `plug-server` и `vn-server`. VN Engine показывает состояние входа в верхней панели, а Plugin SDK предоставляет плагинам `api.auth.user`, `api.auth.userId` и `api.auth.fetch()`.

### Защищённые API

Оба Node-сервиса имеют:

- `GET /api/auth/status` — публичная проверка наличия валидного Bearer token;
- `GET /api/auth/me` — требует Bearer token и возвращает нормализованный `user`;
- `GET /api/health` — health check.

`POST /api/plugins` теперь требует авторизацию и записывает `ownerId`/`ownerUsername` из токена.

Это пока фундамент авторизации. Каталог игр, проекты, комментарии и публикация игр будут строиться следующим слоем — поверх того же `userId`.
