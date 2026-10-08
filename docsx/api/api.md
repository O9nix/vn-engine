# VN Engine API

**Версия 0.1.2** · Дата 2026-10-08 · 33 записей

<!-- Файл создан автоматически: apiscribe 0.3.0. Вручную не редактируйте. -->

## Содержание

- **PluginManager**
  - [PluginManager](#pluginmanager)
    - [PluginManager.constructor(bus, game, player, blocks, conditions)](#pluginmanager-constructor)
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
- [История изменений](#changelog)

## PluginManager

<a id="pluginmanager"></a>

### `PluginManager`

*Класс*

Устанавливает плагины и предоставляет единый Plugin API
(`events`, `game`, `player`, `blocks`, `conditions`, `plugins`).

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`PluginManager.constructor(bus, game, player, blocks, conditions)`](#pluginmanager-constructor) | Собирает объект `api`, который каждый плагин получает в `install(api)`. |
| [`PluginManager.use(plugin)`](#pluginmanager-use) | Устанавливает плагин. Плагин обязан иметь `name` и `install(api)`. |
| [`PluginManager.remove(name)`](#pluginmanager-remove) | Удаляет плагин и вызывает его cleanup, если он есть. |
| [`PluginManager.has(name)`](#pluginmanager-has) |  |
| [`PluginManager.get(name)`](#pluginmanager-get) |  |
| [`PluginManager.list()`](#pluginmanager-list) |  |

<sub>Исходник: plugin-manager.js:1</sub>

<a id="pluginmanager-constructor"></a>

#### `PluginManager.constructor(bus, game, player, blocks, conditions)`

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
├── conditions
│   └── evaluate(condition, state) → boolean
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
| `conditions` *(обязательное)* | `ConditionEvaluator` |  |

<sub>Исходник: plugin-manager.js:11</sub>

<a id="pluginmanager-use"></a>

#### `PluginManager.use(plugin)`

*Метод*

Устанавливает плагин. Плагин обязан иметь `name` и `install(api)`.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `plugin` *(обязательное)* | `Object` |  |
| `plugin.name` *(обязательное)* | `string` | Уникальное имя |
| `plugin.install` *(обязательное)* | `function` | Функция установки, получает api |

##### Возвращает

`PluginManager` — this (chainable)

##### Исключения

- `TypeError` — Если нет install
- `Error` — Если нет name или плагин уже установлен

##### Примеры

```js
plugins.use(DialoguePlugin).use(ChoicePlugin);
```

<sub>Исходник: plugin-manager.js:267</sub>

<a id="pluginmanager-remove"></a>

#### `PluginManager.remove(name)`

*Метод*

Удаляет плагин и вызывает его cleanup, если он есть.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`boolean` — true, если плагин был удалён

<sub>Исходник: plugin-manager.js:338</sub>

<a id="pluginmanager-has"></a>

#### `PluginManager.has(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:366</sub>

<a id="pluginmanager-get"></a>

#### `PluginManager.get(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`Object|undefined` — Исходный объект плагина

<sub>Исходник: plugin-manager.js:376</sub>

<a id="pluginmanager-list"></a>

#### `PluginManager.list()`

*Метод*

##### Возвращает

`string[]` — Имена установленных плагинов

<sub>Исходник: plugin-manager.js:386</sub>

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

<sub>Исходник: plugin-manager.js:80</sub>

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

<sub>Исходник: plugin-manager.js:86</sub>

<a id="api-events-emit"></a>

#### `api.events.emit(event, payload)`

*Метод*

Эмит события.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `event` *(обязательное)* | `string` | Имя события |
| `payload` *(необязательное)* | `*` | Данные |

<sub>Исходник: plugin-manager.js:99</sub>

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

<sub>Исходник: plugin-manager.js:110</sub>

<a id="api-game-getpluginlayer"></a>

#### `api.game.getPluginLayer()`

*Метод*

##### Возвращает

`HTMLElement` — DOM-слой плагинов

<sub>Исходник: plugin-manager.js:116</sub>

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

<sub>Исходник: plugin-manager.js:124</sub>

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

<sub>Исходник: plugin-manager.js:134</sub>

<a id="api-game-show"></a>

#### `api.game.show(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя |

<sub>Исходник: plugin-manager.js:145</sub>

<a id="api-game-hide"></a>

#### `api.game.hide(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя |

<sub>Исходник: plugin-manager.js:153</sub>

<a id="api-game-isvisible"></a>

#### `api.game.isVisible(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:161</sub>

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

<sub>Исходник: plugin-manager.js:171</sub>

<a id="api-player-getpluginlayer"></a>

#### `api.player.getPluginLayer()`

*Метод*

##### Возвращает

`HTMLElement`

<sub>Исходник: plugin-manager.js:177</sub>

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

<sub>Исходник: plugin-manager.js:185</sub>

<a id="api-player-show"></a>

#### `api.player.show(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` |  |

<sub>Исходник: plugin-manager.js:195</sub>

<a id="api-player-hide"></a>

#### `api.player.hide(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` |  |

<sub>Исходник: plugin-manager.js:203</sub>

<a id="api-player-isvisible"></a>

#### `api.player.isVisible(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` |  |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:211</sub>

<a id="api-blocks"></a>

### `api.blocks`

*Свойство · Тип: BlockManager*

Экземпляр BlockManager.
Методы: create, get, getAll, getByType, getActiveByChannel,
getCurrent, show, hide, remove.

<sub>Исходник: plugin-manager.js:221</sub>

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

<sub>Исходник: plugin-manager.js:233</sub>

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

<sub>Исходник: plugins/conditions-plugin.js:17</sub>

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

<sub>Исходник: plugins/state-plugin.js:22</sub>

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

<sub>Исходник: plugins/state-plugin.js:38</sub>

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

<sub>Исходник: plugins/state-plugin.js:55</sub>

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

<sub>Исходник: plugins/state-plugin.js:71</sub>

<a id="stateplugin-storyloaded"></a>

### `StatePlugin.storyLoaded`

*Свойство*

Инициализирует runtime-состояние из конфигурации проекта
после загрузки истории.

<sub>Исходник: plugins/state-plugin.js:89</sub>

<a id="changelog"></a>

## История изменений

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

**Удалено (2)**

- `api.conditions`
- `api.conditions.evaluate`

### 0.1.1 (2026-10-07)

Изменений нет

### 0.1.0 (2026-10-07)

Первая версия: 27 записей
