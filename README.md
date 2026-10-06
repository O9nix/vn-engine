# VN Engine

JavaScript-движок визуальной новеллы на ES Modules.

**Текущая версия: `0.1.0`**

Проект использует Semantic Versioning. История изменений находится в `docs/changelog.md`, а исторические snapshots API — в `docs/versions/`.

## Структура

- `core.js` — логика сценария и переходы между узлами.
- `events.js` — EventBus.
- `player.js` — визуальный корень и named layers.
- `block-manager.js` — управление визуальными Block.
- `plugin-manager.js` — установка плагинов и API.
- `plugins/` — игровые плагины.
- `main.js` — сборка движка и тестовый сценарий.
- `docs/` — документация и история версий.
- `index.html` — страница.
- `server.js` — Express-сервер.

## Запуск

```bash
npm install
npm start
```

Открыть `http://localhost:3002`.
