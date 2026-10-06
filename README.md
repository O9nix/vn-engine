# VN Server

Простой Node.js-сервис для VN Studio: хранение проектов, загрузка картинок, публикация игры по ссылке.

## Запуск

```bash
cd vn-server
node server.js
# или
npm start
```

Открой http://localhost:3000

Порт: `PORT=8080 node server.js`

## Возможности

| URL | Описание |
|-----|----------|
| `GET /` | Главная — список проектов |
| `GET /editor?id=` | Редактор проекта |
| `GET /studio` | Студия (плеер+редактор) |
| `GET /play/:id` | Игра проекта (JSON подставляется автоматически) |
| `GET /api/projects` | Список проектов |
| `POST /api/projects` | Создать/сохранить проект (JSON body) |
| `GET /api/projects/:id` | Получить проект |
| `PUT /api/projects/:id` | Обновить |
| `DELETE /api/projects/:id` | Удалить |
| `POST /api/assets` | Загрузить картинку |
| `GET /api/assets/:projectId` | Список файлов |
| `GET /assets/:projectId/:file` | Отдать картинку |

## Загрузка ассета

**multipart:**

```bash
curl -F "file=@yuki.png" -F "projectId=demo" http://localhost:3000/api/assets
```

**JSON (data URL из редактора):**

```bash
curl -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -d '{"projectId":"demo","name":"yuki.png","dataUrl":"data:image/png;base64,..."}'
```

Ответ:

```json
{ "ok": true, "url": "/assets/demo/xxxx.png", "projectId": "demo" }
```

В сценарии указывай `"src": "/assets/demo/xxxx.png"` — плеер и AssetCache грузят с того же origin.

## Сохранение проекта

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d @my-game.json
```

Ответ: `{ "id": "...", "url": "/play/..." }`

## Структура данных

```
vn-server/
  server.js
  public/                 # index.html, editor.html
  data/
    projects/
      <projectId>/
        project.json      # сценарий
        assets/           # картинки этого проекта
          photo.webp
```

Публичный URL картинки (как в JSON): `/assets/<projectId>/<file>`  
(файл лежит в `data/projects/<projectId>/assets/`).

При старте сервер один раз переносит старый формат
`data/projects/*.json` + `data/assets/<id>/` в новую схему.

Без внешних зависимостей — только Node.js ≥ 18.


## Auth (MariaDB) — phase 1

1. Copy `.env.example` → `.env` and set `DB_*`
2. Start DB: `docker compose up -d` (optional)
3. `npm install`
4. `npm run migrate`
5. `npm start`
6. Open `/register` and `/login`

Without `DB_HOST`, file-based projects still work; auth API returns 503.
