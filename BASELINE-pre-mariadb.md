# Отправная точка (до MariaDB / auth)

Документ зафиксирован как точка отката. Если миграция на БД/аккаунты пойдёт неудачно — возвращаемся к **файловому** режиму ниже и к согласованному плану заново.

Дата ориентира: 2026-09-28

## Текущий стек (работает сейчас)

- **Сервер:** один Node.js процесс (`server.js`), static + API
- **Проекты:** `data/projects/<id>/project.json` + `data/projects/<id>/assets/`
- **Публикация:** поле `published` в JSON; `/play/:id` только если не `published === false`
- **Редактор:** `public/editor.html` — Save (черновик), Publish, превью без публикации
- **Плеер:** `public/index.html`
- **Главная:** `public/home.html`
- **Пользователи:** нет
- **БД:** нет

Ключевые команды:

```bash
cd vn-server && node server.js
```

## Согласованный целевой план (ещё не внедрён)

### Зачем MariaDB
- авторство проектов (сейчас 1 author на проект; команды — позже)
- регистрация / вход
- права: черновик только автору; play чужим только published
- поиск, лента, лимиты ассетов
- бэкапы и нормальные запросы

### Медиа
- не BLOB в БД
- файлы на диске; в БД метаданные + `storage_key`
- `STORAGE_DRIVER=local` | `s3` (S3 выключен по флагу, путь к переезду заложен)

### Сценарий
- **не** JSON-колонка целиком как основное хранилище
- файл на диске (local/S3), в БД только **`scenario_key`** (+ meta: title, published, owner_id, updated_at)
- в scenario JSON — только URL ассетов, без base64

### Auth и доступ
- cookie session
- гость: только играть published
- создавать/редактировать: только зарегистрированные; правит только owner (v1)

### URL
- короткий **id** проекта: `/play/:id`
- поддомены 3-го уровня — позже, тот же monolith

### Архитектура сервера
- **v1: один сервер** (API + static)
- поддомены потом через Host на том же app

### Минимальные таблицы (план)
- `users` — email, password_hash, display_name
- `sessions` — cookie session store
- `projects` — id, owner_id, title, published, scenario_key, timestamps
- `assets` — project_id, type, name, folder, storage_key, mime, size

### Порядок внедрения (план)
1. MariaDB + users + sessions + login/register UI
2. projects в БД + scenario файл + migrate из data/projects
3. auth на save/publish; play gate
4. assets meta в БД + STORAGE_DRIVER
5. главная: лента public + «мои»
6. позже: wildcard-поддомены, S3, команды

## Откат

Откат = этот файловый `server.js` + `public/*` + `data/projects` без зависимости от MariaDB.
Не удалять `data/` при экспериментах с БД; миграция — копирование, не destructive move без бэкапа.
