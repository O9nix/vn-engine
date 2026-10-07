# apiscribe

Генератор документации API из комментариев в стиле JSDoc/apiDoc.
Без зависимостей, Node.js ≥ 16.

- ищет в исходниках блоки с тегами `@api…`;
- собирает **один HTML-файл**: меню слева, описание эндпоинта справа, поиск, переключатель версий, история изменений;
- версия берётся из `version.md`; при смене версии в историю добавляется новая запись, **старые версии не удаляются и не меняются**;
- парсер не привязан к языку: поддерживаются JS/TS, Java, Kotlin, Go, C#, PHP, Rust, Python, Ruby и др. (см. `src/languages.js`).

## Быстрый старт

```bash
npx apiscribe init        # создаст version.md и apiscribe.config.json
npx apiscribe             # соберёт docs/api/index.html и docs/api/history.json
```

Пока пакет не опубликован: `npm link` в папке инструмента, затем `apiscribe` в вашем проекте
(или `npx /путь/к/apiscribe`).

Автосборка при старте приложения:

```json
{ "scripts": { "docs": "apiscribe", "prestart": "apiscribe" } }
```

Или прямо из кода сервера (Express/Connect): документация пересобирается при старте и отдаётся по адресу:

```js
const apiscribe = require('apiscribe');
app.use('/docs', apiscribe.middleware({ src: 'src' }));
```

## Версии и история

| Ситуация | Что происходит |
|---|---|
| версии из `version.md` нет в истории | добавляется новая запись, HTML пересобирается |
| версия совпадает с последней, API изменилось | запись последней версии обновляется |
| версия совпадает с последней, API то же | ничего не меняется |
| версия есть в истории, но не последняя | старая запись **не трогается**, выводится предупреждение |

`version.md` — любой файл, где есть `1.2.3` (допустимы `v1.2.3`, `1.2.3-beta.1`, заголовок `# 1.2.3`).

Файл истории (`docs/api/history.json`) — источник правды. **Коммитьте его в git**: если его потерять, потеряется и история.
В HTML для каждой версии показывается, что добавлено / изменено / удалено относительно предыдущей, у эндпоинтов — список версий, где они есть.

## Синтаксис: JSDoc-стиль (для библиотек и SDK)

Комментарий лежит прямо над кодом. Текст без тегов — это описание (markdown: `код`, **жирный**, списки,
блоки ```` ``` ````). Комментарий попадает в документацию, если в нём есть `@apiName`, `@apiGroup` или `@class`.

```js
/**
 * @class PluginManager
 * @apiGroup PluginManager
 * Устанавливает плагины и предоставляет единый Plugin API.
 */
export class PluginManager {

    /**
     * @apiName use
     * @apiGroup PluginManager
     * Устанавливает плагин. Плагин обязан иметь `name` и `install(api)`.
     * @param {Object} plugin
     * @param {string} plugin.name Уникальное имя
     * @returns {PluginManager} this (chainable)
     * @throws {TypeError} Если нет install
     * @example
     * plugins.use(DialoguePlugin).use(ChoicePlugin);
     */
    use(plugin) { /* ... */ }
}
```

**Как строится меню**

- `@apiGroup` — категория (раздел меню верхнего уровня).
- Точки в `@apiName` задают вложенность: `api.game` — это группа, `api.game.show` — её метод.
  Клик по группе открывает страницу со всеми методами группы подряд, клик по методу — страницу только этого метода.
- Если в `@apiName` нет точки, а комментарий лежит внутри `class X`, имя становится `X.имя` (`use` → `PluginManager.use`).
  Чтобы этого не было, добавьте `@global`.
- Порядок в меню такой же, как в исходниках.

**Теги**: `@class`, `@apiName`, `@apiGroup`, `@event имя`, `@function` (метод без параметров и без `@returns`),
`@param {Тип} имя описание` (`[имя=по умолчанию]`, вложенные `obj.поле`), `@returns {Тип} описание`,
`@throws {Тип} описание`, `@example`, `@type {Тип}`, `@property {Тип} имя описание`, `@since`, `@deprecated`.

Что не указано, берётся из кода: если нет `@apiName`, имя — из следующей строки (`use(plugin) {` → `use`),
если нет `@param`, имена параметров берутся из сигнатуры. Вид записи (`CLASS`, `METHOD`, `EVENT`, `PROP`, `NS` для группы)
определяется автоматически.

## Синтаксис: HTTP-стиль (apiDoc)

Работает так же и может смешиваться с JSDoc-стилем. Комментарий считается документацией, если в нём есть `@api`.

```js
/**
 * @api {GET} /users/:id Получить пользователя
 * @apiGroup Users
 * @apiDescription Описание. Поддерживаются `код` и списки через "- ".
 * @apiPermission user
 * @apiSince 1.0.0
 * @apiDeprecated Используйте /v2/users
 * @apiHeader {String} Authorization Bearer-токен
 * @apiPath   {Number} id Идентификатор
 * @apiQuery  {Number} [limit=20] Сколько вернуть
 * @apiBody   {String} name Имя
 * @apiParam  {String} x Обычный параметр
 * @apiSuccess (200) {String} name Имя
 * @apiError   (404) UserNotFound Не найден
 * @apiExample        {curl} Запрос
 *   curl http://localhost/users/1
 * @apiSuccessExample {json} Ответ
 *   { "name": "Анна" }
 * @apiErrorExample   {json} Ошибка
 *   { "error": "UserNotFound" }
 */
```

Поле: `{Тип} имя описание`. `[имя]` — необязательное, `[имя=значение]` — со значением по умолчанию.

Повторяющиеся куски выносятся в общие блоки:

```js
/**
 * @apiDefine Auth
 * @apiHeader {String} Authorization Bearer-токен
 * @apiError (401) Unauthorized Нет доступа
 */
/** @api {GET} /me Профиль
 *  @apiUse Auth */
```

Python — в docstring, Ruby/Go/Rust — в строчных комментариях (`#`, `//`, `///`), см. `example/src`.

## Библиотеки и SDK (не HTTP)

В `{…}` после `@api` можно писать любой «вид» записи, он станет цветным бейджем:
`METHOD`, `EVENT`, `TYPE`, `PROP` (прочие виды тоже работают, будут серыми).
Идентификатор записи пишется без пробелов, а сигнатура идёт заголовком:

```js
/**
 * @api {METHOD} VN.registerNodeType registerNodeType(type, handler)
 * @apiGroup Core (VN)
 * @apiParam {string} type Тип узла
 * @apiReturns {EventBus} Что возвращает метод
 * @apiThrows {TypeError} Когда бросает исключение
 */
```

`@apiReturns {Тип} описание` и `@apiThrows {Тип} описание` показываются отдельными секциями.
`versionFile` может указывать на `package.json` — тогда берётся поле `version`.

## Настройки

`apiscribe.config.json` (или поле `"apiscribe"` в `package.json`, или флаги CLI — приоритет растёт слева направо):

```json
{
  "src": "src",
  "out": "docs/api",
  "versionFile": "version.md",
  "historyFile": "docs/api/history.json",
  "title": "My API",
  "lang": "ru",
  "exclude": ["tests", "src/generated"],
  "languages": { ".lua": { "line": ["--"] } }
}
```

Флаги: `--src --out --version-file --history --title --lang --exclude a,b --config --force -q`.

## Другие языки

Инструмент разделён на три слоя, и язык влияет только на первый:

1. **Извлечение комментариев** (`languages.js`, `parser.js`) — единственная часть, знающая синтаксис языка. Новый язык = одна строка в таблице, если комментарии обычные (`//`, `#`, `/** */`, `"""`).
2. **История** (`history.json`) — нейтральный JSON (`schema: 1`): `versions[] → { version, date, endpoints[] }`.
3. **HTML** (`template.html`, `client.js`) — читает только этот JSON.

Поэтому порт на Go/Python/Java сводится к тому, чтобы собрать такой же `history.json`; готовый рендерер переиспользуется как есть.

## Идеи на потом

- режим `--watch`;
- экспорт в OpenAPI;
- команда `apiscribe render` — пересборка HTML только из `history.json`.
