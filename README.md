# VN Engine

Текущая версия учебного движка визуальной новеллы.

## Структура

- `core.js` — логика сценария и переходы между узлами.
- `events.js` — EventBus.
- `player.js` — визуальный корень и старые named layers.
- `block-manager.js` — управление визуальными Block.
- `plugin-manager.js` — установка плагинов и API.
- `plugins/` — Dialogue, Narration, Background и Wait.
- `main.js` — сборка движка и тестовый сценарий.
- `index.html` — страница.
- `server.js` — Express-сервер.

## Запуск

```bash
npm install
npm start
```

Открыть `http://localhost:3002`.
