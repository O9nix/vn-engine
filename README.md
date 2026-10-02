# VN Engine + Plug Server

Полный проект VN Engine с отдельным Plug Server — каталогом и сервером расширений.

## Структура

```text
vn-project/
├── vn-server/
│   ├── css/
│   ├── extensions/
│   │   ├── camera-shake/
│   │   └── wait/
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
    │       ├── editor-sync/1.0.0/
    │       ├── inventory/1.0.0/
    │       └── multi-window/1.0.0/
    ├── public/
    ├── package.json
    └── server.js
```

Пользовательские плагины находятся в `plug-server/data/plugins` и устанавливаются из каталога. В `vn-server/extensions` остаются только встроенные расширения движка.

## Запуск

Сначала запустите каталог:

```bash
cd plug-server
npm start
```

По умолчанию: `http://127.0.0.1:8787`.

Затем запустите движок:

```bash
cd vn-server
node server.js
```

По умолчанию: `http://localhost:8080`.

## Каталог плагинов

Кнопка `⚙ Плагины` в приложении открывает три режима:

- **Каталог** — плагины из Plug Server, поиск, детали, установка и обновление;
- **Установленные** — включение, выключение, удаление и детали;
- **Локальная установка** — `.js` файл или произвольный URL для разработки.

Адрес каталога по умолчанию — `http://127.0.0.1:8787`. Его можно изменить прямо в окне менеджера. После изменения списка плагинов приложение перезапускается, чтобы новый код загрузился во все нужные контексты.

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
