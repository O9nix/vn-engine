# VN Engine API

**Версия 0.1.4** · Дата 2026-10-14 · 86 записей

<!-- Файл создан автоматически: apiscribe 0.4.0. Вручную не редактируйте. -->

## Содержание

- **AST**
  - [AST](#ast)
    - [AST.constructor(parameters)](#ast-constructor)
    - [AST.addCommand(pattern, nodeType, handler)](#ast-addcommand)
    - [AST.removeCommand(pattern)](#ast-removecommand)
    - [AST.getCommands()](#ast-getcommands)
    - [AST.parse(source)](#ast-parse)
- **BlockManager**
  - [BlockManager](#blockmanager)
    - [BlockManager.create(type, options)](#blockmanager-create)
- **VN**
  - [VN.unregisterNodeType(type)](#vn-unregisternodetype)
- **EventBus**
  - [EventBus](#eventbus)
    - [EventBus.on(type, handler)](#eventbus-on)
    - [EventBus.off(type, handler)](#eventbus-off)
    - [EventBus.emit(type, payload)](#eventbus-emit)
- **PluginRegistry**
  - [localPluginLoader(name)](#localpluginloader)
  - [PluginRegistry](#pluginregistry)
    - [PluginRegistry.constructor(options)](#pluginregistry-constructor)
    - [PluginRegistry.register(plugin)](#pluginregistry-register)
    - [PluginRegistry.resolve(name, version)](#pluginregistry-resolve)
    - [PluginRegistry.has(name)](#pluginregistry-has)
    - [PluginRegistry.list()](#pluginregistry-list)
- **Logger**
  - [Logger](#logger)
    - [Logger.constructor(options, shared)](#logger-constructor)
    - [Logger.setLevel(level)](#logger-setlevel)
    - [Logger.getLevel()](#logger-getlevel)
    - [Logger.child(prefix)](#logger-child)
    - [Logger.debug(args)](#logger-debug)
    - [Logger.info(args)](#logger-info)
    - [Logger.warn(args)](#logger-warn)
    - [Logger.error(args)](#logger-error)
- **PluginLoader**
  - [normalizePluginRefs(refs)](#normalizepluginrefs)
  - [orderPlugins(plugins)](#orderplugins)
  - [loadProjectPlugins(project, registry, manager)](#loadprojectplugins)
- **PluginManager**
  - [PluginManager](#pluginmanager)
    - [PluginManager.constructor(bus, game, player, blocks, ast)](#pluginmanager-constructor)
    - [PluginManager.use(plugin)](#pluginmanager-use)
    - [PluginManager.remove(name)](#pluginmanager-remove)
    - [PluginManager.has(name)](#pluginmanager-has)
    - [PluginManager.get(name)](#pluginmanager-get)
    - [PluginManager.list()](#pluginmanager-list)
- **PluginAPI**
  - [api.plugin](#api-plugin)
  - [api.log](#api-log)
    - [api.log.debug(args)](#api-log-debug)
    - [api.log.info(args)](#api-log-info)
    - [api.log.warn(args)](#api-log-warn)
    - [api.log.error(args)](#api-log-error)
  - [api.events](#api-events)
    - [api.events.on(event, handler)](#api-events-on)
    - [api.events.emit(event, payload)](#api-events-emit)
  - [api.game](#api-game)
    - [api.game.getPluginLayer()](#api-game-getpluginlayer)
    - [api.game.registerLayer(name, element)](#api-game-registerlayer)
    - [api.game.registerNodeType(type, handler)](#api-game-registernodetype)
    - [api.game.show(name)](#api-game-show)
    - [api.game.hide(name)](#api-game-hide)
    - [api.game.isVisible(name)](#api-game-isvisible)
  - [api.player](#api-player)
    - [api.player.getPluginLayer()](#api-player-getpluginlayer)
    - [api.player.registerLayer(name, element)](#api-player-registerlayer)
    - [api.player.show(name)](#api-player-show)
    - [api.player.hide(name)](#api-player-hide)
    - [api.player.isVisible(name)](#api-player-isvisible)
  - [api.blocks](#api-blocks)
  - [api.ast](#api-ast)
    - [api.ast.addCommand(pattern, nodeType, handler)](#api-ast-addcommand)
  - [api.plugins](#api-plugins)
- **Plugins**
  - [ChoicePlugin](#choiceplugin)
  - [ConditionsPlugin](#conditionsplugin)
  - [NotyPlugin](#notyplugin)
  - [StatePlugin](#stateplugin)
  - [TopLeftHUDPlugin](#toplefthudplugin)
- **ConditionsPlugin**
  - [ConditionsPlugin.evaluate(condition, state)](#conditionsplugin-evaluate)
- **StatePlugin**
  - [StatePlugin.get()](#stateplugin-get)
  - [StatePlugin.getValue(name)](#stateplugin-getvalue)
  - [StatePlugin.set(name, value)](#stateplugin-set)
  - [StatePlugin.update(values)](#stateplugin-update)
  - [StatePlugin.storyLoaded](#stateplugin-storyloaded)
- **TopLeftHUDPlugin**
  - [TopLeftHUDPlugin.set(key, value)](#toplefthudplugin-set)
  - [TopLeftHUDPlugin.setTitle(title)](#toplefthudplugin-settitle)
  - [TopLeftHUDPlugin.update(values)](#toplefthudplugin-update)
  - [TopLeftHUDPlugin.show()](#toplefthudplugin-show)
  - [TopLeftHUDPlugin.hide()](#toplefthudplugin-hide)
- **Project**
  - [Project](#project)
    - [Project.getPlugins()](#project-getplugins)
- **ProjectValidator**
  - [ProjectValidator](#projectvalidator)
    - [ProjectValidator.constructor(project)](#projectvalidator-constructor)
    - [ProjectValidator.validateGotos()](#projectvalidator-validategotos)
- [История изменений](#changelog)

## AST

<a id="ast"></a>

### `AST`

*Класс*

Парсер текста сценария в структуру сцен и узлов.

Сам парсер умеет только делить текст на сцены (строка `# Название`).
Остальные строки распознают команды, которые регистрируют плагины
через `api.ast.addCommand`. Строка, которую не узнала ни одна команда,
становится узлом `text`.

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`AST.constructor(parameters)`](#ast-constructor) | Создаёт парсер без команд. |
| [`AST.addCommand(pattern, nodeType, handler)`](#ast-addcommand) | Регистрирует команду для парсера. |
| [`AST.removeCommand(pattern)`](#ast-removecommand) | Снимает команду парсера. |
| [`AST.getCommands()`](#ast-getcommands) | Возвращает зарегистрированные команды в порядке добавления. Парсер перебирает их в цикле. |
| [`AST.parse(source)`](#ast-parse) | Разбирает текст сценария. |

<sub>Исходник: AST.js:1</sub>

<a id="ast-constructor"></a>

#### `AST.constructor(parameters)`

*Метод*

Создаёт парсер без команд.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `parameters` *(необязательное)* | `Object` | Настройки парсера (пока не используются). |

<sub>Исходник: AST.js:20</sub>

<a id="ast-addcommand"></a>

#### `AST.addCommand(pattern, nodeType, handler)`

*Метод*

Регистрирует команду для парсера.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `pattern` *(обязательное)* | `RegExp` | Регулярное выражение для поиска строки. |
| `nodeType` *(обязательное)* | `string` | Тип узла, который создаст команда (например, dialogue). |
| `handler` *(обязательное)* | `function` | Функция (match, line, index, scene), которая превращает совпавшую строку в узел или возвращает null, если строка не подошла. |

##### Возвращает

`function` — Функция, снимающая команду.

##### Исключения

- `Error` — Если pattern не RegExp, handler не функция или команда с таким же регулярным выражением уже есть.

##### Примеры

```js
parser.addCommand(/^\[([^\]]+)\]\s*(.*)$/, 'dialogue', (match, line, index) => ({
    type: 'dialogue',
    character: match[1],
    text: match[2].trim()
}));
```

<sub>Исходник: AST.js:30</sub>

<a id="ast-removecommand"></a>

#### `AST.removeCommand(pattern)`

*Метод*

Снимает команду парсера.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `pattern` *(обязательное)* | `RegExp` | Регулярное выражение, с которым команда была добавлена. |

##### Возвращает

`boolean` — true, если команда была зарегистрирована.

<sub>Исходник: AST.js:72</sub>

<a id="ast-getcommands"></a>

#### `AST.getCommands()`

*Метод*

Возвращает зарегистрированные команды в порядке добавления.
Парсер перебирает их в цикле.

##### Возвращает

`Object[]` — Массив объектов { pattern, nodeType, handler }.

<sub>Исходник: AST.js:85</sub>

<a id="ast-parse"></a>

#### `AST.parse(source)`

*Метод*

Разбирает текст сценария.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `source` *(обязательное)* | `string` | Текст сценария. |

##### Возвращает

`Object` — Объект { scenes }: массив сцен { id, name, nodes }.

##### Примеры

```js
const result = parser.parse('# Сцена\n[Анна] Привет');
// result.scenes[0].nodes[0].type === 'dialogue'
```

<sub>Исходник: AST.js:98</sub>

## BlockManager

<a id="blockmanager"></a>

### `BlockManager`

*Класс*

Хранит визуальные блоки (диалог, выбор и т.п.) и размещает их в корневом элементе.

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`BlockManager.create(type, options)`](#blockmanager-create) | Создаёт блок и добавляет его элемент в корень. |

<sub>Исходник: block-manager.js:5</sub>

<a id="blockmanager-create"></a>

#### `BlockManager.create(type, options)`

*Метод*

Создаёт блок и добавляет его элемент в корень.

Опции: `channel` (строка, по умолчанию default), `element` (HTMLElement),
`data`, `meta` и `replace` (true — сначала удалить все блоки этого канала,
чтобы старые не накапливались).

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Тип блока. |
| `options` *(необязательное)* | `Object` | Параметры блока. |

##### Возвращает

`Object` — Созданный блок.

<sub>Исходник: block-manager.js:26</sub>

## VN

<a id="vn-unregisternodetype"></a>

### `VN.unregisterNodeType(type)`

*Метод*

Снимает обработчик типа узла. Нужен, чтобы плагин можно было
удалить и поставить заново.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя типа узла. |

#### Возвращает

`boolean` — true, если тип был зарегистрирован.

<sub>Исходник: core.js:48</sub>

## EventBus

<a id="eventbus"></a>

### `EventBus`

*Класс*

Шина событий. Ошибка в одном подписчике не мешает остальным:
она попадает в консоль и в событие `handler:error`
с данными `{ event, error }`.

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`EventBus.on(type, handler)`](#eventbus-on) | Подписывает обработчик на событие. |
| [`EventBus.off(type, handler)`](#eventbus-off) | Снимает обработчик с события. |
| [`EventBus.emit(type, payload)`](#eventbus-emit) | Вызывает всех подписчиков события по порядку подписки. |

<sub>Исходник: events.js:5</sub>

<a id="eventbus-on"></a>

#### `EventBus.on(type, handler)`

*Метод*

Подписывает обработчик на событие.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя события. |
| `handler` *(обязательное)* | `function` | Обработчик. |

##### Возвращает

`function` — Функция отписки.

<sub>Исходник: events.js:16</sub>

<a id="eventbus-off"></a>

#### `EventBus.off(type, handler)`

*Метод*

Снимает обработчик с события.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя события. |
| `handler` *(обязательное)* | `function` | Ранее добавленный обработчик. |

<sub>Исходник: events.js:36</sub>

<a id="eventbus-emit"></a>

#### `EventBus.emit(type, payload)`

*Метод*

Вызывает всех подписчиков события по порядку подписки.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя события. |
| `payload` *(необязательное)* | `*` | Данные события. |

<sub>Исходник: events.js:49</sub>

## PluginRegistry

<a id="localpluginloader"></a>

### `localPluginLoader(name)`

*Метод*

Загрузчик плагинов из папки `plugins/` рядом с движком.

Плагин `choice` ищется в файле `plugins/choice-plugin.js` и должен
экспортировать объект плагина через `export default`. Имя плагина
проверяет `PluginRegistry` до вызова загрузчика, поэтому в путь
попадают только безопасные имена.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина. |

#### Возвращает

`Promise` — Промис с объектом плагина.

#### Исключения

- `Error` — Если файла нет или модуль не экспортирует плагин через `export default`.

#### Примеры

```js
const registry = new PluginRegistry({ loader: localPluginLoader });
```

<sub>Исходник: local-plugin-loader.js:1</sub>

<a id="pluginregistry"></a>

### `PluginRegistry`

*Класс*

Каталог доступных плагинов: по имени отдаёт объект плагина.

Плагин можно добавить вручную (`register()`) или дать каталогу
загрузчик (`loader`), который получает плагин по имени. Интерфейс
`resolve()` асинхронный, поэтому загрузчик может быть как
локальным, так и обращаться к внешнему сервису: остальной код
движка об этом не знает.

Имя плагина должно состоять из строчных латинских букв, цифр
и дефисов (`choice`, `top-left-hud`). Это проверяется до вызова
загрузчика, потому что имя приходит из данных проекта.

Минимальный манифест плагина:
```
{
    name: 'choice',                        // обязательно, уникальное имя
    version: '0.1.0',                      // версия плагина
    dependencies: ['state', 'conditions'], // имена нужных плагинов
    nodeTypes: ['choice'],                 // типы узлов, которые даёт плагин
    install(api) { ... }                   // обязательно
}
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`PluginRegistry.constructor(options)`](#pluginregistry-constructor) | Создаёт каталог. |
| [`PluginRegistry.register(plugin)`](#pluginregistry-register) | Добавляет плагин в каталог вручную. |
| [`PluginRegistry.resolve(name, version)`](#pluginregistry-resolve) | Возвращает плагин по имени. Если плагина нет среди добавленных вручную или уже загруженных, вызывает загрузчик. |
| [`PluginRegistry.has(name)`](#pluginregistry-has) |  |
| [`PluginRegistry.list()`](#pluginregistry-list) |  |

<sub>Исходник: plugin-registry.js:3</sub>

<a id="pluginregistry-constructor"></a>

#### `PluginRegistry.constructor(options)`

*Метод*

Создаёт каталог.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `options` *(необязательное)* | `Object` | Параметры каталога. |
| `options.loader` *(необязательное)* | `function` | Загрузчик `(name) => Promise`: по имени плагина возвращает промис с его объектом. Вызывается, только если плагина нет среди добавленных вручную или уже загруженных. Результат запоминается. |

##### Примеры

```js
const registry = new PluginRegistry({ loader: localPluginLoader });
```

<sub>Исходник: plugin-registry.js:35</sub>

<a id="pluginregistry-register"></a>

#### `PluginRegistry.register(plugin)`

*Метод*

Добавляет плагин в каталог вручную.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `plugin` *(обязательное)* | `Object` | Плагин с полями `name` и `install`. |

##### Возвращает

`PluginRegistry` — Текущий каталог (для цепочки вызовов).

##### Исключения

- `Error` — Если у плагина нет имени или метода `install`, либо плагин с таким именем уже есть.

##### Примеры

```js
const registry = new PluginRegistry();
registry.register(StatePlugin).register(ChoicePlugin);
```

<sub>Исходник: plugin-registry.js:61</sub>

<a id="pluginregistry-resolve"></a>

#### `PluginRegistry.resolve(name, version)`

*Метод*

Возвращает плагин по имени. Если плагина нет среди добавленных
вручную или уже загруженных, вызывает загрузчик.

Версия сейчас сравнивается только на точное совпадение
(диапазоны вроде `^1.0` пока не поддерживаются).

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина. |
| `version` *(необязательное)* | `string` | Требуемая версия. Если не указана, подойдёт любая. |

##### Возвращает

`Promise` — Промис с объектом плагина.

##### Исключения

- `Error` — Если имя недопустимо, плагин не найден или не загрузился, имя загруженного плагина не совпадает с запрошенным либо версия не совпадает с требуемой.

##### Примеры

```js
const plugin = await registry.resolve('choice');
```

<sub>Исходник: plugin-registry.js:104</sub>

<a id="pluginregistry-has"></a>

#### `PluginRegistry.has(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`boolean` — Есть ли плагин среди добавленных или
уже загруженных

<sub>Исходник: plugin-registry.js:203</sub>

<a id="pluginregistry-list"></a>

#### `PluginRegistry.list()`

*Метод*

##### Возвращает

`string[]` — Имена добавленных и уже загруженных плагинов

<sub>Исходник: plugin-registry.js:214</sub>

## Logger

<a id="logger"></a>

### `Logger`

*Класс*

Журнал с уровнями и префиксом. Все журналы, созданные через `child`,
делят один уровень с исходным, поэтому его можно менять в одном месте.

Сообщения выводятся в консоль в виде `[префикс] сообщение`.

#### Примеры

```js
import { logger } from './logger.js';

const log = logger.child('VN');
log.warn('Узел не найден');
logger.setLevel('debug');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`Logger.constructor(options, shared)`](#logger-constructor) | Создаёт журнал. |
| [`Logger.setLevel(level)`](#logger-setlevel) | Меняет уровень для этого журнала и всех его дочерних. |
| [`Logger.getLevel()`](#logger-getlevel) |  |
| [`Logger.child(prefix)`](#logger-child) | Создаёт журнал с другим префиксом и общим уровнем. |
| [`Logger.debug(args)`](#logger-debug) | Подробное сообщение для отладки (по умолчанию скрыто). |
| [`Logger.info(args)`](#logger-info) | Обычное сообщение о ходе работы. |
| [`Logger.warn(args)`](#logger-warn) | Предупреждение: работа продолжается. |
| [`Logger.error(args)`](#logger-error) | Ошибка. |

<sub>Исходник: logger.js:13</sub>

<a id="logger-constructor"></a>

#### `Logger.constructor(options, shared)`

*Метод*

Создаёт журнал.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `options` *(необязательное)* | `Object` | Параметры: `level` (по умолчанию info) и `prefix`. |
| `shared` *(необязательное)* | `Object` | Общее состояние уровня (используется методом child). |

<sub>Исходник: logger.js:33</sub>

<a id="logger-setlevel"></a>

#### `Logger.setLevel(level)`

*Метод*

Меняет уровень для этого журнала и всех его дочерних.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `level` *(обязательное)* | `string` | Один из уровней: debug, info, warn, error, silent. |

##### Исключения

- `Error` — Если уровень неизвестен.

<sub>Исходник: logger.js:51</sub>

<a id="logger-getlevel"></a>

#### `Logger.getLevel()`

*Метод*

##### Возвращает

`string` — Текущий уровень.

<sub>Исходник: logger.js:66</sub>

<a id="logger-child"></a>

#### `Logger.child(prefix)`

*Метод*

Создаёт журнал с другим префиксом и общим уровнем.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `prefix` *(обязательное)* | `string` | Префикс сообщений, например имя класса или плагина. |

##### Возвращает

`Logger`

<sub>Исходник: logger.js:75</sub>

<a id="logger-debug"></a>

#### `Logger.debug(args)`

*Метод*

Подробное сообщение для отладки (по умолчанию скрыто).

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

<sub>Исходник: logger.js:96</sub>

<a id="logger-info"></a>

#### `Logger.info(args)`

*Метод*

Обычное сообщение о ходе работы.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

<sub>Исходник: logger.js:106</sub>

<a id="logger-warn"></a>

#### `Logger.warn(args)`

*Метод*

Предупреждение: работа продолжается.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

<sub>Исходник: logger.js:116</sub>

<a id="logger-error"></a>

#### `Logger.error(args)`

*Метод*

Ошибка.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

<sub>Исходник: logger.js:126</sub>

## PluginLoader

<a id="normalizepluginrefs"></a>

### `normalizePluginRefs(refs)`

*Метод*

Приводит список плагинов проекта к единому виду.
Элемент списка может быть строкой (имя) или объектом
`{ name, version }`.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `refs` *(необязательное)* | `Array` | Список плагинов из `project.getPlugins()`. Каждый элемент — строка или объект `{ name, version }`. |

#### Возвращает

`Object[]` — Нормализованный список объектов
`{ name, version }` в порядке объявления.

#### Исключения

- `Error` — Если элемент некорректен или плагин объявлен дважды.

#### Примеры

```js
normalizePluginRefs(['state', { name: 'choice', version: '0.1.0' }]);
// [{ name: 'state', version: undefined },
//  { name: 'choice', version: '0.1.0' }]
```

<sub>Исходник: plugin-loader.js:1</sub>

<a id="orderplugins"></a>

### `orderPlugins(plugins)`

*Метод*

Сортирует плагины так, чтобы каждый шёл после своих зависимостей.
Среди независимых плагинов сохраняется порядок объявления.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `plugins` *(обязательное)* | `Object[]` | Плагины в порядке объявления в проекте. |

#### Возвращает

`Object[]` — Плагины в порядке установки.

#### Исключения

- `Error` — Если зависимость не объявлена в проекте или зависимости образуют цикл.

#### Примеры

```js
const ordered = orderPlugins([ChoicePlugin, StatePlugin, ConditionsPlugin]);
// state, conditions, choice
```

<sub>Исходник: plugin-loader.js:66</sub>

<a id="loadprojectplugins"></a>

### `loadProjectPlugins(project, registry, manager)`

*Метод*

Устанавливает плагины, объявленные в проекте.

Получает плагины из каталога по именам из `project.getPlugins()`,
сортирует их по зависимостям и устанавливает через `PluginManager`.

Сбой одного плагина не отменяет остальные: плагин, который не удалось
получить или установить, попадает в `failed`, а плагины, которые от него
зависят, пропускаются (тоже попадают в `failed`). Остальные плагины
остаются установленными. Решение, запускать ли историю при наличии
сбоев, принимает вызывающий код.

Вызывать нужно до `game.loadProject(project)`, чтобы плагины
успели подписаться на `story:loaded`.

Ошибки в самом описании проекта (некорректный список плагинов,
зависимость, не объявленная в проекте, цикл) пробрасываются исключением:
с таким проектом работать нельзя.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `project` *(обязательное)* | `Project` | Проект с объявленными плагинами. |
| `registry` *(обязательное)* | `PluginRegistry` | Каталог доступных плагинов. |
| `manager` *(обязательное)* | `PluginManager` | Менеджер, устанавливающий плагины. |

#### Возвращает

`Promise` — Промис с отчётом `{ installed, failed }`:
`installed` — имена установленных плагинов в порядке установки,
`failed` — массив объектов `{ name, stage, message, error }`,
где `stage` — `load`, `install` или `dependency`.

#### Исключения

- `Error` — Если описание плагинов в проекте некорректно.

#### Примеры

```js
const report = await loadProjectPlugins(project, registry, plugins);
if (report.failed.length === 0) {
    game.loadProject(project);
}
```

<sub>Исходник: plugin-loader.js:143</sub>

## PluginManager

<a id="pluginmanager"></a>

### `PluginManager`

*Класс*

Устанавливает плагины и выдаёт каждому из них собственный Plugin API
(`plugin`, `log`, `events`, `game`, `player`, `blocks`, `ast`, `plugins`).

Всё, что плагин занял через свой `api` (подписки на события, слои,
типы узлов, блоки, команды парсера), движок снимает сам при удалении
плагина или при сбое его установки.

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`PluginManager.constructor(bus, game, player, blocks, ast)`](#pluginmanager-constructor) | Запоминает зависимости движка. Для каждого плагина при установке создаётся собственный `api`, который передаётся в `install(api)`. |
| [`PluginManager.use(plugin)`](#pluginmanager-use) | Устанавливает плагин после проверки его зависимостей. |
| [`PluginManager.remove(name)`](#pluginmanager-remove) | Удаляет установленный плагин, если от него не зависят другие установленные плагины. |
| [`PluginManager.has(name)`](#pluginmanager-has) |  |
| [`PluginManager.get(name)`](#pluginmanager-get) |  |
| [`PluginManager.list()`](#pluginmanager-list) |  |

<sub>Исходник: plugin-manager.js:11</sub>

<a id="pluginmanager-constructor"></a>

#### `PluginManager.constructor(bus, game, player, blocks, ast)`

*Метод*

Запоминает зависимости движка. Для каждого плагина при установке
создаётся собственный `api`, который передаётся в `install(api)`.

Структура api:
```
api
├── plugin
│   └── name                → имя этого плагина
├── log
│   ├── info(...args)
│   ├── warn(...args)
│   └── error(...args)
├── events
│   ├── on(event, handler) → unsubscribe
│   └── emit(event, payload)
├── game
│   ├── getPluginLayer() → HTMLElement
│   ├── registerLayer(name, element) → cleanup
│   ├── registerNodeType(type, handler)
│   ├── show(name)
│   ├── hide(name)
│   └── isVisible(name) → boolean
├── player
│   ├── getPluginLayer() → HTMLElement
│   ├── registerLayer(name, element) → cleanup
│   ├── show(name)
│   ├── hide(name)
│   └── isVisible(name) → boolean
├── blocks                  → BlockManager
├── ast
│   └── addCommand(pattern, nodeType, handler)
└── plugins                 → Proxy
    └── <name>.api          → публичный API плагина
```

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `bus` *(обязательное)* | `EventBus` | Шина событий. |
| `game` *(обязательное)* | `VN` | Ядро: выполняет узлы истории. |
| `player` *(обязательное)* | `Player` | Плеер со слоями страницы. |
| `blocks` *(обязательное)* | `BlockManager` | Менеджер визуальных блоков. |
| `ast` *(необязательное)* | `AST` | Парсер сценария. Без него `api.ast.addCommand` выбрасывает ошибку. |

<sub>Исходник: plugin-manager.js:30</sub>

<a id="pluginmanager-use"></a>

#### `PluginManager.use(plugin)`

*Метод*

Устанавливает плагин после проверки его зависимостей.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `plugin` *(обязательное)* | `Object` | Устанавливаемый плагин. |

##### Возвращает

`PluginManager` — Текущий экземпляр менеджера.

##### Исключения

- `Error` — Если плагин некорректен, уже установлен или его зависимости отсутствуют.

##### Примеры

```js
plugins.use(ConditionsPlugin);
plugins.use(ChoicePlugin);
```

<sub>Исходник: plugin-manager.js:437</sub>

<a id="pluginmanager-remove"></a>

#### `PluginManager.remove(name)`

*Метод*

Удаляет установленный плагин, если от него
не зависят другие установленные плагины.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя удаляемого плагина. |

##### Возвращает

`boolean` — true, если плагин удалён,
или false, если он не был установлен.

##### Исключения

- `Error` — Если от плагина зависят другие установленные плагины.

##### Примеры

```js
plugins.remove('choice');
```

<sub>Исходник: plugin-manager.js:556</sub>

<a id="pluginmanager-has"></a>

#### `PluginManager.has(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:622</sub>

<a id="pluginmanager-get"></a>

#### `PluginManager.get(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`Object|undefined` — Исходный объект плагина

<sub>Исходник: plugin-manager.js:632</sub>

<a id="pluginmanager-list"></a>

#### `PluginManager.list()`

*Метод*

##### Возвращает

`string[]` — Имена установленных плагинов

<sub>Исходник: plugin-manager.js:642</sub>

## PluginAPI

<a id="api-plugin"></a>

### `api.plugin`

*Свойство*

Сведения о самом плагине.

#### Свойства

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` | `string` | Имя плагина из манифеста. |

<sub>Исходник: plugin-manager.js:171</sub>

<a id="api-log"></a>

### `api.log`

*Группа*

Сообщения в консоль с именем плагина: `[имя] сообщение`.
Методы: debug, info, warn, error. Уровень общий для движка (logger.setLevel).

#### Примеры

```js
api.log.info('Плагин установлен');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.log.debug(args)`](#api-log-debug) | Подробное сообщение для отладки (по умолчанию скрыто). |
| [`api.log.info(args)`](#api-log-info) |  |
| [`api.log.warn(args)`](#api-log-warn) |  |
| [`api.log.error(args)`](#api-log-error) |  |

<sub>Исходник: plugin-manager.js:179</sub>

<a id="api-log-debug"></a>

#### `api.log.debug(args)`

*Метод*

Подробное сообщение для отладки (по умолчанию скрыто).

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

<sub>Исходник: plugin-manager.js:188</sub>

<a id="api-log-info"></a>

#### `api.log.info(args)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

<sub>Исходник: plugin-manager.js:196</sub>

<a id="api-log-warn"></a>

#### `api.log.warn(args)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

<sub>Исходник: plugin-manager.js:203</sub>

<a id="api-log-error"></a>

#### `api.log.error(args)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

<sub>Исходник: plugin-manager.js:210</sub>

<a id="api-events"></a>

### `api.events`

*Группа*

Обёртка над EventBus. Подписки плагина снимаются автоматически
при его удалении.

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.events.on(event, handler)`](#api-events-on) | Подписка на событие. |
| [`api.events.emit(event, payload)`](#api-events-emit) | Эмит события. |

<sub>Исходник: plugin-manager.js:218</sub>

<a id="api-events-on"></a>

#### `api.events.on(event, handler)`

*Метод*

Подписка на событие.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `event` *(обязательное)* | `string` | Имя события. |
| `handler` *(обязательное)* | `function` | Обработчик. |

##### Возвращает

`function` — Функция отписки.

##### Примеры

```js
api.events.on('story:loaded', (data) => {
    api.log.info('Проект загружен', data.project);
});
```

<sub>Исходник: plugin-manager.js:225</sub>

<a id="api-events-emit"></a>

#### `api.events.emit(event, payload)`

*Метод*

Эмит события.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `event` *(обязательное)* | `string` | Имя события. |
| `payload` *(необязательное)* | `*` | Данные события. |

<sub>Исходник: plugin-manager.js:245</sub>

<a id="api-game"></a>

### `api.game`

*Группа*

Фасад к VN и Player: регистрация типов узлов и работа со слоями.
Типы узлов и слои плагина снимаются автоматически.

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.game.getPluginLayer()`](#api-game-getpluginlayer) |  |
| [`api.game.registerLayer(name, element)`](#api-game-registerlayer) |  |
| [`api.game.registerNodeType(type, handler)`](#api-game-registernodetype) | Регистрирует обработчик типа узла сценария. context: { wait(options), resume(), goto(nodeId) }. `wait({ lock: true })` — ожидание, которо... |
| [`api.game.show(name)`](#api-game-show) |  |
| [`api.game.hide(name)`](#api-game-hide) |  |
| [`api.game.isVisible(name)`](#api-game-isvisible) |  |

<sub>Исходник: plugin-manager.js:255</sub>

<a id="api-game-getpluginlayer"></a>

#### `api.game.getPluginLayer()`

*Метод*

##### Возвращает

`HTMLElement` — DOM-слой плагинов.

<sub>Исходник: plugin-manager.js:262</sub>

<a id="api-game-registerlayer"></a>

#### `api.game.registerLayer(name, element)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |
| `element` *(обязательное)* | `HTMLElement` | DOM-элемент. |

##### Возвращает

`function` — Функция, удаляющая слой.

<sub>Исходник: plugin-manager.js:269</sub>

<a id="api-game-registernodetype"></a>

#### `api.game.registerNodeType(type, handler)`

*Метод*

Регистрирует обработчик типа узла сценария.
context: { wait(options), resume(), goto(nodeId) }.
`wait({ lock: true })` — ожидание, которое клик не пропускает.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя типа узла. |
| `handler` *(обязательное)* | `function` | (node, context) => void |

<sub>Исходник: plugin-manager.js:278</sub>

<a id="api-game-show"></a>

#### `api.game.show(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

<sub>Исходник: plugin-manager.js:293</sub>

<a id="api-game-hide"></a>

#### `api.game.hide(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

<sub>Исходник: plugin-manager.js:300</sub>

<a id="api-game-isvisible"></a>

#### `api.game.isVisible(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:307</sub>

<a id="api-player"></a>

### `api.player`

*Группа*

Прямой доступ к Player (слои). Те же методы, что api.game.* для слоёв.

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.player.getPluginLayer()`](#api-player-getpluginlayer) |  |
| [`api.player.registerLayer(name, element)`](#api-player-registerlayer) |  |
| [`api.player.show(name)`](#api-player-show) |  |
| [`api.player.hide(name)`](#api-player-hide) |  |
| [`api.player.isVisible(name)`](#api-player-isvisible) |  |

<sub>Исходник: plugin-manager.js:316</sub>

<a id="api-player-getpluginlayer"></a>

#### `api.player.getPluginLayer()`

*Метод*

##### Возвращает

`HTMLElement`

<sub>Исходник: plugin-manager.js:322</sub>

<a id="api-player-registerlayer"></a>

#### `api.player.registerLayer(name, element)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |
| `element` *(обязательное)* | `HTMLElement` | DOM-элемент. |

##### Возвращает

`function` — Функция, удаляющая слой.

<sub>Исходник: plugin-manager.js:329</sub>

<a id="api-player-show"></a>

#### `api.player.show(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

<sub>Исходник: plugin-manager.js:338</sub>

<a id="api-player-hide"></a>

#### `api.player.hide(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

<sub>Исходник: plugin-manager.js:345</sub>

<a id="api-player-isvisible"></a>

#### `api.player.isVisible(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:352</sub>

<a id="api-blocks"></a>

### `api.blocks`

*Свойство · Тип: BlockManager*

Менеджер блоков. Методы: create, get, getAll, getByType,
getActiveByChannel, getCurrent, show, hide, remove.
Блоки, созданные плагином, удаляются вместе с ним.
`create(type, { replace: true })` сначала убирает блоки того же канала.

<sub>Исходник: plugin-manager.js:361</sub>

<a id="api-ast"></a>

### `api.ast`

*Группа*

Доступ к парсеру сценария: плагин учит его распознавать
свои строки текста. Команды плагина снимаются при его удалении.

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.ast.addCommand(pattern, nodeType, handler)`](#api-ast-addcommand) | Регистрирует текстовую команду парсера. |

<sub>Исходник: plugin-manager.js:372</sub>

<a id="api-ast-addcommand"></a>

#### `api.ast.addCommand(pattern, nodeType, handler)`

*Метод*

Регистрирует текстовую команду парсера.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `pattern` *(обязательное)* | `RegExp` | Регулярное выражение для строки сценария. |
| `nodeType` *(обязательное)* | `string` | Тип узла, который создаёт команда. |
| `handler` *(обязательное)* | `function` | (match, line, index, scene) => узел |

##### Исключения

- `Error` — Если PluginManager создан без парсера или такая команда уже зарегистрирована.

##### Примеры

```js
api.ast.addCommand(/^\/\/\s*(.*)$/, 'narration', (match, line, index) => ({
    type: 'narration',
    text: match[1].trim()
}));
```

<sub>Исходник: plugin-manager.js:379</sub>

<a id="api-plugins"></a>

### `api.plugins`

*Свойство*

Proxy к API установленных плагинов.
Доступ: `api.plugins.<name>.api`.
Если плагин не установлен — null + warning в консоль.

#### Примеры

```js
const state = api.plugins.state.api.get();
api.plugins.state.api.set('health', 10);
```

<sub>Исходник: plugin-manager.js:408</sub>

## Plugins

<a id="choiceplugin"></a>

### `ChoicePlugin`

*Класс*

Узел `choice`: кнопки выбора с условными вариантами и переходом goto.
Зависит от плагинов `state` и `conditions`.

Для текстового сценария добавляет команду парсера:

`CHOICE: Вопрос | Вариант 1 → метка1 | Вариант 2 → метка2`

Вместо стрелки можно писать `->`. Вариант без стрелки создаётся
без перехода: история просто продолжится со следующего узла.
Условия в текстовой записи пока не поддерживаются.

Пока выбор не сделан, клик по экрану историю не продолжает.

<sub>Исходник: plugins/choice-plugin.js:1</sub>

<a id="conditionsplugin"></a>

### `ConditionsPlugin`

*Класс*

Проверяет игровые условия.

Предоставляет другим плагинам метод evaluate()
через api.plugins.conditions.api.

Поддерживаемые операторы:
==, !=, >, >=, <, <=

<sub>Исходник: plugins/conditions-plugin.js:1</sub>

<a id="notyplugin"></a>

### `NotyPlugin`

*Класс*

Показывает всплывающие уведомления в правом верхнем углу.

Сам реагирует на события движка:
`validator:errors` (ошибки проверки проекта),
`plugin:error` (плагин не загрузился или не установился),
`story:error` (ошибка во время выполнения узла).

Публичный API: `api.plugins.noty.api`
(`notify`, `success`, `error`, `warning`, `info`).

<sub>Исходник: plugins/noty-plugin.js:1</sub>

<a id="stateplugin"></a>

### `StatePlugin`

*Класс*

Управляет runtime-состоянием игры.

Плагин хранит состояние независимо от Project.
Начальное состояние загружается из `project.config.state`
при событии `story:loaded`.

Runtime-состояние изменяется через публичный API плагина
и доступно другим плагинам через:

`api.plugins.state.api`

<sub>Исходник: plugins/state-plugin.js:1</sub>

<a id="toplefthudplugin"></a>

### `TopLeftHUDPlugin`

*Класс*

Показывает в левом верхнем углу панель статуса героя.

После загрузки истории панель подхватывает из состояния игры
значения `health`, `mana`, `gold`, `score` и `level`. Остальные
значения можно выводить через публичный API плагина:

`api.plugins['top-left-hud'].api`

Плагин зависит от `state`: он должен быть установлен раньше,
чтобы состояние уже было готово к моменту события `story:loaded`.

<sub>Исходник: plugins/top-left-hud-plugin.js:1</sub>

## ConditionsPlugin

<a id="conditionsplugin-evaluate"></a>

### `ConditionsPlugin.evaluate(condition, state)`

*Метод*

Проверяет условие относительно переданного состояния.

Если условие не задано, возвращает true.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `condition` *(обязательное)* | `Object` | Условие проверки. |
| `state` *(обязательное)* | `Object` | Состояние, относительно которого проверяется условие. |

#### Возвращает

`boolean` — Результат проверки.

#### Исключения

- `Error` — Если оператор условия неизвестен.

#### Примеры

```js
const result =
    api.plugins.conditions.api.evaluate(
        {
            variable: 'health',
            operator: '>',
            value: 5
        },
        { health: 10 }
    );
```

<sub>Исходник: plugins/conditions-plugin.js:20</sub>

## StatePlugin

<a id="stateplugin-get"></a>

### `StatePlugin.get()`

*Метод*

Возвращает копию текущего runtime-состояния.

#### Возвращает

`Object` — Копия текущего состояния.

#### Примеры

```js
const state = api.plugins.state.api.get();
console.log(state.health);
```

<sub>Исходник: plugins/state-plugin.js:24</sub>

<a id="stateplugin-getvalue"></a>

### `StatePlugin.getValue(name)`

*Метод*

Возвращает значение переменной состояния.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя переменной. |

#### Возвращает

`*` — Значение переменной.

#### Примеры

```js
const health =
    api.plugins.state.api.getValue('health');
```

<sub>Исходник: plugins/state-plugin.js:40</sub>

<a id="stateplugin-set"></a>

### `StatePlugin.set(name, value)`

*Метод*

Устанавливает значение переменной состояния.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя переменной. |
| `value` *(обязательное)* | `*` | Новое значение. |

#### Примеры

```js
api.plugins.state.api.set('health', 10);
```

<sub>Исходник: plugins/state-plugin.js:57</sub>

<a id="stateplugin-update"></a>

### `StatePlugin.update(values)`

*Метод*

Обновляет несколько переменных состояния.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `values` *(обязательное)* | `Object` | Объект с новыми значениями. |

#### Примеры

```js
api.plugins.state.api.update({
    health: 10,
    money: 100
});
```

<sub>Исходник: plugins/state-plugin.js:73</sub>

<a id="stateplugin-storyloaded"></a>

### `StatePlugin.storyLoaded`

*Свойство*

Инициализирует runtime-состояние из конфигурации проекта
после загрузки истории.

<sub>Исходник: plugins/state-plugin.js:91</sub>

## TopLeftHUDPlugin

<a id="toplefthudplugin-set"></a>

### `TopLeftHUDPlugin.set(key, value)`

*Метод*

Выводит значение в панели.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `key` *(обязательное)* | `string` | Название строки. |
| `value` *(обязательное)* | `*` | Значение строки. |

#### Примеры

```js
api.plugins['top-left-hud'].api.set('gold', 50);
```

<sub>Исходник: plugins/top-left-hud-plugin.js:123</sub>

<a id="toplefthudplugin-settitle"></a>

### `TopLeftHUDPlugin.setTitle(title)`

*Метод*

Меняет заголовок панели.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `title` *(обязательное)* | `string` | Новый заголовок. |

<sub>Исходник: plugins/top-left-hud-plugin.js:140</sub>

<a id="toplefthudplugin-update"></a>

### `TopLeftHUDPlugin.update(values)`

*Метод*

Выводит сразу несколько значений.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `values` *(обязательное)* | `Object` | Объект вида `{ название: значение }`. |

#### Примеры

```js
api.plugins['top-left-hud'].api.update({ gold: 50, level: 2 });
```

<sub>Исходник: plugins/top-left-hud-plugin.js:153</sub>

<a id="toplefthudplugin-show"></a>

### `TopLeftHUDPlugin.show()`

*Метод*

Показывает панель.

<sub>Исходник: plugins/top-left-hud-plugin.js:169</sub>

<a id="toplefthudplugin-hide"></a>

### `TopLeftHUDPlugin.hide()`

*Метод*

Скрывает панель.

<sub>Исходник: plugins/top-left-hud-plugin.js:179</sub>

## Project

<a id="project"></a>

### `Project`

*Класс*

Единый источник данных игры: сцены, узлы, конфигурация,
ресурсы и список плагинов, которые нужны проекту.

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`Project.getPlugins()`](#project-getplugins) | Возвращает плагины, которые объявлены в проекте. Элемент списка — имя плагина или объект `{ name, version }`. Сами плагины устанавливает ... |

<sub>Исходник: project.js:1</sub>

<a id="project-getplugins"></a>

#### `Project.getPlugins()`

*Метод*

Возвращает плагины, которые объявлены в проекте.
Элемент списка — имя плагина или объект `{ name, version }`.
Сами плагины устанавливает `loadProjectPlugins()`.

##### Возвращает

`Array` — Список объявленных плагинов: строки
или объекты `{ name, version }`.

##### Примеры

```js
const project = new Project({
    plugins: ['state', { name: 'choice', version: '0.1.0' }]
});
project.getPlugins();
```

<sub>Исходник: project.js:23</sub>

## ProjectValidator

<a id="projectvalidator"></a>

### `ProjectValidator`

*Класс*

Проверяет проект на типовые и базовые ошибки. Такие как:
1. Метка (goto) не ведет ни к одному из существующих узлов

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`ProjectValidator.constructor(project)`](#projectvalidator-constructor) | Получает проект для валидации |
| [`ProjectValidator.validateGotos()`](#projectvalidator-validategotos) | Проверяет метки goto |

<sub>Исходник: ProjectValidator.js:4</sub>

<a id="projectvalidator-constructor"></a>

#### `ProjectValidator.constructor(project)`

*Метод*

Получает проект для валидации

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `project` *(обязательное)* | `project` |  |

<sub>Исходник: ProjectValidator.js:13</sub>

<a id="projectvalidator-validategotos"></a>

#### `ProjectValidator.validateGotos()`

*Метод*

Проверяет метки goto

##### Примеры

**Возвращает объект**

```js
const validator = new ProjectValidator(project);
const result = validator.validateGotos();
//Возвращяет объект
{
  valid: boolean,       // прошла ли валидация успешно
  hasGoto: boolean,     // найден ли хотя бы один goto
  gotoCount: number,    // сколько всего найдено goto
  nodeCount: number,    // сколько уникальных узлов найдено
  errors: Array<{       // список ошибок
      target: any,
      path: string,
      message: string
  }>
}
```

<sub>Исходник: ProjectValidator.js:24</sub>

<a id="changelog"></a>

## История изменений

### 0.1.4 (2026-10-14)

**Добавлено (32)**

- `AST`
- `AST.constructor`
- `AST.addCommand`
- `AST.removeCommand`
- `AST.getCommands`
- `AST.parse`
- `BlockManager`
- `BlockManager.create`
- `VN.unregisterNodeType`
- `EventBus`
- `EventBus.on`
- `EventBus.off`
- `EventBus.emit`
- `Logger`
- `Logger.constructor`
- `Logger.setLevel`
- `Logger.getLevel`
- `Logger.child`
- `Logger.debug`
- `Logger.info`
- `Logger.warn`
- `Logger.error`
- `api.plugin`
- `api.log`
- `api.log.debug`
- `api.log.info`
- `api.log.warn`
- `api.log.error`
- `api.ast`
- `api.ast.addCommand`
- `ChoicePlugin`
- `NotyPlugin`

**Изменено (19)**

- `loadProjectPlugins`
- `PluginManager`
- `PluginManager.constructor`
- `api.events`
- `api.events.on`
- `api.events.emit`
- `api.game`
- `api.game.getPluginLayer`
- `api.game.registerLayer`
- `api.game.registerNodeType`
- `api.game.show`
- `api.game.hide`
- `api.game.isVisible`
- `api.player.registerLayer`
- `api.player.show`
- `api.player.hide`
- `api.player.isVisible`
- `api.blocks`
- `api.plugins`

### 0.1.3 (2026-10-13)

**Добавлено (18)**

- `localPluginLoader`
- `normalizePluginRefs`
- `orderPlugins`
- `loadProjectPlugins`
- `PluginRegistry`
- `PluginRegistry.constructor`
- `PluginRegistry.register`
- `PluginRegistry.resolve`
- `PluginRegistry.has`
- `PluginRegistry.list`
- `TopLeftHUDPlugin`
- `TopLeftHUDPlugin.set`
- `TopLeftHUDPlugin.setTitle`
- `TopLeftHUDPlugin.update`
- `TopLeftHUDPlugin.show`
- `TopLeftHUDPlugin.hide`
- `Project`
- `Project.getPlugins`

### 0.1.2 (2026-10-08)

**Добавлено (11)**

- `ConditionsPlugin`
- `ConditionsPlugin.evaluate`
- `StatePlugin`
- `StatePlugin.get`
- `StatePlugin.getValue`
- `StatePlugin.set`
- `StatePlugin.update`
- `StatePlugin.storyLoaded`
- `ProjectValidator`
- `ProjectValidator.constructor`
- `ProjectValidator.validateGotos`

**Изменено (4)**

- `PluginManager`
- `PluginManager.constructor`
- `PluginManager.use`
- `PluginManager.remove`

**Удалено (2)**

- `api.conditions`
- `api.conditions.evaluate`

### 0.1.1 (2026-10-07)

Изменений нет

### 0.1.0 (2026-10-07)

Первая версия: 27 записей
