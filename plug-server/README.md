# VN Plug Server

Отдельный сервер-каталог расширений VN Engine.

Запуск:

```bash
npm start
```

По умолчанию: `http://127.0.0.1:8787`.

## Каталог

Расширения хранятся в:

```text
data/plugins/<plugin-id>/<version>/
    manifest.json
    extension.js
```

Сейчас каталог содержит:

### Предустановленные официальные плагины

- `camera-shake` — тряска камеры;
- `wait` — пауза;
- `variables` — переменные;
- `debug-panel` — панель отладки;
- `example-plugin` — пример Plugin SDK.

Их manifest содержит `preinstalled: true`, поэтому новый клиент VN Engine автоматически добавляет их в список установленных при первом запуске.

### Каталог пользовательских плагинов

- `editor-sync`;
- `multi-window`;
- `inventory`.

Они устанавливаются пользователем через Plugin Manager.

## API

- `GET /api/health`
- `GET /api/plugins`
- `GET /api/plugins/:id`
- `GET /api/plugins/:id/:version`
- `POST /api/plugins`
- `GET /api/docs/sdk/:version`
- `GET /api/docs/engine/:version`
- `/plugins/:id/:version/extension.js` — JS-код плагина.

Plug Server разрешает CORS для локального VN Engine.
