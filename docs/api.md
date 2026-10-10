# VN Engine API

**Версия 0.1.2** · Дата 2026-10-10 · 33 записей

<!-- Файл создан автоматически: apiscribe 0.4.0. Вручную не редактируйте. -->

## Содержание

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
- [История изменений](#changelog)

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

<sub>Исходник: plugin-manager.js:261</sub>

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

<sub>Исходник: plugin-manager.js:356</sub>

<a id="pluginmanager-has"></a>

#### `PluginManager.has(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:414</sub>

<a id="pluginmanager-get"></a>

#### `PluginManager.get(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`Object|undefined` — Исходный объект плагина

<sub>Исходник: plugin-manager.js:424</sub>

<a id="pluginmanager-list"></a>

#### `PluginManager.list()`

*Метод*

##### Возвращает

`string[]` — Имена установленных плагинов

<sub>Исходник: plugin-manager.js:434</sub>

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

<sub>Исходник: plugin-manager.js:73</sub>

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

<sub>Исходник: plugin-manager.js:79</sub>

<a id="api-events-emit"></a>

#### `api.events.emit(event, payload)`

*Метод*

Эмит события.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `event` *(обязательное)* | `string` | Имя события |
| `payload` *(необязательное)* | `*` | Данные |

<sub>Исходник: plugin-manager.js:92</sub>

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

<sub>Исходник: plugin-manager.js:103</sub>

<a id="api-game-getpluginlayer"></a>

#### `api.game.getPluginLayer()`

*Метод*

##### Возвращает

`HTMLElement` — DOM-слой плагинов

<sub>Исходник: plugin-manager.js:109</sub>

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

<sub>Исходник: plugin-manager.js:117</sub>

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

<sub>Исходник: plugin-manager.js:127</sub>

<a id="api-game-show"></a>

#### `api.game.show(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя |

<sub>Исходник: plugin-manager.js:138</sub>

<a id="api-game-hide"></a>

#### `api.game.hide(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя |

<sub>Исходник: plugin-manager.js:146</sub>

<a id="api-game-isvisible"></a>

#### `api.game.isVisible(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:154</sub>

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

<sub>Исходник: plugin-manager.js:164</sub>

<a id="api-player-getpluginlayer"></a>

#### `api.player.getPluginLayer()`

*Метод*

##### Возвращает

`HTMLElement`

<sub>Исходник: plugin-manager.js:170</sub>

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

<sub>Исходник: plugin-manager.js:178</sub>

<a id="api-player-show"></a>

#### `api.player.show(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` |  |

<sub>Исходник: plugin-manager.js:188</sub>

<a id="api-player-hide"></a>

#### `api.player.hide(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` |  |

<sub>Исходник: plugin-manager.js:196</sub>

<a id="api-player-isvisible"></a>

#### `api.player.isVisible(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` |  |

##### Возвращает

`boolean`

<sub>Исходник: plugin-manager.js:204</sub>

<a id="api-blocks"></a>

### `api.blocks`

*Свойство · Тип: BlockManager*

Экземпляр BlockManager.
Методы: create, get, getAll, getByType, getActiveByChannel,
getCurrent, show, hide, remove.

<sub>Исходник: plugin-manager.js:214</sub>

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

<sub>Исходник: plugin-manager.js:226</sub>

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

### 0.1.2 (2026-10-10)

Первая версия: 33 записей
