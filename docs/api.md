# VN Engine API

**Версия 0.1.3** · Дата 2026-10-12 · 48 записей

<!-- Файл создан автоматически: apiscribe 0.4.0. Вручную не редактируйте. -->

## Содержание

- **PluginRegistry**
  - [localPluginLoader(name)](#localpluginloader)
  - [PluginRegistry](#pluginregistry)
    - [PluginRegistry.constructor(options)](#pluginregistry-constructor)
    - [PluginRegistry.register(plugin)](#pluginregistry-register)
    - [PluginRegistry.resolve(name, version)](#pluginregistry-resolve)
    - [PluginRegistry.has(name)](#pluginregistry-has)
    - [PluginRegistry.list()](#pluginregistry-list)
- **PluginLoader**
  - [normalizePluginRefs(refs)](#normalizepluginrefs)
  - [orderPlugins(plugins)](#orderplugins)
  - [loadProjectPlugins(project, registry, manager)](#loadprojectplugins)
- **PluginManager**
  - [PluginManager](#pluginmanager)
    - [PluginManager.constructor(bus, game, player, blocks)](#pluginmanager-constructor)
    - [PluginManager.use(plugin)](#pluginmanager-use)
    - [PluginManager.remove(name)](#pluginmanager-remove)
    - [PluginManager.has(name)](#pluginmanager-has)
    - [PluginManager.get(name)](#pluginmanager-get)
    - [PluginManager.list()](#pluginmanager-list)
- **PluginAPI**
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
  - [api.plugins](#api-plugins)
- **Plugins**
  - [ConditionsPlugin](#conditionsplugin)
  - [StatePlugin](#stateplugin)
- **ConditionsPlugin**
  - [ConditionsPlugin.evaluate(condition, state)](#conditionsplugin-evaluate)
- **StatePlugin**
  - [StatePlugin.get()](#stateplugin-get)
  - [StatePlugin.getValue(name)](#stateplugin-getvalue)
  - [StatePlugin.set(name, value)](#stateplugin-set)
  - [StatePlugin.update(values)](#stateplugin-update)
  - [StatePlugin.storyLoaded](#stateplugin-storyloaded)
- **Project**
  - [Project](#project)
    - [Project.getPlugins()](#project-getplugins)
- **ProjectValidator**
  - [ProjectValidator](#projectvalidator)
    - [ProjectValidator.constructor(project)](#projectvalidator-constructor)
    - [ProjectValidator.validateGotos()](#projectvalidator-validategotos)
- [История изменений](#changelog)

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
Если установка какого-то плагина завершилась ошибкой, уже
установленные плагины удаляются, и ошибка пробрасывается дальше.

Вызывать нужно до `game.loadProject(project)`, чтобы плагины
успели подписаться на `story:loaded`.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `project` *(обязательное)* | `Project` | Проект с объявленными плагинами. |
| `registry` *(обязательное)* | `PluginRegistry` | Каталог доступных плагинов. |
| `manager` *(обязательное)* | `PluginManager` | Менеджер, устанавливающий плагины. |

#### Возвращает

`Promise` — Промис с массивом имён установленных плагинов
в порядке установки.

#### Исключения

- `Error` — Если плагин не найден, зависимости не объявлены, есть цикл или установка завершилась ошибкой.

#### Примеры

```js
const installed = await loadProjectPlugins(project, registry, plugins);
game.loadProject(project);
```

<sub>Исходник: plugin-loader.js:143</sub>

## PluginManager

<a id="pluginmanager"></a>

### `PluginManager`

*Класс*

Устанавливает плагины и предоставляет единый Plugin API
(`events`, `game`, `player`, `blocks`, `plugins`).

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`PluginManager.constructor(bus, game, player, blocks)`](#pluginmanager-constructor) | Собирает объект `api`, который каждый плагин получает в `install(api)`. |
| [`PluginManager.use(plugin)`](#pluginmanager-use) | Устанавливает плагин после проверки его зависимостей. |
| [`PluginManager.remove(name)`](#pluginmanager-remove) | Удаляет установленный плагин, если от него не зависят другие установленные плагины. |
| [`PluginManager.has(name)`](#pluginmanager-has) |  |
| [`PluginManager.get(name)`](#pluginmanager-get) |  |
| [`PluginManager.list()`](#pluginmanager-list) |  |

<sub>Исходник: plugin-manager.js:1</sub>

<a id="pluginmanager-constructor"></a>

#### `PluginManager.constructor(bus, game, player, blocks)`

*Метод*

Собирает объект `api`, который каждый плагин получает в `install(api)`.

Структура api:
```
api
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
├── blocks          → BlockManager
└── plugins         → Proxy
    └── <name>.api  → публичный API плагина
```

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `bus` *(обязательное)* | `EventBus` |  |
| `game` *(обязательное)* | `VN` |  |
| `player` *(обязательное)* | `Player` |  |
| `blocks` *(обязательное)* | `BlockManager` |  |

<sub>Исходник: plugin-manager.js:10</sub>

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

<sub>Исходник: plugin-manager.js:262</sub>

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

<sub>Исходник: plugin-manager.js:357</sub>

<a id="pluginmanager-has"></a>

#### `PluginManager.has(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:415</sub>

<a id="pluginmanager-get"></a>

#### `PluginManager.get(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`Object|undefined` — Исходный объект плагина

<sub>Исходник: plugin-manager.js:425</sub>

<a id="pluginmanager-list"></a>

#### `PluginManager.list()`

*Метод*

##### Возвращает

`string[]` — Имена установленных плагинов

<sub>Исходник: plugin-manager.js:435</sub>

## PluginAPI

<a id="api-events"></a>

### `api.events`

*Группа*

Обёртка над EventBus.

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.events.on(event, handler)`](#api-events-on) | Подписка на событие. |
| [`api.events.emit(event, payload)`](#api-events-emit) | Эмит события. |

<sub>Исходник: plugin-manager.js:74</sub>

<a id="api-events-on"></a>

#### `api.events.on(event, handler)`

*Метод*

Подписка на событие.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `event` *(обязательное)* | `string` | Имя события |
| `handler` *(обязательное)* | `function` | Callback |

##### Возвращает

`function` — Функция отписки

##### Примеры

```js
obj.doThing('x');
```

<sub>Исходник: plugin-manager.js:80</sub>

<a id="api-events-emit"></a>

#### `api.events.emit(event, payload)`

*Метод*

Эмит события.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `event` *(обязательное)* | `string` | Имя события |
| `payload` *(необязательное)* | `*` | Данные |

<sub>Исходник: plugin-manager.js:93</sub>

<a id="api-game"></a>

### `api.game`

*Группа*

Фасад к VN + Player: регистрация типов узлов и работа со слоями.

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.game.getPluginLayer()`](#api-game-getpluginlayer) |  |
| [`api.game.registerLayer(name, element)`](#api-game-registerlayer) |  |
| [`api.game.registerNodeType(type, handler)`](#api-game-registernodetype) | Регистрирует обработчик типа узла сценария. context: { wait(), resume(), goto(nodeId) } |
| [`api.game.show(name)`](#api-game-show) |  |
| [`api.game.hide(name)`](#api-game-hide) |  |
| [`api.game.isVisible(name)`](#api-game-isvisible) |  |

<sub>Исходник: plugin-manager.js:104</sub>

<a id="api-game-getpluginlayer"></a>

#### `api.game.getPluginLayer()`

*Метод*

##### Возвращает

`HTMLElement` — DOM-слой плагинов

<sub>Исходник: plugin-manager.js:110</sub>

<a id="api-game-registerlayer"></a>

#### `api.game.registerLayer(name, element)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя |
| `element` *(обязательное)* | `HTMLElement` | DOM-элемент |

##### Возвращает

`function` — cleanup

<sub>Исходник: plugin-manager.js:118</sub>

<a id="api-game-registernodetype"></a>

#### `api.game.registerNodeType(type, handler)`

*Метод*

Регистрирует обработчик типа узла сценария.
context: { wait(), resume(), goto(nodeId) }

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя типа узла |
| `handler` *(обязательное)* | `function` | (node, context) => void |

<sub>Исходник: plugin-manager.js:128</sub>

<a id="api-game-show"></a>

#### `api.game.show(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя |

<sub>Исходник: plugin-manager.js:139</sub>

<a id="api-game-hide"></a>

#### `api.game.hide(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя |

<sub>Исходник: plugin-manager.js:147</sub>

<a id="api-game-isvisible"></a>

#### `api.game.isVisible(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:155</sub>

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

<sub>Исходник: plugin-manager.js:165</sub>

<a id="api-player-getpluginlayer"></a>

#### `api.player.getPluginLayer()`

*Метод*

##### Возвращает

`HTMLElement`

<sub>Исходник: plugin-manager.js:171</sub>

<a id="api-player-registerlayer"></a>

#### `api.player.registerLayer(name, element)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` |  |
| `element` *(обязательное)* | `HTMLElement` |  |

##### Возвращает

`function` — cleanup

<sub>Исходник: plugin-manager.js:179</sub>

<a id="api-player-show"></a>

#### `api.player.show(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` |  |

<sub>Исходник: plugin-manager.js:189</sub>

<a id="api-player-hide"></a>

#### `api.player.hide(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` |  |

<sub>Исходник: plugin-manager.js:197</sub>

<a id="api-player-isvisible"></a>

#### `api.player.isVisible(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` |  |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:205</sub>

<a id="api-blocks"></a>

### `api.blocks`

*Свойство · Тип: BlockManager*

Экземпляр BlockManager.
Методы: create, get, getAll, getByType, getActiveByChannel,
getCurrent, show, hide, remove.

<sub>Исходник: plugin-manager.js:215</sub>

<a id="api-plugins"></a>

### `api.plugins`

*Свойство*

Proxy к API установленных плагинов.
Доступ: `api.plugins.<name>.api`
Если плагин не установлен — null + warning в консоль.

#### Примеры

```js
const state = api.plugins.state.api.get();
api.plugins.state.api.set('health', 10);
```

<sub>Исходник: plugin-manager.js:227</sub>

## Plugins

<a id="conditionsplugin"></a>

### `ConditionsPlugin`

*Класс*

Проверяет игровые условия.

Предоставляет другим плагинам метод evaluate()
через api.plugins.conditions.api.

Поддерживаемые операторы:
==, !=, >, >=, <, <=

<sub>Исходник: plugins/conditions-plugin.js:1</sub>

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

<sub>Исходник: plugins/conditions-plugin.js:19</sub>

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

### 0.1.3 (2026-10-12)

**Добавлено (15)**

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
- `Project`
- `Project.getPlugins`
- `ProjectValidator`
- `ProjectValidator.constructor`
- `ProjectValidator.validateGotos`

**Изменено (4)**

- `PluginManager`
- `PluginManager.constructor`
- `PluginManager.use`
- `PluginManager.remove`

### 0.1.2 (2026-10-08)

**Добавлено (8)**

- `ConditionsPlugin`
- `ConditionsPlugin.evaluate`
- `StatePlugin`
- `StatePlugin.get`
- `StatePlugin.getValue`
- `StatePlugin.set`
- `StatePlugin.update`
- `StatePlugin.storyLoaded`

**Изменено (1)**

- `PluginManager.constructor`

**Удалено (2)**

- `api.conditions`
- `api.conditions.evaluate`

### 0.1.1 (2026-10-07)

Изменений нет

### 0.1.0 (2026-10-07)

Первая версия: 27 записей
