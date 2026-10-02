# VN Plug Server

Отдельный сервер-каталог расширений VN Engine.

Запуск: `npm start` (по умолчанию `http://127.0.0.1:8787`).

Расширения хранятся в `data/plugins/<plugin-id>/<version>/`:
`manifest.json` + `extension.js`.

Каталог содержит `editor-sync`, `multi-window` и `inventory`, по версии `1.0.0`.

API: `GET /api/health`, `GET /api/plugins`, `GET /api/plugins/:id`, `GET /api/plugins/:id/:version`, `POST /api/plugins`, `GET /api/docs/sdk/:version`, `GET /api/docs/engine/:version`.

Файл расширения доступен по `entry`, например `/plugins/inventory/1.0.0/extension.js`.
